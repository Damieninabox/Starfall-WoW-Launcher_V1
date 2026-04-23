// Wowhead icon CDN URLs for races, classes, currencies, and PvP brackets.
// All slugs match Blizzard's texture filenames that Wowhead ships at
// https://wow.zamimg.com/images/wow/icons/large/<slug>.jpg

const CDN = "https://wow.zamimg.com/images/wow/icons/large";

export function iconUrl(slug: string): string {
  return `${CDN}/${slug}.jpg`;
}

// --- class icons ---------------------------------------------------------

const CLASS_SLUGS: Record<string, string> = {
  Warrior: "class_warrior",
  Paladin: "class_paladin",
  Hunter: "class_hunter",
  Rogue: "class_rogue",
  Priest: "class_priest",
  "Death Knight": "class_deathknight",
  Shaman: "class_shaman",
  Mage: "class_mage",
  Warlock: "class_warlock",
  Druid: "class_druid",
};

export function classIcon(className: string): string | null {
  const slug = CLASS_SLUGS[className];
  return slug ? iconUrl(slug) : null;
}

// --- race icons ----------------------------------------------------------

const RACE_SLUGS: Record<string, string> = {
  Human: "race_human",
  Dwarf: "race_dwarf",
  "Night Elf": "race_nightelf",
  Gnome: "race_gnome",
  Draenei: "race_draenei",
  Worgen: "race_worgen",
  Orc: "race_orc",
  Undead: "race_scourge",
  Tauren: "race_tauren",
  Troll: "race_troll",
  "Blood Elf": "race_bloodelf",
  Goblin: "race_goblin",
};

export function raceIcon(race: string, gender?: string): string | null {
  const base = RACE_SLUGS[race];
  if (!base) return null;
  const g = gender === "Female" ? "female" : "male";
  return iconUrl(`${base}_${g}`);
}

// --- currency icons ------------------------------------------------------

export const CURRENCY_ICONS = {
  gold: iconUrl("inv_misc_coin_01"),
  silver: iconUrl("inv_misc_coin_03"),
  copper: iconUrl("inv_misc_coin_05"),
  honorAlliance: iconUrl("pvpcurrency-honor-alliance"),
  honorHorde: iconUrl("pvpcurrency-honor-horde"),
  conquestAlliance: iconUrl("pvpcurrency-conquest-alliance"),
  conquestHorde: iconUrl("pvpcurrency-conquest-horde"),
  justice: iconUrl("pvecurrency-justice"),
  valor: iconUrl("pvecurrency-valor"),
  arena2v2: iconUrl("achievement_arena_2v2_7"),
  arena3v3: iconUrl("achievement_arena_3v3_7"),
  arena5v5: iconUrl("achievement_arena_5v5_7"),
  kills: iconUrl("inv_misc_head_human_02"),
  played: iconUrl("inv_misc_pocketwatch_01"),
} as const;

// --- small inline icon component ----------------------------------------

// (rendering left to the caller; this module is data-only so it stays safe
// for non-React consumers.)
