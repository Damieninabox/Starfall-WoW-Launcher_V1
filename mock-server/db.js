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
      honorPoints: Number(r.totalHonorPoints ?? 0),
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

// --- custom Mythic+ ------------------------------------------------------

// Cata dungeon map id -> display name. Only the ones enabled in
// mythic_dungeon_config will show up in the UI.
const DUNGEON_NAMES = {
  33: "Shadowfang Keep",
  36: "Deadmines",
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
    return rows.map(mapItemRow);
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
    return rows[0] ? mapItemRow(rows[0]) : null;
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

// Compute the next occurrence of a recurring game_event row.
// TC's `occurence` is the repeat period in minutes (0 == one-shot);
// `length` is the active duration in minutes; `start_time`/`end_time`
// bracket the valid window.
function nextOccurrence(row, now) {
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  const occurMin = Number(row.occurence ?? 0);
  const lenMin = Number(row.length ?? 0);
  const lenMs = lenMin * 60_000;

  if (!Number.isFinite(start)) return null;
  if (now > end) return null;

  if (occurMin === 0) {
    return {
      start,
      end: start + lenMs,
      active: now >= start && now < start + lenMs,
    };
  }

  if (now < start) {
    return { start, end: start + lenMs, active: false };
  }

  const occurMs = occurMin * 60_000;
  const cycles = Math.floor((now - start) / occurMs);
  const curStart = start + cycles * occurMs;
  const curEnd = curStart + lenMs;

  if (now < curEnd && curStart <= end) {
    return { start: curStart, end: curEnd, active: true };
  }
  const nextStart = curStart + occurMs;
  if (nextStart > end) return null;
  return { start: nextStart, end: nextStart + lenMs, active: false };
}

export async function worldEvents(limit = 40) {
  if (!dbEnabled()) return null;
  try {
    const rows = await q(
      `SELECT entry, start_time, end_time, occurence, length, holiday,
              description, world_event, announce
       FROM \`${CONFIG.worldDb}\`.game_event
       WHERE world_event = 0
         AND description <> ''
         AND description IS NOT NULL`,
    );
    const now = Date.now();
    const out = [];
    for (const row of rows) {
      const occ = nextOccurrence(row, now);
      if (!occ) continue;
      out.push({
        id: Number(row.entry),
        title: row.description,
        holidayId: Number(row.holiday ?? 0) || null,
        start: new Date(occ.start).toISOString(),
        end: new Date(occ.end).toISOString(),
        active: occ.active,
        recurs: Number(row.occurence) > 0,
        occurrenceMin: Number(row.occurence),
        lengthMin: Number(row.length),
      });
    }
    // Sort: active first (by end asc), then upcoming (by start asc).
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

export async function shutdownDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
