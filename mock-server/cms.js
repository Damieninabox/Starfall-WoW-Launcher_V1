// Mock CMS endpoints — fake data for launcher development.
// All endpoints live under /api/* and return JSON. Auth is a shared-secret
// bearer token; real CMS will swap this for JWT validation against its own
// user store.

import crypto from "node:crypto";
import {
  dbEnabled,
  findAccountForLogin,
  charactersForAccount,
  guildByKey,
  guildEvents,
  realmStatus,
  cmsNews,
  cmsRealms,
  cmsShopItems,
  cmsChangelog,
  cmsVoteSites,
  cmsAccountPoints,
  cmsRecordVote,
  worldEvents,
  currentSeason,
  mplusWeeklyAffixes,
  mplusLeaderboard,
  mplusCharacterRuns,
  mplusWeeklyProgress,
  mplusEnabledDungeons,
  itemSearch,
  itemById,
} from "./db.js";

// --- fixtures ---------------------------------------------------------------

const USER = {
  username: "starfall",
  password: "starfall",
  id: "user-0001",
  displayName: "Starfall",
  email: "starfall@example.test",
  has2fa: false,
  totpSecret: null,
};

const BACKUP_CODES = ["NYK-4MHQ", "R82-PWZX", "TDE-XH5L", "JQ7-6VFA", "8SN-2WRC"];

const CHARACTERS = [
  { id: 10001, name: "Thrallborn", realm: "Starfall", className: "Shaman", race: "Orc", faction: "Horde", level: 85, itemLevel: 395, guild: "Ebon Dawn", lastPlayed: "2026-04-20T19:00:00Z" },
  { id: 10002, name: "Ashpyre", realm: "Starfall", className: "Mage", race: "Human", faction: "Alliance", level: 85, itemLevel: 389, guild: "Silver Hand", lastPlayed: "2026-04-18T22:00:00Z" },
  { id: 10003, name: "Grimbuckle", realm: "Starfall", className: "Warrior", race: "Dwarf", faction: "Alliance", level: 85, itemLevel: 402, guild: "Silver Hand", lastPlayed: "2026-04-22T07:30:00Z" },
  { id: 10004, name: "Veinsplitter", realm: "Starfall", className: "Rogue", race: "Troll", faction: "Horde", level: 84, itemLevel: 340, guild: null, lastPlayed: "2026-03-10T11:00:00Z" },
];

const AFFIXES = {
  week: "2026-16",
  rotation: [
    { id: 9, name: "Tyrannical", icon: "mplus-tyrannical", description: "Bosses have 30% more health and deal 15% more damage." },
    { id: 6, name: "Raging", icon: "mplus-raging", description: "Non-boss enemies enrage at 30% health." },
    { id: 123, name: "Spiteful", icon: "mplus-spiteful", description: "Fallen non-boss enemies spawn Spiteful Shades." },
  ],
};

const MPLUS_LEADERBOARD = [
  { rank: 1, party: ["Thrallborn", "Grimbuckle", "Ashpyre", "Veinsplitter", "Saintanvil"], dungeon: "Stonecore", timer: "22:41", score: 3521 },
  { rank: 2, party: ["Hexbrand", "Moonspear", "Emberfoot", "Ashpyre", "Saintanvil"], dungeon: "Grim Batol", timer: "28:19", score: 3402 },
  { rank: 3, party: ["Grimbuckle", "Helwulf", "Nightmerchant", "Ashpyre", "Thrallborn"], dungeon: "Lost City", timer: "30:02", score: 3377 },
];

const RAIDS = [
  {
    raid: "Dragon Soul",
    tier: "T13",
    bosses: [
      { name: "Morchok", killed: true, firstKillGuild: "Ebon Dawn", firstKillDate: "2026-03-18" },
      { name: "Warlord Zon'ozz", killed: true, firstKillGuild: "Ebon Dawn", firstKillDate: "2026-03-19" },
      { name: "Yor'sahj the Unsleeping", killed: true, firstKillGuild: "Silver Hand", firstKillDate: "2026-03-22" },
      { name: "Hagara the Stormbinder", killed: true, firstKillGuild: "Silver Hand", firstKillDate: "2026-03-26" },
      { name: "Ultraxion", killed: true, firstKillGuild: "Ebon Dawn", firstKillDate: "2026-04-02" },
      { name: "Warmaster Blackhorn", killed: false, firstKillGuild: null, firstKillDate: null },
      { name: "Spine of Deathwing", killed: false, firstKillGuild: null, firstKillDate: null },
      { name: "Madness of Deathwing", killed: false, firstKillGuild: null, firstKillDate: null },
    ],
  },
];

const NEWS = [
  { id: "n-42", title: "Dragon Soul is live", body: "Tier 13 opens with Morchok through Madness of Deathwing. Shared lockouts between 10 and 25 are enabled.", date: "2026-04-15", tag: "content" },
  { id: "n-41", title: "Scheduled maintenance 2026-04-24 08:00 UTC", body: "~90 min downtime for database index rebuild. Characters and mail are unaffected.", date: "2026-04-20", tag: "maintenance" },
  { id: "n-40", title: "Transmog vendor in Stormwind + Orgrimmar", body: "Visit Esmerelda (SW) or Gragnok (Orgrimmar) near the auction houses.", date: "2026-04-12", tag: "qol" },
];

const SERVER_STATUS = {
  online: true,
  population: 1243,
  uptimeHours: 412,
  realm: "Starfall",
  tps: 100,
};

const GUILDS = {
  "ebon-dawn": {
    name: "Ebon Dawn",
    motd: "Dragon Soul Heroic progression starts Thursday. Raid gear check by Wednesday.",
    memberCount: 142,
    onlineCount: 34,
    events: [
      { id: "ev-01", title: "Dragon Soul Heroic", when: "2026-04-24T19:00:00Z", kind: "raid" },
      { id: "ev-02", title: "Alt night — any MC", when: "2026-04-26T19:00:00Z", kind: "raid" },
    ],
  },
  "silver-hand": {
    name: "Silver Hand",
    motd: "Mythic+ keys pushing 20 this week. Post your keys in #mplus.",
    memberCount: 98,
    onlineCount: 21,
    events: [
      { id: "ev-03", title: "Guild Meeting", when: "2026-04-25T20:00:00Z", kind: "social" },
    ],
  },
};

const REFERRAL = {
  code: "STARFALL-LUK12",
  link: "https://starfall.gg/r/STARFALL-LUK12",
  signups: 7,
  active: 4,
  rewardsEarned: 2800,
  rewardsPending: 1200,
};

const ITEM_DB = [
  { id: 72239, name: "Tyrannical Gladiator's Shoulders", icon: "item-t13-shoulders", quality: 4, ilvl: 410, type: "Plate Shoulders", setId: "t13-pvp" },
  { id: 72240, name: "Vishanka, Jaws of the Earth", icon: "item-vishanka", quality: 4, ilvl: 410, type: "Bow", setId: null },
  { id: 72241, name: "Hood of Hidden Flesh", icon: "item-t13-helm", quality: 4, ilvl: 410, type: "Cloth Head", setId: "t13-warlock" },
  { id: 72242, name: "Vagaries of Time", icon: "item-vagaries", quality: 4, ilvl: 410, type: "Trinket", setId: null },
];

const ITEM_SOURCES = {
  72239: [{ type: "vendor", name: "Tyrannical Gladiator Vendor", zone: "Stormwind", dropChance: null }],
  72240: [{ type: "boss", name: "Ultraxion", zone: "Dragon Soul", dropChance: 18 }],
  72241: [{ type: "boss", name: "Warmaster Blackhorn", zone: "Dragon Soul", dropChance: 22 }],
  72242: [{ type: "boss", name: "Warlord Zon'ozz", zone: "Dragon Soul", dropChance: 20 }],
};

const ADDONS = [
  { id: "serverannounce", name: "ServerAnnounce", description: "In-game server announcements", version: "1.2.0", enabledByDefault: true, category: "core" },
  { id: "starfall-meter", name: "Starfall Damage Meter", description: "Skada fork with server-side validation", version: "0.7.3", enabledByDefault: true, category: "combat" },
  { id: "mplus-helper", name: "Mythic+ Helper", description: "Affix reminders, key tracker, party sync", version: "2.1.1", enabledByDefault: false, category: "mplus" },
];

// --- server state -----------------------------------------------------------

const sessions = new Map(); // token -> { username, issuedAt }
const refreshTokens = new Map(); // refresh -> token
const pending2fa = new Map(); // pendingToken -> username
const sessionLog = []; // [{ id, username, ip, ua, createdAt }]
const tickets = []; // [{ id, title, category, description, submittedAt, userAgent }]
const wishlists = new Map(); // username -> Set<itemId>

function newToken(prefix = "tk") {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function issueLogin(user, req) {
  const token = newToken("jwt");
  const refresh = newToken("rt");
  sessions.set(token, { username: user.username, issuedAt: Date.now() });
  refreshTokens.set(refresh, token);
  sessionLog.unshift({
    id: `sess-${Date.now()}`,
    username: user.username,
    ip: req?.socket?.remoteAddress ?? "127.0.0.1",
    ua: req?.headers?.["user-agent"] ?? "unknown",
    createdAt: new Date().toISOString(),
  });
  if (sessionLog.length > 50) sessionLog.length = 50;
  return { token, refreshToken: refresh };
}

function bearerUser(req) {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  const s = sessions.get(token);
  if (!s) return null;
  return {
    ...USER,
    username: s.username,
    displayName: s.displayName ?? s.username,
    email: s.email ?? USER.email,
    accountId: s.accountId ?? null,
    id: s.accountId ? `acct-${s.accountId}` : USER.id,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      if (!buf) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  if (res.headersSent) return true;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "cache-control": "no-store",
  });
  res.end(payload);
  return true;
}

function sendHtml(res, body) {
  if (res.headersSent) return true;
  const buf = Buffer.from(body, "utf-8");
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": buf.length,
  });
  res.end(buf);
  return true;
}

// --- route handlers ---------------------------------------------------------

export async function handleCms(req, res, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    });
    res.end();
    return true;
  }

  const p = url.pathname;

  // -- public
  if (req.method === "POST" && p === "/api/launcher/login") {
    const body = await readBody(req);
    let user = null;
    if (dbEnabled() && body.username) {
      const result = await findAccountForLogin(body.username, body.password ?? "");
      if (result?.account) {
        const a = result.account;
        user = {
          ...USER,
          id: `acct-${a.id}`,
          username: a.username,
          displayName: a.username,
          email: a.email ?? USER.email,
          accountId: a.id,
        };
      } else if (result?.notFound || result?.badPassword) {
        sendJson(res, 401, { error: "invalid credentials" });
        return true;
      }
      // result === null means DB query failed; fall through to mock path
    }
    if (!user) {
      if (body.username !== USER.username || body.password !== USER.password) {
        sendJson(res, 401, { error: "invalid credentials" });
        return true;
      }
      user = USER;
    }
    if (user.has2fa) {
      const pending = newToken("pend");
      pending2fa.set(pending, user.username);
      sendJson(res, 200, { requires2fa: true, pendingToken: pending });
      return true;
    }
    const { token, refreshToken } = issueLogin(user, req);
    sessions.set(token, {
      username: user.username,
      accountId: user.accountId,
      displayName: user.displayName,
      email: user.email,
      issuedAt: Date.now(),
    });
    sendJson(res, 200, { token, refreshToken });
    return true;
  }

  if (req.method === "POST" && p === "/api/launcher/login/2fa") {
    const body = await readBody(req);
    const user = pending2fa.get(body.pendingToken);
    if (!user) return sendJson(res, 401, { error: "pending token expired" });
    // Accept any 6-digit code in mock. Real CMS verifies TOTP.
    if (!/^\d{6}$/.test(String(body.code ?? ""))) {
      return sendJson(res, 401, { error: "invalid code" });
    }
    pending2fa.delete(body.pendingToken);
    sendJson(res, 200, issueLogin(USER, req));
    return true;
  }

  if (req.method === "POST" && p === "/api/launcher/refresh") {
    const body = await readBody(req);
    const oldTok = refreshTokens.get(body.refreshToken);
    if (!oldTok) return sendJson(res, 401, { error: "bad refresh token" });
    sessions.delete(oldTok);
    refreshTokens.delete(body.refreshToken);
    sendJson(res, 200, issueLogin(USER, req));
    return true;
  }

  if (req.method === "GET" && p === "/api/launcher/expansions") {
    const realms = await cmsRealms();
    if (realms && realms.length > 0) {
      const expansions = realms.map((r) => ({
        id: r.id,
        name: r.expansion,
        version: r.version,
        tagline: `${r.realmType} · ${r.xpRate}`,
        enabled: r.enabled,
        realmId: r.realmId,
        realmlist: r.realmlist,
        realmName: r.name,
        executable: "Wow.exe",
        executable64: "Wow-64.exe",
        manifestUrl: `http://${req.headers.host}/manifests/cata.json`,
      }));
      return sendJson(res, 200, { expansions }) ?? true;
    }
    return sendJson(res, 200, {
      expansions: [
        {
          id: "cata",
          name: "Cataclysm",
          version: "4.3.4",
          tagline: "Deathwing's shattered world",
          enabled: true,
          manifestUrl: `http://${req.headers.host}/manifests/cata.json`,
        },
      ],
    }) ?? true;
  }

  if (req.method === "GET" && p === "/api/launcher/news") {
    const dbNews = await cmsNews(10);
    if (dbNews && dbNews.length > 0) return sendJson(res, 200, { news: dbNews }) ?? true;
    return sendJson(res, 200, { news: NEWS }) ?? true;
  }

  if (req.method === "GET" && p === "/api/launcher/server-status") {
    const live = await realmStatus();
    if (live) {
      return sendJson(res, 200, {
        online: live.online,
        population: live.population,
        uptimeHours: null,
        realm: live.realm,
        tps: null,
        address: live.address,
        port: live.port,
        gamebuild: live.gamebuild,
      }) ?? true;
    }
    return sendJson(res, 200, SERVER_STATUS) ?? true;
  }

  if (req.method === "GET" && p === "/api/launcher/changelog") {
    const rows = await cmsChangelog(10);
    return sendJson(res, 200, { changelog: rows ?? [] }) ?? true;
  }

  if (req.method === "GET" && p === "/api/launcher/vote-sites") {
    const rows = await cmsVoteSites();
    return sendJson(res, 200, { sites: rows ?? [] }) ?? true;
  }

  const voteRecord = p.match(/^\/api\/vote\/(\d+)\/record$/);
  if (req.method === "POST" && voteRecord) {
    if (!bearerUser(req)) {
      return sendJson(res, 401, { error: "not authenticated" }) ?? true;
    }
    const u = bearerUser(req);
    if (!u?.accountId) {
      return sendJson(res, 400, { error: "mock account cannot vote" }) ?? true;
    }
    const siteId = Number(voteRecord[1]);
    const ip = req.socket?.remoteAddress ?? "";
    const result = await cmsRecordVote(u.accountId, siteId, ip);
    if (!result) return sendJson(res, 500, { error: "db error" }) ?? true;
    return sendJson(res, 200, result) ?? true;
  }

  if (req.method === "GET" && p === "/api/account/points") {
    if (!bearerUser(req)) {
      return sendJson(res, 401, { error: "not authenticated" }) ?? true;
    }
    const u = bearerUser(req);
    const pts = u?.accountId ? await cmsAccountPoints(u.accountId) : null;
    return sendJson(res, 200, pts ?? { vote_points: 0, donation_points: 0, total_votes: 0 }) ?? true;
  }

  if (req.method === "GET" && p === "/api/launcher/shop") {
    const shop = await cmsShopItems();
    return sendJson(res, 200, shop ?? { categories: [], items: [] }) ?? true;
  }

  if (req.method === "GET" && p === "/api/calendar/events") {
    const events = await worldEvents(40);
    return sendJson(res, 200, { events: events ?? [] });
  }

  if (req.method === "GET" && p === "/api/launcher/version") {
    return sendJson(res, 200, { latest: "0.1.0", downloadUrl: null, notes: "You're running the latest build." }) ?? true;
  }

  // -- auth'd
  const user = bearerUser(req);
  const requireAuth = () => {
    if (user) return true;
    sendJson(res, 401, { error: "not authenticated" });
    return false;
  };

  if (req.method === "GET" && p === "/api/account/me") {
    if (!requireAuth()) return true;
    return sendJson(res, 200, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      has2fa: user.has2fa,
    }) ?? true;
  }

  if (req.method === "POST" && p === "/api/account/logout") {
    const auth = req.headers.authorization ?? "";
    if (auth.startsWith("Bearer ")) {
      const token = auth.slice(7);
      sessions.delete(token);
    }
    return sendJson(res, 200, { ok: true }) ?? true;
  }

  if (req.method === "POST" && p === "/api/account/2fa/enroll") {
    if (!requireAuth()) return true;
    const secret = crypto.randomBytes(10).toString("hex").toUpperCase();
    USER.totpSecret = secret;
    return sendJson(res, 200, {
      secret,
      otpauthUrl: `otpauth://totp/Starfall:${USER.username}?secret=${secret}&issuer=Starfall`,
      backupCodes: BACKUP_CODES,
    }) ?? true;
  }

  if (req.method === "POST" && p === "/api/account/2fa/verify") {
    if (!requireAuth()) return true;
    const body = await readBody(req);
    if (!/^\d{6}$/.test(String(body.code ?? ""))) {
      return sendJson(res, 400, { error: "invalid code format" });
    }
    USER.has2fa = true;
    return sendJson(res, 200, { enabled: true }) ?? true;
  }

  if (req.method === "POST" && p === "/api/account/2fa/disable") {
    if (!requireAuth()) return true;
    USER.has2fa = false;
    USER.totpSecret = null;
    return sendJson(res, 200, { enabled: false }) ?? true;
  }

  if (req.method === "GET" && p === "/api/account/sessions") {
    if (!requireAuth()) return true;
    return sendJson(res, 200, { sessions: sessionLog.slice(0, 20) }) ?? true;
  }

  if (req.method === "POST" && p === "/api/account/sessions/revoke-all") {
    if (!requireAuth()) return true;
    sessions.clear();
    refreshTokens.clear();
    return sendJson(res, 200, { ok: true }) ?? true;
  }

  if (req.method === "GET" && p === "/api/account/characters") {
    if (!requireAuth()) return true;
    if (user.accountId) {
      const rows = await charactersForAccount(user.accountId);
      if (rows && rows.length > 0) {
        return sendJson(res, 200, { characters: rows }) ?? true;
      }
    }
    return sendJson(res, 200, { characters: CHARACTERS }) ?? true;
  }

  if (req.method === "GET" && p === "/api/account/referral") {
    if (!requireAuth()) return true;
    return sendJson(res, 200, REFERRAL) ?? true;
  }

  if (req.method === "GET" && p === "/api/account/wishlist") {
    if (!requireAuth()) return true;
    const set = wishlists.get(user.username) ?? new Set();
    const items = [];
    for (const id of set) {
      const it = await itemById(Number(id));
      if (it) items.push(it);
      else {
        const stub = ITEM_DB.find((x) => x.id === id);
        if (stub) items.push(stub);
      }
    }
    return sendJson(res, 200, { items });
  }

  if (req.method === "POST" && p === "/api/account/wishlist") {
    if (!requireAuth()) return true;
    const body = await readBody(req);
    const id = Number(body.itemId);
    if (!Number.isFinite(id) || id <= 0) {
      return sendJson(res, 400, { error: "invalid itemId" });
    }
    const fromDb = await itemById(id);
    const fromFixture = ITEM_DB.find((x) => x.id === id);
    if (!fromDb && !fromFixture) {
      return sendJson(res, 404, { error: "item not found" });
    }
    const set = wishlists.get(user.username) ?? new Set();
    set.add(id);
    wishlists.set(user.username, set);
    return sendJson(res, 200, { ok: true });
  }

  const wmDel = p.match(/^\/api\/account\/wishlist\/(\d+)$/);
  if (req.method === "DELETE" && wmDel) {
    if (!requireAuth()) return true;
    const set = wishlists.get(user.username) ?? new Set();
    set.delete(Number(wmDel[1]));
    wishlists.set(user.username, set);
    return sendJson(res, 200, { ok: true }) ?? true;
  }

  // items (world DB)
  if (req.method === "GET" && p === "/api/items/search") {
    const q = url.searchParams.get("q") ?? "";
    const items = await itemSearch(q, 30);
    if (items !== null) return sendJson(res, 200, { items }) ?? true;
    const low = q.toLowerCase();
    const hits = low ? ITEM_DB.filter((it) => it.name.toLowerCase().includes(low)) : ITEM_DB;
    return sendJson(res, 200, { items: hits }) ?? true;
  }

  const itemOne = p.match(/^\/api\/items\/(\d+)$/);
  if (req.method === "GET" && itemOne) {
    const id = Number(itemOne[1]);
    const it = await itemById(id);
    if (it) return sendJson(res, 200, it) ?? true;
    return sendJson(res, 404, { error: "not found" }) ?? true;
  }

  const itemSourcesMatch = p.match(/^\/api\/items\/(\d+)\/sources$/);
  if (req.method === "GET" && itemSourcesMatch) {
    const srcs = ITEM_SOURCES[itemSourcesMatch[1]] ?? [];
    return sendJson(res, 200, { sources: srcs }) ?? true;
  }

  // armory
  const armory = p.match(/^\/api\/armory\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && armory) {
    const [, , name] = armory;
    const ch = CHARACTERS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!ch) return sendJson(res, 404, { error: "not found" });
    return sendJson(res, 200, { character: ch }) ?? true;
  }

  // guild
  const guild = p.match(/^\/api\/guild\/([^/]+)$/);
  if (req.method === "GET" && guild) {
    const key = guild[1];
    const dbg = await guildByKey(key);
    if (dbg) {
      return sendJson(res, 200, {
        name: dbg.name,
        motd: dbg.motd,
        memberCount: dbg.memberCount,
        onlineCount: dbg.onlineCount,
      }) ?? true;
    }
    const g = GUILDS[key];
    if (!g) return sendJson(res, 404, { error: "not found" });
    return sendJson(res, 200, {
      name: g.name,
      motd: g.motd,
      memberCount: g.memberCount,
      onlineCount: g.onlineCount,
    }) ?? true;
  }

  const guildEventsMatch = p.match(/^\/api\/guild\/([^/]+)\/events$/);
  if (req.method === "GET" && guildEventsMatch) {
    const key = guildEventsMatch[1];
    const dbg = await guildByKey(key);
    if (dbg) {
      const events = await guildEvents(dbg.guildid);
      return sendJson(res, 200, { events: events ?? [] }) ?? true;
    }
    const g = GUILDS[key];
    if (!g) return sendJson(res, 404, { error: "not found" });
    return sendJson(res, 200, { events: g.events }) ?? true;
  }

  // m+ (Starfall custom system)
  if (req.method === "GET" && p === "/api/mplus/affixes/current") {
    const live = await mplusWeeklyAffixes();
    if (live) {
      return sendJson(res, 200, {
        week: `week-${live.weekSeed}`,
        startTime: live.startTime,
        endTime: live.endTime,
        rotation: live.rotation.map((a) => ({
          id: a.id,
          name: a.name,
          icon: `affix-${a.id}`,
          description: "",
        })),
      }) ?? true;
    }
    return sendJson(res, 200, AFFIXES) ?? true;
  }
  if (req.method === "GET" && p === "/api/mplus/season") {
    const s = await currentSeason();
    if (!s) return sendJson(res, 200, { season: null }) ?? true;
    return sendJson(res, 200, {
      season: {
        seasonId: Number(s.seasonId),
        name: s.seasonName,
        startDate: s.startDate,
        endDate: s.endDate,
      },
    }) ?? true;
  }
  if (req.method === "GET" && p === "/api/mplus/dungeons") {
    const d = await mplusEnabledDungeons();
    return sendJson(res, 200, { dungeons: d ?? [] }) ?? true;
  }
  if (req.method === "GET" && p === "/api/mplus/leaderboard") {
    const season = await currentSeason();
    if (season) {
      const runs = await mplusLeaderboard(Number(season.seasonId), 100);
      if (runs) return sendJson(res, 200, { runs }) ?? true;
    }
    return sendJson(res, 200, { runs: MPLUS_LEADERBOARD }) ?? true;
  }
  const mplusChar = p.match(/^\/api\/mplus\/character\/(\d+)\/runs$/);
  if (req.method === "GET" && mplusChar) {
    const charId = Number(mplusChar[1]);
    const season = await currentSeason();
    if (season) {
      const runs = await mplusCharacterRuns(charId, Number(season.seasonId));
      if (runs !== null) return sendJson(res, 200, { runs }) ?? true;
    }
    return sendJson(res, 404, { error: "not found" }) ?? true;
  }
  const mplusWeekly = p.match(/^\/api\/mplus\/character\/(\d+)\/weekly$/);
  if (req.method === "GET" && mplusWeekly) {
    const charId = Number(mplusWeekly[1]);
    const affixes = await mplusWeeklyAffixes();
    const weekNumber = affixes ? affixes.weekSeed : 0;
    const prog = await mplusWeeklyProgress(charId, weekNumber);
    return sendJson(res, 200, prog ?? { runsCompleted: 0, highestKeyTimed: 0, cacheCollected: 0 }) ?? true;
  }

  // raids
  if (req.method === "GET" && p === "/api/raids/progression") {
    return sendJson(res, 200, { raids: RAIDS }) ?? true;
  }

  // tickets
  if (req.method === "POST" && p === "/api/support/tickets") {
    if (!requireAuth()) return true;
    const body = await readBody(req);
    const ticket = {
      id: `T-${1000 + tickets.length}`,
      title: String(body.title ?? "").slice(0, 200),
      category: String(body.category ?? "game"),
      description: String(body.description ?? "").slice(0, 5000),
      submittedAt: new Date().toISOString(),
      attachments: body.attachments ?? {},
    };
    tickets.unshift(ticket);
    return sendJson(res, 200, {
      id: ticket.id,
      url: `http://${req.headers.host}/support/${ticket.id}`,
    }) ?? true;
  }

  // shop SSO token
  if (req.method === "GET" && p === "/api/shop-sso") {
    if (!requireAuth()) return true;
    return sendJson(res, 200, {
      ssoToken: crypto.randomBytes(12).toString("hex"),
      url: `http://${req.headers.host}/shop`,
    }) ?? true;
  }

  // addon manifest
  if (req.method === "GET" && p === "/api/launcher/addons") {
    return sendJson(res, 200, { addons: ADDONS }) ?? true;
  }

  // embed pages (simple HTML for iframe demos)
  if (req.method === "GET" && p === "/shop") {
    return sendHtml(
      res,
      `<!doctype html><html><head><meta charset="utf-8"><title>Starfall Shop</title>
      <style>body{background:#0b0d12;color:#e6e6e6;font-family:system-ui;padding:2rem;max-width:720px;margin:0 auto}
      h1{color:#fbbf24}.row{display:flex;gap:1rem;margin:1rem 0;padding:1rem;background:#171a21;border-radius:8px;border:1px solid #262932}
      .price{margin-left:auto;color:#34d399}</style></head><body>
      <h1>Starfall Shop (mock)</h1>
      <div class="row">Name Change <span class="price">$14.99</span></div>
      <div class="row">Faction Change <span class="price">$29.99</span></div>
      <div class="row">Character Boost to 85 <span class="price">$39.99</span></div>
      <div class="row">Premium — 30 days <span class="price">$8.99</span></div>
      </body></html>`,
    ) ?? true;
  }

  if (req.method === "GET" && p.startsWith("/armory/")) {
    const name = p.slice("/armory/".length);
    const ch = CHARACTERS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const body = ch
      ? `<h1 style="color:#fbbf24">${ch.name}</h1>
         <div>${ch.race} ${ch.className} — Level ${ch.level}</div>
         <div>Item level: <b>${ch.itemLevel}</b></div>
         <div>Guild: ${ch.guild ?? "—"}</div>
         <div>Last played: ${ch.lastPlayed}</div>`
      : `<h1>Not found</h1>`;
    return sendHtml(
      res,
      `<!doctype html><html><head><meta charset="utf-8"><title>Armory — ${name}</title>
      <style>body{background:#0b0d12;color:#e6e6e6;font-family:system-ui;padding:2rem}</style>
      </head><body>${body}</body></html>`,
    ) ?? true;
  }

  return false; // not handled
}
