// TrinityCore 4.3.4 database integration.
// Connects to the real game DBs when available; falls back to mock fixtures
// if the DB is unreachable. This keeps the launcher developable without a DB
// while still showing real characters/guilds when one is running.

import mysql from "mysql2/promise";
import net from "node:net";
import { verifyPassword } from "./srp6.js";

// Short TCP connect probe — used to see whether the worldserver is actually up
// on the realm's address:port. The auth DB doesn't track world-server
// heartbeats, so this is the authoritative signal for "is the realm online".
function tcpProbe(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    try {
      sock.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

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
      `SELECT c.guid AS id, c.name, c.race, c.class, c.gender, c.level, c.money,
              c.totalHonorPoints, c.totalKills, c.zone, c.totaltime, c.online,
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
      gender: Number(r.gender) === 1 ? "Female" : "Male",
      faction: FACTION_BY_RACE[r.race] ?? "Alliance",
      level: Number(r.level),
      money: Number(r.money),
      // TrinityCore stores honor in hundredths (e.g. 18.75 honor = 1875 stored)
      honorPoints: Math.floor(Number(r.totalHonorPoints ?? 0) / 100),
      totalKills: Number(r.totalKills ?? 0),
      zoneId: Number(r.zone ?? 0),
      totalPlayedSec: Number(r.totaltime ?? 0),
      online: Number(r.online) === 1,
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
    // Probe the worldserver port directly — the auth DB only records realm
    // config, not liveness. If the server process is down, nothing in the DB
    // will flip; only a TCP probe tells the truth.
    const probeHost = realm.address === "127.0.0.1" || realm.address === "0.0.0.0"
      ? "127.0.0.1"
      : realm.address;
    const worldOnline = await tcpProbe(probeHost, Number(realm.port));
    return {
      online: worldOnline,
      population: worldOnline ? Number(online) : 0,
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

// --- custom Mythic+ ------------------------------------------------------

// Cata dungeon map id -> display name. Only the ones enabled in
// mythic_dungeon_config will show up in the UI.
const DUNGEON_NAMES = {
  33: "Shadowfang Keep",
  643: "Throne of the Tides",
  644: "Halls of Origination",
  645: "Blackrock Caverns",
  657: "The Vortex Pinnacle",
  725: "The Stonecore",
  754: "Grim Batol",
  755: "Lost City of the Tol'vir",
  859: "Zul'Gurub",
  938: "End Time",
  939: "Well of Eternity",
  940: "Hour of Twilight",
  967: "Zul'Aman",
};
function dungeonName(id) {
  return DUNGEON_NAMES[id] ?? `Map #${id}`;
}
function formatTimeMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

export async function currentSeason() {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT seasonId, seasonName, startDate, endDate, active
       FROM \`${CONFIG.worldDb}\`.mythic_rating_seasons
       WHERE active = 1 ORDER BY seasonId DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  } catch (e) { console.warn("[db] currentSeason:", e.message); return null; }
}

export async function mplusWeeklyAffixes() {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT weekSeed, startTime, endTime,
              affix1Id, affix1Name, affix2Id, affix2Name, affix3Id, affix3Name
       FROM \`${CONFIG.charsDb}\`.mythic_weekly_affixes
       WHERE startTime <= NOW() AND endTime > NOW()
       ORDER BY startTime DESC LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      weekSeed: Number(row.weekSeed),
      startTime: row.startTime,
      endTime: row.endTime,
      rotation: [
        { id: Number(row.affix1Id), name: row.affix1Name },
        { id: Number(row.affix2Id), name: row.affix2Name },
        { id: Number(row.affix3Id), name: row.affix3Name },
      ].filter((a) => a.id > 0),
    };
  } catch (e) { console.warn("[db] mplusWeeklyAffixes:", e.message); return null; }
}

export async function mplusLeaderboard(seasonId, limit = 100) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT r.characterGuid AS guid, r.mapId, r.bestScore, r.bestKeyLevel,
              r.bestTimeMs, r.timeLimitMs, c.name, c.class, c.race
       FROM \`${CONFIG.charsDb}\`.character_mythic_rating r
       JOIN \`${CONFIG.charsDb}\`.characters c ON c.guid = r.characterGuid
       WHERE r.seasonId = ?
       ORDER BY r.bestScore DESC
       LIMIT ?`,
      [seasonId, limit],
    );
    return rows.map((r) => ({
      guid: Number(r.guid),
      name: r.name,
      className: CLASS_NAMES[r.class] ?? `Class ${r.class}`,
      race: RACE_NAMES[r.race] ?? `Race ${r.race}`,
      dungeon: dungeonName(Number(r.mapId)),
      mapId: Number(r.mapId),
      score: Number(r.bestScore),
      keyLevel: Number(r.bestKeyLevel),
      timer: formatTimeMs(Number(r.bestTimeMs)),
      inTime: Number(r.bestTimeMs) <= Number(r.timeLimitMs),
    }));
  } catch (e) { console.warn("[db] mplusLeaderboard:", e.message); return null; }
}

export async function mplusCharacterRuns(guid, seasonId) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT mapId, bestScore, bestKeyLevel, bestTimeMs, timeLimitMs, updatedAt
       FROM \`${CONFIG.charsDb}\`.character_mythic_rating
       WHERE characterGuid = ? AND seasonId = ?
       ORDER BY bestScore DESC`,
      [guid, seasonId],
    );
    return rows.map((r) => ({
      dungeon: dungeonName(Number(r.mapId)),
      mapId: Number(r.mapId),
      score: Number(r.bestScore),
      keyLevel: Number(r.bestKeyLevel),
      timer: formatTimeMs(Number(r.bestTimeMs)),
      inTime: Number(r.bestTimeMs) <= Number(r.timeLimitMs),
      updatedAt: r.updatedAt,
    }));
  } catch (e) { console.warn("[db] mplusCharacterRuns:", e.message); return null; }
}

export async function mplusWeeklyProgress(guid, weekNumber) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT runsCompleted, highestKeyTimed, cacheCollected
       FROM \`${CONFIG.charsDb}\`.character_mythic_weekly
       WHERE characterGuid = ? AND weekNumber = ?`,
      [guid, weekNumber],
    );
    return rows[0] ?? { runsCompleted: 0, highestKeyTimed: 0, cacheCollected: 0 };
  } catch (e) { console.warn("[db] mplusWeeklyProgress:", e.message); return null; }
}

export async function mplusEnabledDungeons() {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT mapId, timeLimitSeconds FROM \`${CONFIG.worldDb}\`.mythic_dungeon_config WHERE enabled = 1`,
    );
    return rows.map((r) => ({
      mapId: Number(r.mapId),
      name: dungeonName(Number(r.mapId)),
      timeLimitSec: Number(r.timeLimitSeconds),
    }));
  } catch (e) { console.warn("[db] mplusEnabledDungeons:", e.message); return null; }
}

// --- items (world DB) ----------------------------------------------------

const INV_TYPE = {
  0: "—", 1: "Head", 2: "Neck", 3: "Shoulder", 4: "Shirt", 5: "Chest",
  6: "Waist", 7: "Legs", 8: "Feet", 9: "Wrist", 10: "Hands",
  11: "Finger", 12: "Trinket", 13: "1H Weapon", 14: "Shield", 15: "Ranged",
  16: "Cloak", 17: "2H Weapon", 18: "Bag", 19: "Tabard", 20: "Chest",
  21: "Main Hand", 22: "Off Hand", 23: "Held", 24: "Ammo", 25: "Thrown",
  26: "Ranged", 27: "Quiver", 28: "Relic",
};

function mapItemRow(r) {
  return {
    id: Number(r.id),
    name: r.name,
    icon: r.icon_name ?? null,
    iconUrl: r.icon_name
      ? `https://wow.zamimg.com/images/wow/icons/large/${r.icon_name}.jpg`
      : null,
    quality: Number(r.quality),
    ilvl: Number(r.ilvl),
    type: INV_TYPE[Number(r.invType)] ?? "—",
    setId: null,
  };
}

// TrinityCore's item_template has displayid (an MPQ/DBC model reference) but
// no icon_name column — icons live in the client DBCs. We lazily resolve them
// via Wowhead's tooltip JSON and cache the result in item_icon_cache so each
// entry is only fetched once.
async function populateMissingIcons(rows) {
  const missing = rows.filter(r => !r.icon_name).map(r => Number(r.id));
  if (missing.length === 0) return rows;
  const resolved = new Map();
  const CONCURRENCY = 8;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (entry) => {
      try {
        const resp = await fetch(
          `https://nether.wowhead.com/tooltip/item/${entry}?dataEnv=1&locale=0`,
          { signal: AbortSignal.timeout(3000) },
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const icon = typeof data?.icon === "string" ? data.icon : null;
        if (!icon) return;
        resolved.set(entry, icon);
      } catch { /* ignore — leave icon null */ }
    }));
  }
  if (resolved.size > 0) {
    const values = [...resolved.entries()].flat();
    const placeholders = [...resolved].map(() => "(?, ?)").join(",");
    try {
      await pool.query(
        `INSERT IGNORE INTO \`${CONFIG.cmsDb}\`.item_icon_cache (item_entry, icon_name) VALUES ${placeholders}`,
        values,
      );
    } catch (e) { console.warn("[db] item_icon_cache write:", e.message); }
  }
  return rows.map(r => {
    if (r.icon_name) return r;
    const icon = resolved.get(Number(r.id));
    return icon ? { ...r, icon_name: icon } : r;
  });
}

export async function itemSearch(queryStr, limit = 30) {
  if (!dbEnabled()) return null;
  const needle = String(queryStr ?? "").trim();
  if (needle.length < 2) return [];
  try {
    const [rows] = await pool.query(
      `SELECT it.entry AS id, it.name, it.Quality AS quality, it.ItemLevel AS ilvl,
              it.InventoryType AS invType, ic.icon_name
       FROM \`${CONFIG.worldDb}\`.item_template it
       LEFT JOIN \`${CONFIG.cmsDb}\`.item_icon_cache ic ON ic.item_entry = it.entry
       WHERE it.Quality >= 2 AND it.name LIKE ?
       ORDER BY it.ItemLevel DESC, it.name ASC
       LIMIT ?`,
      [`%${needle}%`, limit],
    );
    const hydrated = await populateMissingIcons(rows);
    return hydrated.map(mapItemRow);
  } catch (e) { console.warn("[db] itemSearch:", e.message); return null; }
}

export async function itemById(id) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT it.entry AS id, it.name, it.Quality AS quality, it.ItemLevel AS ilvl,
              it.InventoryType AS invType, ic.icon_name
       FROM \`${CONFIG.worldDb}\`.item_template it
       LEFT JOIN \`${CONFIG.cmsDb}\`.item_icon_cache ic ON ic.item_entry = it.entry
       WHERE it.entry = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const [hydrated] = await populateMissingIcons(rows);
    return mapItemRow(hydrated);
  } catch (e) { console.warn("[db] itemById:", e.message); return null; }
}

// --- votes / points ------------------------------------------------------

export async function cmsVoteSitesAll() {
  return cmsVoteSites();
}

export async function cmsRecordVote(accountId, siteId, ip) {
  if (!dbEnabled() || !accountId) return null;
  try {
    const [site] = await pool.query(
      `SELECT id, points_reward, cooldown_hours FROM \`${CONFIG.cmsDb}\`.vote_sites WHERE id = ? AND is_active = 1 LIMIT 1`,
      [siteId],
    );
    const s = site[0];
    if (!s) return { error: "site not found" };
    // Cooldown check: last vote for this account+site
    const [last] = await pool.query(
      `SELECT voted_at FROM \`${CONFIG.cmsDb}\`.vote_log
       WHERE account_id = ? AND site_id = ?
       ORDER BY voted_at DESC LIMIT 1`,
      [accountId, siteId],
    );
    if (last[0]) {
      const since = Date.now() - new Date(last[0].voted_at).getTime();
      const cooldownMs = Number(s.cooldown_hours) * 3600 * 1000;
      if (since < cooldownMs) {
        return { error: "cooldown", nextVoteMs: cooldownMs - since };
      }
    }
    await pool.query(
      `INSERT INTO \`${CONFIG.cmsDb}\`.vote_log (account_id, site_id, points_awarded, ip_address, voted_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [accountId, siteId, s.points_reward, ip ?? ""],
    );
    await pool.query(
      `INSERT INTO \`${CONFIG.cmsDb}\`.account_points (account_id, vote_points, donation_points, total_votes, total_donated_usd, updated_at)
       VALUES (?, ?, 0, 1, 0, NOW())
       ON DUPLICATE KEY UPDATE vote_points = vote_points + VALUES(vote_points),
                               total_votes = total_votes + 1,
                               updated_at = NOW()`,
      [accountId, s.points_reward],
    );
    return { ok: true, pointsAwarded: Number(s.points_reward) };
  } catch (e) { console.warn("[db] cmsRecordVote:", e.message); return null; }
}

// --- guild events --------------------------------------------------------

export async function guildEvents(guildId) {
  if (!dbEnabled()) return null;
  try {
    // calendar_events creator is a character GUID; join to guild_member for the creator's guild.
    const rows = await q(
      `SELECT DISTINCT ce.id, ce.title, ce.description, ce.type, ce.dungeon, ce.eventtime
       FROM \`${CONFIG.charsDb}\`.calendar_events ce
       JOIN \`${CONFIG.charsDb}\`.guild_member gm ON gm.guid = ce.creator
       WHERE gm.guildid = ? AND ce.eventtime > UNIX_TIMESTAMP()
       ORDER BY ce.eventtime ASC
       LIMIT 20`,
      [guildId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title ?? "(untitled)",
      description: r.description ?? "",
      kind: Number(r.type) === 4 ? "raid" : "social",
      when: new Date(Number(r.eventtime) * 1000).toISOString(),
    }));
  } catch (e) { console.warn("[db] guildEvents:", e.message); return null; }
}

// --- in-game calendar ----------------------------------------------------

// Holiday metadata mirroring Holidays.dbc + SharedDefines.h constants. The
// DBC itself isn't in the MySQL tables; holiday_dates just overrides the
// Date[] array. Name and default duration come from this table; when
// holiday_dates.holiday_duration is non-zero it wins.
// Duration is in minutes (Blizzard default per-holiday "Duration[0]" value).
const HOLIDAYS = {
  62:  { name: "Fireworks Spectacular",       durationMin: 60 },
  141: { name: "Feast of Winter Veil",        durationMin: 24240 }, // 17 days
  181: { name: "Noblegarden",                 durationMin: 10080 }, // 7 days
  201: { name: "Children's Week",             durationMin: 10080 }, // 7 days
  283: { name: "Call to Arms: Alterac Valley",durationMin: 5760 },  // 4 days
  284: { name: "Call to Arms: Warsong Gulch", durationMin: 5760 },
  285: { name: "Call to Arms: Arathi Basin",  durationMin: 5760 },
  301: { name: "Stranglethorn Fishing Extravaganza", durationMin: 180 },
  321: { name: "Harvest Festival",            durationMin: 10080 },
  324: { name: "Hallow's End",                durationMin: 20160 }, // 14 days
  327: { name: "Lunar Festival",              durationMin: 20160 }, // 14 days
  335: { name: "Love is in the Air",          durationMin: 20160 }, // legacy id
  341: { name: "Midsummer Fire Festival",     durationMin: 20160 }, // 14 days
  353: { name: "Call to Arms: Eye of the Storm", durationMin: 5760 },
  372: { name: "Brewfest",                    durationMin: 20160 }, // 14 days
  374: { name: "Darkmoon Faire (Elwynn)",     durationMin: 10080 }, // 7 days
  375: { name: "Darkmoon Faire (Mulgore)",    durationMin: 10080 },
  376: { name: "Darkmoon Faire (Shattrath)",  durationMin: 10080 },
  398: { name: "Pirates' Day",                durationMin: 1440 },  // 1 day
  400: { name: "Call to Arms: Strand of the Ancients", durationMin: 5760 },
  404: { name: "Pilgrim's Bounty",            durationMin: 10080 },
  406: { name: "Wrath Launch",                durationMin: 1440 },
  409: { name: "Day of the Dead",             durationMin: 2880 },  // 2 days
  420: { name: "Call to Arms: Isle of Conquest", durationMin: 5760 },
  423: { name: "Love is in the Air",          durationMin: 10080 }, // 7 days
  424: { name: "Kalu'ak Fishing Derby",       durationMin: 60 },
  435: { name: "Call to Arms: Battle for Gilneas", durationMin: 5760 },
  436: { name: "Call to Arms: Twin Peaks",    durationMin: 5760 },
  479: { name: "Darkmoon Faire (Terokkar)",   durationMin: 10080 },
};

// Decode TC's AppendPackedTime format (see ByteBuffer.cpp):
//   bits 0-5  : minute
//   bits 6-10 : hour
//   bits 11-13: weekday (ignored on decode)
//   bits 14-19: day-of-month (0-indexed -> +1)
//   bits 20-23: month (0-indexed)
//   bits 24-28: year offset (-> year = offset + 2000)
function decodePackedDate(v) {
  const minute = v & 0x3F;
  const hour = (v >> 6) & 0x1F;
  const day = ((v >> 14) & 0x3F) + 1;
  const month = (v >> 20) & 0xF;
  const year = ((v >> 24) & 0x1F) + 2000;
  // The server packed using localtime, but without knowing the server TZ we
  // construct a UTC date. Players in other timezones see a small shift.
  return Date.UTC(year, month, day, hour, minute);
}

// Darkmoon Faire ran in three locations pre-Cata (Elwynn / Mulgore / Shattrath)
// rotating monthly. holiday_dates stores them as three separate ids but they
// really represent one rolling "Darkmoon Faire" event. Merge them in the UI.
const DARKMOON_IDS = new Set([374, 375, 376]);
const DARKMOON_LOCATION = { 374: "Elwynn Forest", 375: "Mulgore", 376: "Shattrath" };

export async function worldEvents(limit = 40) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT id AS holidayId, date_id, date_value, holiday_duration
       FROM \`${CONFIG.worldDb}\`.holiday_dates
       ORDER BY id, date_id`,
    );
    const now = Date.now();
    const out = [];
    for (const row of rows) {
      const hid = Number(row.holidayId);
      const meta = HOLIDAYS[hid];
      const startMs = decodePackedDate(Number(row.date_value));
      const perRowDurMin = Number(row.holiday_duration ?? 0);
      const durMin = perRowDurMin > 0 ? perRowDurMin : (meta?.durationMin ?? 1440);
      const endMs = startMs + durMin * 60_000;

      if (endMs < now) continue; // past, skip

      const isDmf = DARKMOON_IDS.has(hid);
      out.push({
        id: hid * 100 + Number(row.date_id),
        title: isDmf ? "Darkmoon Faire" : (meta?.name ?? `Holiday #${hid}`),
        subtitle: isDmf ? DARKMOON_LOCATION[hid] : null,
        holidayId: hid,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        active: now >= startMs && now < endMs,
        recurs: true,
        occurrenceMin: 525600,
        lengthMin: durMin,
      });
    }
    // Active first (ending soonest), then upcoming (starting soonest).
    out.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const key = a.active ? "end" : "start";
      return new Date(a[key]).getTime() - new Date(b[key]).getTime();
    });
    return out.slice(0, limit);
  } catch (e) {
    console.warn("[db] worldEvents:", e.message);
    return null;
  }
}

// --- item sources (world DB) --------------------------------------------

export async function itemSources(itemEntry) {
  if (!dbEnabled()) return null;
  try {
    const sources = [];
    // Creature drops
    const drops = await q(
      `SELECT ct.entry, ct.name, ct.minlevel, ct.maxlevel, ct.rank,
              clt.ChanceOrQuestChance AS chance
       FROM \`${CONFIG.worldDb}\`.creature_loot_template clt
       JOIN \`${CONFIG.worldDb}\`.creature_template ct ON ct.lootid = clt.entry
       WHERE clt.item = ?
       ORDER BY ct.rank DESC, ct.maxlevel DESC
       LIMIT 20`,
      [itemEntry],
    );
    for (const r of drops) {
      sources.push({
        type: Number(r.rank) >= 3 ? "boss" : "mob",
        name: r.name,
        zone: `Lv ${r.minlevel}-${r.maxlevel}`,
        dropChance: Number(r.chance) > 0 ? Number(r.chance) : null,
      });
    }
    // Vendors
    const vendors = await q(
      `SELECT DISTINCT ct.entry, ct.name, ct.minlevel
       FROM \`${CONFIG.worldDb}\`.npc_vendor nv
       JOIN \`${CONFIG.worldDb}\`.creature_template ct ON ct.entry = nv.entry
       WHERE nv.item = ?
       LIMIT 5`,
      [itemEntry],
    );
    for (const r of vendors) {
      sources.push({
        type: "vendor",
        name: r.name,
        zone: `Lv ${r.minlevel ?? "?"}`,
        dropChance: null,
      });
    }
    return sources;
  } catch (e) {
    console.warn("[db] itemSources:", e.message);
    return null;
  }
}

// --- Arena leaderboards -------------------------------------------------

const ARENA_BRACKETS = { 2: "2v2", 3: "3v3", 5: "5v5" };

export async function arenaLeaderboard(bracketType, limit = 100) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT at.arenaTeamId, at.name, at.rating, at.seasonGames,
              at.seasonWins, at.rank, at.type
       FROM \`${CONFIG.charsDb}\`.arena_team at
       WHERE at.type = ?
       ORDER BY at.rating DESC, at.seasonWins DESC
       LIMIT ?`,
      [bracketType, limit],
    );
    if (rows.length === 0) return [];
    const teamIds = rows.map((r) => Number(r.arenaTeamId));
    const members = await q(
      `SELECT atm.arenaTeamId, atm.guid, atm.personalRating,
              c.name, c.class, c.race
       FROM \`${CONFIG.charsDb}\`.arena_team_member atm
       JOIN \`${CONFIG.charsDb}\`.characters c ON c.guid = atm.guid
       WHERE atm.arenaTeamId IN (?)`,
      [teamIds],
    );
    const memberByTeam = new Map();
    for (const m of members) {
      const tid = Number(m.arenaTeamId);
      if (!memberByTeam.has(tid)) memberByTeam.set(tid, []);
      memberByTeam.get(tid).push({
        guid: Number(m.guid),
        name: m.name,
        className: CLASS_NAMES[m.class] ?? `Class ${m.class}`,
        race: RACE_NAMES[m.race] ?? `Race ${m.race}`,
        personalRating: Number(m.personalRating),
      });
    }
    return rows.map((r) => {
      const games = Number(r.seasonGames);
      const wins = Number(r.seasonWins);
      return {
        teamId: Number(r.arenaTeamId),
        name: r.name,
        bracket: ARENA_BRACKETS[Number(r.type)] ?? `${r.type}v${r.type}`,
        rating: Number(r.rating),
        seasonGames: games,
        seasonWins: wins,
        winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
        rank: Number(r.rank),
        members: memberByTeam.get(Number(r.arenaTeamId)) ?? [],
      };
    });
  } catch (e) {
    console.warn("[db] arenaLeaderboard:", e.message);
    return null;
  }
}

// --- site settings + admin ----------------------------------------------

const DEFAULT_SETTINGS = {
  admin_usernames: { value: "ELETHERYA", type: "string", category: "launcher", label: "Admin usernames", description: "Comma-separated list of account usernames with admin access to the launcher panel." },
  current_patch: { value: "4.3.4", type: "string", category: "launcher", label: "Current content patch", description: "Currently active content patch (4.0.6, 4.1, 4.2, 4.3.4). Filters raid progression and other content." },
};

export async function seedLauncherSettings() {
  if (!dbEnabled()) return;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    try {
      await pool.query(
        `INSERT IGNORE INTO \`${CONFIG.cmsDb}\`.site_settings
         (\`key\`, value, type, category, label, description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [key, def.value, def.type, def.category, def.label, def.description],
      );
    } catch (e) { console.warn(`[db] seed setting ${key}:`, e.message); }
  }
}

export async function getSetting(key) {
  if (!dbEnabled()) return DEFAULT_SETTINGS[key]?.value ?? null;
  try {
    const rows = await q(
      `SELECT value FROM \`${CONFIG.cmsDb}\`.site_settings WHERE \`key\` = ? LIMIT 1`,
      [key],
    );
    return rows[0]?.value ?? DEFAULT_SETTINGS[key]?.value ?? null;
  } catch (e) { console.warn("[db] getSetting:", e.message); return null; }
}

export async function getAllSettings() {
  if (!dbEnabled()) return null;
  try {
    return await q(
      `SELECT \`key\`, value, type, category, label, description, updated_at
       FROM \`${CONFIG.cmsDb}\`.site_settings
       ORDER BY category, \`key\``,
    );
  } catch (e) { console.warn("[db] getAllSettings:", e.message); return null; }
}

export async function setSetting(key, value) {
  if (!dbEnabled()) return null;
  try {
    const [existing] = await pool.query(
      `SELECT \`key\` FROM \`${CONFIG.cmsDb}\`.site_settings WHERE \`key\` = ? LIMIT 1`,
      [key],
    );
    if (existing.length === 0) {
      const def = DEFAULT_SETTINGS[key];
      if (!def) return { error: "unknown setting" };
      await pool.query(
        `INSERT INTO \`${CONFIG.cmsDb}\`.site_settings
         (\`key\`, value, type, category, label, description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [key, String(value), def.type, def.category, def.label, def.description],
      );
    } else {
      await pool.query(
        `UPDATE \`${CONFIG.cmsDb}\`.site_settings
         SET value = ?, updated_at = NOW() WHERE \`key\` = ?`,
        [String(value), key],
      );
    }
    return { ok: true };
  } catch (e) { console.warn("[db] setSetting:", e.message); return null; }
}

export async function isAdminUsername(username) {
  if (!username) return false;
  const raw = await getSetting("admin_usernames");
  if (!raw) return false;
  const admins = String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return admins.includes(String(username).toUpperCase());
}

// --- raid progression ---------------------------------------------------

// Cata raid achievement IDs → (raid, tier, boss, order).
// The "boss kill" achievements live in character_achievement. First to get
// each gives us the first-kill date + character; join guild_member to
// attribute the kill to a guild.
const CATA_RAIDS = [
  {
    raid: "Blackwing Descent", tier: "T11", patch: "4.0.6", order: 1,
    bosses: [
      { name: "Magmaw", achievementId: 4846 },
      { name: "Omnotron Defense System", achievementId: 4847 },
      { name: "Maloriak", achievementId: 4848 },
      { name: "Atramedes", achievementId: 4849 },
      { name: "Chimaeron", achievementId: 4850 },
      { name: "Nefarian", achievementId: 4852 },
    ],
  },
  {
    raid: "The Bastion of Twilight", tier: "T11", patch: "4.0.6", order: 2,
    bosses: [
      { name: "Halfus Wyrmbreaker", achievementId: 4839 },
      { name: "Valiona & Theralion", achievementId: 4840 },
      { name: "Ascendant Council", achievementId: 4841 },
      { name: "Cho'gall", achievementId: 4842 },
      { name: "Sinestra", achievementId: 5293 },
    ],
  },
  {
    raid: "Throne of the Four Winds", tier: "T11", patch: "4.0.6", order: 3,
    bosses: [
      { name: "Conclave of Wind", achievementId: 4844 },
      { name: "Al'Akir", achievementId: 4845 },
    ],
  },
  {
    raid: "Firelands", tier: "T12", patch: "4.2", order: 4,
    bosses: [
      { name: "Beth'tilac", achievementId: 5809 },
      { name: "Lord Rhyolith", achievementId: 5805 },
      { name: "Alysrazor", achievementId: 5808 },
      { name: "Shannox", achievementId: 5807 },
      { name: "Baleroc", achievementId: 5811 },
      { name: "Majordomo Staghelm", achievementId: 5810 },
      { name: "Ragnaros", achievementId: 5816 },
    ],
  },
  {
    raid: "Dragon Soul", tier: "T13", patch: "4.3.4", order: 5,
    bosses: [
      { name: "Morchok", achievementId: 6108 },
      { name: "Warlord Zon'ozz", achievementId: 6160 },
      { name: "Yor'sahj the Unsleeping", achievementId: 6164 },
      { name: "Hagara the Stormbinder", achievementId: 6161 },
      { name: "Ultraxion", achievementId: 6162 },
      { name: "Warmaster Blackhorn", achievementId: 6163 },
      { name: "Spine of Deathwing", achievementId: 6076 },
      { name: "Madness of Deathwing", achievementId: 6174 },
    ],
  },
];

const PATCH_ORDER = ["4.0.6", "4.1", "4.2", "4.3.4"];

export async function raidProgression(currentPatch = "4.3.4") {
  if (!dbEnabled()) return null;
  try {
    const allBossIds = CATA_RAIDS.flatMap((r) => r.bosses.map((b) => b.achievementId));
    // Two-step: find first-kill (achievement, MIN(date)) per boss, then join
    // character + guild for details. Avoids ONLY_FULL_GROUP_BY violations
    // from selecting c.name / g.name alongside a MIN aggregate.
    const [rows] = await pool.query(
      `SELECT fk.achievement, fk.first_date, c.name AS first_char, g.name AS first_guild
       FROM (
         SELECT achievement, MIN(date) AS first_date
         FROM \`${CONFIG.charsDb}\`.character_achievement
         WHERE achievement IN (?)
         GROUP BY achievement
       ) fk
       JOIN \`${CONFIG.charsDb}\`.character_achievement ca
         ON ca.achievement = fk.achievement AND ca.date = fk.first_date
       JOIN \`${CONFIG.charsDb}\`.characters c ON c.guid = ca.guid
       LEFT JOIN \`${CONFIG.charsDb}\`.guild_member gm ON gm.guid = c.guid
       LEFT JOIN \`${CONFIG.charsDb}\`.guild g ON g.guildid = gm.guildid
       GROUP BY fk.achievement, fk.first_date, c.name, g.name`,
      [allBossIds],
    );
    const firstKills = new Map();
    for (const r of rows) {
      firstKills.set(Number(r.achievement), {
        date: new Date(Number(r.first_date) * 1000).toISOString().slice(0, 10),
        guild: r.first_guild,
        character: r.first_char,
      });
    }

    const maxIdx = PATCH_ORDER.indexOf(currentPatch);
    const cutoffIdx = maxIdx < 0 ? PATCH_ORDER.length - 1 : maxIdx;

    return CATA_RAIDS.filter((r) => {
      const rp = PATCH_ORDER.indexOf(r.patch);
      return rp <= cutoffIdx;
    }).map((r) => ({
      raid: r.raid,
      tier: r.tier,
      patch: r.patch,
      bosses: r.bosses.map((b) => {
        const fk = firstKills.get(b.achievementId);
        return {
          name: b.name,
          killed: !!fk,
          firstKillGuild: fk?.guild ?? null,
          firstKillDate: fk?.date ?? null,
          firstKillCharacter: fk?.character ?? null,
        };
      }),
    }));
  } catch (e) { console.warn("[db] raidProgression:", e.message); return null; }
}

// --- top guilds ----------------------------------------------------------

export async function topGuilds(limit = 4) {
  if (!dbEnabled()) return null;
  try {
    return await q(
      `SELECT g.guildid, g.name, g.motd,
              (SELECT COUNT(*) FROM \`${CONFIG.charsDb}\`.guild_member WHERE guildid = g.guildid) AS member_count
       FROM \`${CONFIG.charsDb}\`.guild g
       ORDER BY member_count DESC, g.guildid ASC
       LIMIT ?`,
      [limit],
    );
  } catch (e) { console.warn("[db] topGuilds:", e.message); return null; }
}

export async function shutdownDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
