// TrinityCore 4.3.4 database integration.
// Connects to the real game DBs when available; falls back to mock fixtures
// if the DB is unreachable. This keeps the launcher developable without a DB
// while still showing real characters/guilds when one is running.

import mysql from "mysql2/promise";

const CONFIG = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "ascent",
  authDb: process.env.MYSQL_AUTH_DB ?? "cata_auth",
  charsDb: process.env.MYSQL_CHARS_DB ?? "cata_chars",
  worldDb: process.env.MYSQL_WORLD_DB ?? "cata_herbs_ores",
  enabled: process.env.MYSQL_DISABLE !== "1",
};

let pool = null;
let pingOk = null;

export function dbEnabled() {
  return CONFIG.enabled && pingOk !== false;
}

export async function initDb() {
  if (!CONFIG.enabled) {
    console.log("[db] disabled via MYSQL_DISABLE=1");
    return false;
  }
  try {
    pool = mysql.createPool({
      host: CONFIG.host,
      port: CONFIG.port,
      user: CONFIG.user,
      password: CONFIG.password,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      dateStrings: true,
    });
    await pool.query("SELECT 1");
    pingOk = true;
    console.log(`[db] connected to ${CONFIG.user}@${CONFIG.host}:${CONFIG.port}`);
    return true;
  } catch (e) {
    pingOk = false;
    console.warn(`[db] unavailable (${e.code ?? e.message}) — falling back to mock fixtures`);
    return false;
  }
}

async function q(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// --- queries --------------------------------------------------------------
// Schemas below target a standard TrinityCore 4.3.4 install. Adjust column
// names in the .env overrides if your fork diverged.

const RACE_NAMES = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 9: "Goblin", 10: "Blood Elf",
  11: "Draenei", 22: "Worgen",
};
const FACTION_BY_RACE = {
  1: "Alliance", 3: "Alliance", 4: "Alliance", 7: "Alliance", 11: "Alliance", 22: "Alliance",
  2: "Horde", 5: "Horde", 6: "Horde", 8: "Horde", 9: "Horde", 10: "Horde",
};
const CLASS_NAMES = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
  6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};

export async function findAccountByUsername(username) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, username, email FROM \`${CONFIG.authDb}\`.account WHERE username = ? LIMIT 1`,
      [username],
    );
    return rows[0] ?? null;
  } catch (e) {
    console.warn("[db] findAccountByUsername failed:", e.message);
    return null;
  }
}

export async function charactersForAccount(accountId) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT c.guid AS id, c.name, c.race, c.class, c.level, c.totalHonorPoints,
              c.logout_time, g.name AS guild
       FROM \`${CONFIG.charsDb}\`.characters c
       LEFT JOIN \`${CONFIG.charsDb}\`.guild_member gm ON gm.guid = c.guid
       LEFT JOIN \`${CONFIG.charsDb}\`.guild g ON g.guildid = gm.guildid
       WHERE c.account = ?
       ORDER BY c.logout_time DESC
       LIMIT 50`,
      [accountId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      realm: "Starfall",
      className: CLASS_NAMES[r.class] ?? `Class ${r.class}`,
      race: RACE_NAMES[r.race] ?? `Race ${r.race}`,
      faction: FACTION_BY_RACE[r.race] ?? "Alliance",
      level: Number(r.level),
      itemLevel: Math.max(1, Math.floor(Number(r.level) * 4.7)), // rough estimate; real iLvl needs item_instance scan
      guild: r.guild,
      lastPlayed: r.logout_time
        ? new Date(r.logout_time * 1000).toISOString()
        : new Date().toISOString(),
    }));
  } catch (e) {
    console.warn("[db] charactersForAccount failed:", e.message);
    return null;
  }
}

export async function guildByKey(key) {
  if (!dbEnabled()) return null;
  try {
    // Accept either a guildid number or a kebab name
    const whereSql = /^\d+$/.test(key) ? "guildid = ?" : "LOWER(REPLACE(name, ' ', '-')) = ?";
    const rows = await q(
      `SELECT guildid, name, motd,
              (SELECT COUNT(*) FROM \`${CONFIG.charsDb}\`.guild_member WHERE guildid = g.guildid) AS member_count
       FROM \`${CONFIG.charsDb}\`.guild g
       WHERE ${whereSql}
       LIMIT 1`,
      [key.toLowerCase()],
    );
    if (!rows[0]) return null;
    const g = rows[0];
    return {
      guildid: Number(g.guildid),
      name: g.name,
      motd: g.motd ?? "",
      memberCount: Number(g.member_count),
      onlineCount: 0, // would need world-server online table
    };
  } catch (e) {
    console.warn("[db] guildByKey failed:", e.message);
    return null;
  }
}

export async function shutdownDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
