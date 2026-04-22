// TrinityCore 4.3.4 database integration.
// Connects to the real game DBs when available; falls back to mock fixtures
// if the DB is unreachable. This keeps the launcher developable without a DB
// while still showing real characters/guilds when one is running.

import mysql from "mysql2/promise";
import { verifyPassword } from "./srp6.js";

const CONFIG = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "ascent",
  authDb: process.env.MYSQL_AUTH_DB ?? "cata_auth",
  charsDb: process.env.MYSQL_CHARS_DB ?? "cata_chars",
  worldDb: process.env.MYSQL_WORLD_DB ?? "cata_herbs_ores",
  cmsDb: process.env.MYSQL_CMS_DB ?? "starfall_cms",
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

export async function findAccountForLogin(username, password) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, username, salt, verifier, email
       FROM \`${CONFIG.authDb}\`.account
       WHERE UPPER(username) = UPPER(?) LIMIT 1`,
      [username],
    );
    const acct = rows[0];
    if (!acct) return { notFound: true };
    if (!verifyPassword(acct.username, password, acct.salt, acct.verifier)) {
      return { badPassword: true };
    }
    return { account: { id: acct.id, username: acct.username, email: acct.email } };
  } catch (e) {
    console.warn("[db] findAccountForLogin:", e.message);
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

// --- live-server queries -------------------------------------------------

export async function realmStatus() {
  if (!dbEnabled()) return null;
  try {
    const [realms] = await pool.query(
      `SELECT id, name, address, port, population, gamebuild FROM \`${CONFIG.authDb}\`.realmlist ORDER BY id LIMIT 1`,
    );
    const realm = realms[0];
    if (!realm) return null;
    const [[{ n: online }]] = await pool.query(
      `SELECT COUNT(*) AS n FROM \`${CONFIG.charsDb}\`.characters WHERE online = 1`,
    );
    return {
      online: true, // auth DB doesn't expose worldserver heartbeat; default true when reachable
      population: Number(online),
      realm: realm.name,
      address: realm.address,
      port: Number(realm.port),
      gamebuild: Number(realm.gamebuild),
      popWeight: Number(realm.population),
    };
  } catch (e) {
    console.warn("[db] realmStatus:", e.message);
    return null;
  }
}

// --- CMS queries ---------------------------------------------------------

export async function cmsNews(limit = 10) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, title, excerpt, content, category, image_url, author_name, is_pinned, published_at
       FROM \`${CONFIG.cmsDb}\`.news
       WHERE is_published = 1
       ORDER BY is_pinned DESC, published_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      body: r.excerpt || String(r.content ?? "").slice(0, 400),
      date: String(r.published_at ?? "").slice(0, 10),
      tag: r.category,
      author: r.author_name,
      pinned: !!r.is_pinned,
      imageUrl: r.image_url,
    }));
  } catch (e) {
    console.warn("[db] cmsNews:", e.message);
    return null;
  }
}

export async function cmsRealms() {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, realm_id, display_name, realmlist, build_info, xp_rate, realm_type, expansion, is_default, sort_order
       FROM \`${CONFIG.cmsDb}\`.realm_config
       WHERE is_active = 1
       ORDER BY sort_order, id`,
    );
    return rows.map((r) => ({
      id: r.expansion.toLowerCase().replace(/\s+/g, "-"),
      realmId: Number(r.realm_id),
      name: r.display_name,
      expansion: r.expansion,
      version: r.build_info,
      xpRate: r.xp_rate,
      realmType: r.realm_type,
      realmlist: r.realmlist,
      isDefault: !!r.is_default,
      enabled: true,
    }));
  } catch (e) {
    console.warn("[db] cmsRealms:", e.message);
    return null;
  }
}

export async function cmsShopItems() {
  if (!dbEnabled()) return null;
  try {
    const cats = await q(
      `SELECT id, name, slug, icon, sort_order FROM \`${CONFIG.cmsDb}\`.shop_categories WHERE is_active = 1 ORDER BY sort_order, id`,
    );
    const items = await q(
      `SELECT id, category_id, name, description, image_url, item_entry, price_vp, price_dp, sort_order
       FROM \`${CONFIG.cmsDb}\`.shop_items
       WHERE is_active = 1
       ORDER BY sort_order, id`,
    );
    return {
      categories: cats.map((c) => ({
        id: Number(c.id),
        name: c.name,
        slug: c.slug,
        icon: c.icon,
      })),
      items: items.map((i) => ({
        id: Number(i.id),
        categoryId: Number(i.category_id),
        name: i.name,
        description: i.description,
        imageUrl: i.image_url,
        itemEntry: i.item_entry ? Number(i.item_entry) : null,
        priceVp: Number(i.price_vp),
        priceDp: Number(i.price_dp),
      })),
    };
  } catch (e) {
    console.warn("[db] cmsShopItems:", e.message);
    return null;
  }
}

export async function cmsChangelog(limit = 10) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, version, title, content, category, author_name, published_at
       FROM \`${CONFIG.cmsDb}\`.changelog
       WHERE is_published = 1
       ORDER BY published_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      version: r.version,
      title: r.title,
      content: r.content,
      category: r.category,
      author: r.author_name,
      date: String(r.published_at ?? "").slice(0, 10),
    }));
  } catch (e) {
    console.warn("[db] cmsChangelog:", e.message);
    return null;
  }
}

export async function cmsVoteSites() {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id, name, url, points_reward, cooldown_hours, image_url
       FROM \`${CONFIG.cmsDb}\`.vote_sites
       WHERE is_active = 1
       ORDER BY sort_order, id`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      url: r.url,
      pointsReward: Number(r.points_reward),
      cooldownHours: Number(r.cooldown_hours),
      imageUrl: r.image_url,
    }));
  } catch (e) {
    console.warn("[db] cmsVoteSites:", e.message);
    return null;
  }
}

export async function cmsAccountPoints(accountId) {
  if (!dbEnabled() || !accountId) return null;
  try {
    const rows = await q(
      `SELECT * FROM \`${CONFIG.cmsDb}\`.account_points WHERE account_id = ? LIMIT 1`,
      [accountId],
    );
    return rows[0] ?? { vote_points: 0, donation_points: 0 };
  } catch (e) {
    console.warn("[db] cmsAccountPoints:", e.message);
    return null;
  }
}

export async function shutdownDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
