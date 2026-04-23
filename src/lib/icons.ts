// Icon URLs.
// Assets are bundled with the launcher under /public so they load without
// a CMS round-trip and work even offline. Currencies still fall back to
// Wowhead's CDN because the launcher doesn't ship them locally.

const WOWHEAD = "https://wow.zamimg.com/images/wow/icons/large";

function cmsBase(): string {
  return (import.meta.env.VITE_CMS_BASE as string | undefined) ??
    "http://127.0.0.1:8787";
}

export function wowheadIcon(slug: string): string {
  return `${WOWHEAD}/${slug}.jpg`;
}

// --- class icons (public/classes/*.svg) ----------------------------------

const CLASS_SLUGS: Record<string, string> = {
  Warrior: "warrior",
  Paladin: "paladin",
  Hunter: "hunter",
  Rogue: "rogue",
  Priest: "priest",
  "Death Knight": "deathknight",
  Shaman: "shaman",
  Mage: "mage",
  Warlock: "warlock",
  Druid: "druid",
};

export function classIcon(className: string): string | null {
  const slug = CLASS_SLUGS[className];
  return slug ? `/classes/${slug}.svg` : null;
}

// --- race icons ----------------------------------------------------------
// Two flavors:
//   * racePortrait(race, gender)  -> gender-specific WebP portrait
//     (public/icons/race/<slug>-<gender>.webp)
//   * raceIcon(race, gender)      -> flat SVG silhouette
//     (public/races/<slug>.svg) — good for tiny inline chips

const RACE_SLUGS: Record<string, string> = {
  Human: "human",
  Dwarf: "dwarf",
  "Night Elf": "nightelf",
  Gnome: "gnome",
  Draenei: "draenei",
  Worgen: "worgen",
  Orc: "orc",
  Undead: "undead",
  Tauren: "tauren",
  Troll: "troll",
  "Blood Elf": "bloodelf",
  Goblin: "goblin",
};

export function raceIcon(race: string, _gender?: string): string | null {
  const slug = RACE_SLUGS[race];
  return slug ? `/races/${slug}.svg` : null;
}

export function racePortrait(race: string, gender?: string): string | null {
  const slug = RACE_SLUGS[race];
  if (!slug) return null;
  const g = gender === "Female" ? "female" : "male";
  return `/icons/race/${slug}-${g}.webp`;
}

// --- faction ------------------------------------------------------------

export function factionIcon(faction: "Alliance" | "Horde"): string {
  return faction === "Horde" ? "/icons/faction/horde.png" : "/icons/faction/alliance.png";
}

// --- equipment slot icons (public/icons/character/*.gif) ----------------

const SLOT_FILES: Record<string, string> = {
  Head: "head",
  Neck: "neck",
  Shoulder: "shoulders",
  Chest: "chest",
  Waist: "waist",
  Legs: "legs",
  Feet: "feet",
  Wrist: "wrists",
  Hands: "hands",
  Finger: "finger",
  Trinket: "trinket",
  "1H Weapon": "mainhand",
  "2H Weapon": "mainhand",
  "Main Hand": "mainhand",
  "Off Hand": "offhand",
  Held: "offhand",
  Shield: "offhand",
  Ranged: "ranged",
  Thrown: "ranged",
  Cloak: "body",
  Shirt: "chest",
  Tabard: "tabard",
};

export function slotIcon(type: string): string | null {
  const base = SLOT_FILES[type];
  return base ? `/icons/character/${base}.gif` : null;
}

// --- Mythic+ dungeon backdrop -------------------------------------------
// The CMS ships backdrops at C:/Starfall-WoW-CMS/public/images/mythic/map/,
// which the mock-server exposes under /images/mythic/map/. Names are
// lowercased, "the " stripped, apostrophes stripped.

export function dungeonImage(dungeonName: string): string | null {
  if (!dungeonName) return null;
  const slug = dungeonName
    .toLowerCase()
    .replace(/^the /, "")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${cmsBase()}/images/mythic/map/${encodeURIComponent(slug)}.jpg`;
}

// --- shop ---------------------------------------------------------------

export const SHOP_CURRENCY_ICONS = {
  stardust: "/icons/shop/stardust.png",
} as const;

// --- currency icons (Wowhead) -------------------------------------------

export const CURRENCY_ICONS = {
  gold: wowheadIcon("inv_misc_coin_01"),
  silver: wowheadIcon("inv_misc_coin_03"),
  copper: wowheadIcon("inv_misc_coin_05"),
  honorAlliance: wowheadIcon("pvpcurrency-honor-alliance"),
  honorHorde: wowheadIcon("pvpcurrency-honor-horde"),
  conquestAlliance: wowheadIcon("pvpcurrency-conquest-alliance"),
  conquestHorde: wowheadIcon("pvpcurrency-conquest-horde"),
  justice: wowheadIcon("pvecurrency-justice"),
  valor: wowheadIcon("pvecurrency-valor"),
  arena2v2: wowheadIcon("achievement_arena_2v2_7"),
  arena3v3: wowheadIcon("achievement_arena_3v3_7"),
  arena5v5: wowheadIcon("achievement_arena_5v5_7"),
  kills: wowheadIcon("inv_misc_head_human_02"),
  played: wowheadIcon("inv_misc_pocketwatch_01"),
} as const;

export function iconUrl(slug: string): string {
  return wowheadIcon(slug);
}
