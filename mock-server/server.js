import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleCms } from "./cms.js";
import { initDb, seedLauncherSettings } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.join(__dirname, "files");
const CMS_IMAGES_DIR =
  process.env.CMS_IMAGES_DIR ?? "C:\\Starfall-WoW-CMS\\public\\images";
const PORT = 8787;
const HOST = "127.0.0.1";
const MANIFEST_VERSION = "2026.04.22";
const BASE_URL = `http://${HOST}:${PORT}/files`;

const spec = [
  { relPath: "test1.bin", size: 1 * 1024 * 1024, category: "client", mode: "random" },
  { relPath: "test2.bin", size: 5 * 1024 * 1024, category: "patch", mode: "random" },
  {
    relPath: "README.txt",
    category: "addon",
    mode: "text",
    content: "Starfall Mock Server test file.\nPatcher end-to-end verification.\n",
  },
];

async function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", resolve)
      .on("error", reject);
  });
  return hash.digest("hex");
}

async function ensureFiles() {
  await fsp.mkdir(FILES_DIR, { recursive: true });
  for (const entry of spec) {
    const filePath = path.join(FILES_DIR, entry.relPath);
    let regenerate = true;
    try {
      const stat = await fsp.stat(filePath);
      const expectedSize = entry.mode === "text" ? Buffer.byteLength(entry.content) : entry.size;
      regenerate = stat.size !== expectedSize;
    } catch {
      regenerate = true;
    }
    if (!regenerate) continue;

    if (entry.mode === "text") {
      await fsp.writeFile(filePath, entry.content);
    } else {
      const buf = crypto.randomBytes(entry.size);
      await fsp.writeFile(filePath, buf);
    }
    console.log(`[mock] generated ${entry.relPath}`);
  }
}

async function buildManifest() {
  const files = [];
  for (const entry of spec) {
    const filePath = path.join(FILES_DIR, entry.relPath);
    const stat = await fsp.stat(filePath);
    files.push({
      path: entry.relPath,
      size: stat.size,
      sha256: await sha256(filePath),
      url: `${BASE_URL}/${entry.relPath}`,
      category: entry.category,
    });
  }
  return {
    expansion: "cata",
    version: MANIFEST_VERSION,
    files,
    deletions: [],
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function parseRange(header, size) {
  if (!header || !header.startsWith("bytes=")) return null;
  const [rawStart, rawEnd] = header.slice(6).split("-");
  let start = rawStart === "" ? null : Number.parseInt(rawStart, 10);
  let end = rawEnd === "" ? size - 1 : Number.parseInt(rawEnd, 10);
  if (start === null) {
    if (!Number.isFinite(end) || end <= 0) return null;
    start = Math.max(0, size - end);
    end = size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end >= size || start > end) return null;
  return { start, end };
}

async function serveFile(req, res, relPath) {
  const safeRel = path.normalize(relPath).replace(/^[/\\]+/, "");
  const filePath = path.join(FILES_DIR, safeRel);
  if (!filePath.startsWith(FILES_DIR + path.sep) && filePath !== FILES_DIR) {
    res.writeHead(400).end("bad path");
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  const size = stat.size;
  const range = parseRange(req.headers.range, size);

  if (req.method === "HEAD") {
    res.writeHead(200, {
      "content-length": size,
      "accept-ranges": "bytes",
      "content-type": "application/octet-stream",
    });
    res.end();
    return;
  }

  if (range) {
    const { start, end } = range;
    res.writeHead(206, {
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "content-length": end - start + 1,
      "content-type": "application/octet-stream",
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "content-length": size,
    "accept-ranges": "bytes",
    "content-type": "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
}

async function serveImage(req, res, relPath) {
  const safeRel = path.normalize(decodeURIComponent(relPath)).replace(/^[/\\]+/, "");
  if (safeRel.includes("..")) {
    res.writeHead(400).end("bad path");
    return;
  }
  const full = path.join(CMS_IMAGES_DIR, safeRel);
  if (!full.startsWith(CMS_IMAGES_DIR)) {
    res.writeHead(400).end("bad path");
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(full);
  } catch {
    res.writeHead(404).end("image not found");
    return;
  }
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === ".svg" ? "image/svg+xml"
    : ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : "application/octet-stream";
  res.writeHead(200, {
    "content-type": type,
    "content-length": stat.size,
    "cache-control": "public, max-age=86400",
    "access-control-allow-origin": "*",
  });
  if (req.method === "HEAD") { res.end(); return; }
  fs.createReadStream(full).pipe(res);
}

async function main() {
  await initDb();
  await seedLauncherSettings();
  await ensureFiles();
  let manifest = await buildManifest();
  console.log(`[mock] manifest ready (${manifest.files.length} files, version ${manifest.version})`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (req.method === "GET" && url.pathname === "/manifests/cata.json") {
        sendJson(res, 200, manifest);
        return;
      }
      if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/files/")) {
        await serveFile(req, res, url.pathname.slice("/files/".length));
        return;
      }
      if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/images/")) {
        await serveImage(req, res, url.pathname.slice("/images/".length));
        return;
      }
      if (req.method === "POST" && url.pathname === "/_regenerate") {
        await ensureFiles();
        manifest = await buildManifest();
        sendJson(res, 200, { ok: true, version: manifest.version });
        return;
      }
      if (
        url.pathname.startsWith("/api/") ||
        url.pathname === "/shop" ||
        url.pathname.startsWith("/armory/")
      ) {
        const handled = await handleCms(req, res, url);
        if (handled || res.headersSent) return;
      }
      if (res.headersSent) return;
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    } catch (err) {
      console.error("[mock] error:", err);
      if (res.writableEnded) return;
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("internal error");
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[mock] listening on http://${HOST}:${PORT}`);
    console.log(`[mock] manifest:  http://${HOST}:${PORT}/manifests/cata.json`);
    console.log(`[mock] files dir: ${FILES_DIR}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
