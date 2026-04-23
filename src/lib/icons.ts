// Icon URLs.
// Prefer assets served by the CMS (class/race SVGs, Mythic+ dungeon images)
// so the launcher visually matches the website; fall back to Wowhead's CDN
// for currencies and anything the CMS doesn't ship.

const WOWHEAD = "https://wow.zamimg.com/images/wow/icons/large";

function cmsBase(): string {
  return (import.meta.env.VITE_CMS_BASE as string | undefined) ??
    "http://127.0.0.1:8787";
}

export function wowheadIcon(slug: string): string {
  return `${WOWHEAD}/${slug}.jpg`;
}

// --- class icons (CMS public/images/classes/*.svg) -----------------------

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
  if (!slug) return null;
  return `${cmsBase()}/images/classes/${slug}.svg`;
}

// --- race icons (CMS public/images/races/*.svg) --------------------------

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
  if (!slug) return null;
  return `${cmsBase()}/images/races/${slug}.svg`;
}

// --- Mythic+ dungeon backdrop --------------------------------------------
// CMS uses lowercase names without "the ", no apostrophes. e.g.
//   "The Stonecore"        -> "stonecore.jpg"
//   "Lost City of the Tol'vir" -> "lost city of the tolvir.jpg"

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

// --- currency icons (Wowhead; no CMS equivalents shipped) ----------------

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

// Keep `iconUrl` as a shim so existing callers that pass already-computed
// slugs keep working. New callers should prefer classIcon/raceIcon/dungeonImage.
export function iconUrl(slug: string): string {
  return wowheadIcon(slug);
}
