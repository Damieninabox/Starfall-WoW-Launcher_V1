// TrinityCore Cata 4.3.4 SRP6 verifier check.
// Compute v = g^x mod N where x = SHA1(salt || SHA1(UPPER(username):UPPER(password)))
// and compare to the stored `verifier` column in cata_auth.account.

import crypto from "node:crypto";

const N = BigInt("0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7");
const G = 7n;

function sha1(...bufs) {
  const h = crypto.createHash("sha1");
  for (const b of bufs) h.update(b);
  return h.digest();
}

function bytesToBigIntLE(buf) {
  let n = 0n;
  for (let i = buf.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(buf[i]);
  return n;
}

function bigIntToBytesLE(n, len) {
  const out = Buffer.alloc(len);
  let x = n;
  for (let i = 0; i < len; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function modExp(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

export function verifyPassword(username, password, salt, verifier) {
  if (!salt || !verifier) return false;
  const user = String(username ?? "").toUpperCase();
  const pass = String(password ?? "").toUpperCase();
  const h1 = sha1(Buffer.from(`${user}:${pass}`, "utf-8"));
  const h2 = sha1(salt, h1);
  const x = bytesToBigIntLE(h2);
  const v = modExp(G, x, N);
  const vBytes = bigIntToBytesLE(v, verifier.length);
  return crypto.timingSafeEqual(vBytes, verifier);
}
