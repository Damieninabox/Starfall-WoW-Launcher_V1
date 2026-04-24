// Shared affix data & weekly rotation. Copied verbatim from the CMS so both
// apps resolve the same three affixes for the current ISO week.

export type AffixPool = 'low' | 'mid' | 'high';

export interface Affix {
  id: number;
  slot: number;
  spellId: number;
  name: string;
  pool: AffixPool;
  short: string;
  detail: string;
  flavor?: string;
  /** Texture filename (without extension or path) — resolves to
   *  `https://wow.zamimg.com/images/wow/icons/large/<iconName>.jpg` */
  iconName: string;
}

export const AFFIXES: Affix[] = [
  // Low pool — Keys 2–6
  { id: 1, slot: 1, spellId: 1022, name: 'Fortified', pool: 'low',
    iconName: 'ability_toughness',
    short: 'Trash has 20% more HP and deals 30% more damage.',
    detail: 'Non-boss enemies have 20% more health and deal 30% more damage. Plan your pulls carefully — trash becomes the real danger.',
    flavor: 'The walls hold firm. The guards hold firmer.' },
  { id: 2, slot: 2, spellId: 121825, name: 'Tyrannical', pool: 'low',
    iconName: 'achievement_boss_archaedas',
    short: 'Bosses have 30% more HP and hit 15% harder.',
    detail: 'Boss enemies have 30% more health and their abilities hit 15% harder. Boss DPS, survivability, and execute phases matter more than ever.',
    flavor: 'The lord of the hall brooks no challengers.' },
  { id: 3, slot: 3, spellId: 6673, name: 'Raging', pool: 'low',
    iconName: 'ability_druid_challangingroar',
    short: 'Non-bosses enrage at 30% HP — immune to CC.',
    detail: 'Non-boss enemies enrage at 30% health remaining, temporarily granting immunity to crowd control effects. Burst them down or peel away — CC won’t save you.',
    flavor: 'Pain only feeds the fire.' },
  { id: 4, slot: 4, spellId: 18499, name: 'Bolstering', pool: 'low',
    iconName: 'spell_arcane_blast',
    short: 'Killing one enemy empowers nearby allies.',
    detail: 'When a non-boss enemy dies, it empowers nearby allies, increasing their max health and damage. Bring packs down together.',
    flavor: 'Grief makes the living stronger.' },
  { id: 5, slot: 5, spellId: 12292, name: 'Sanguine', pool: 'low',
    iconName: 'spell_shadow_bloodboil',
    short: 'Enemy corpses leave pools that heal foes and damage players.',
    detail: 'When a non-boss enemy dies, it leaves a pool of blood that heals enemies and damages players. Kite carefully.',
    flavor: 'The floor runs red, and the red runs back.' },

  // Mid pool — Keys 7–9
  { id: 6, slot: 6, spellId: 2944, name: 'Bursting', pool: 'mid',
    iconName: 'ability_warlock_haunt',
    short: 'Slain enemies explode — stacking DoT on the party.',
    detail: 'When slain, non-boss enemies explode, applying a stacking damage-over-time to all players. Stop chaining kills when stacks get high.',
    flavor: 'Every death leaves a mark.' },
  { id: 7, slot: 7, spellId: 121834, name: 'Static Link', pool: 'mid',
    iconName: 'spell_shaman_staticshock',
    short: 'Two players are linked by an arc — damages both.',
    detail: 'Two random players are periodically linked by an arc of electricity, dealing damage to both. Break line-of-sight or close the gap to drop it.',
    flavor: 'Two strands of the same storm.' },
  { id: 8, slot: 8, spellId: 121835, name: 'Arcane Echo', pool: 'mid',
    iconName: 'spell_arcane_arcaneresilience',
    short: 'Enemies echo arcane damage to nearby players.',
    detail: 'Arcane energy echoes from enemies, dealing periodic damage to nearby players. Stay spread, avoid stacking on packs.',
    flavor: 'The weave remembers every word.' },
  { id: 9, slot: 9, spellId: 121839, name: 'Necrotic', pool: 'mid',
    iconName: 'spell_shadow_plaguecloud',
    short: 'Melee hits stack a 2%-per-stack healing-reduction debuff.',
    detail: 'Enemy melee attacks apply a stacking debuff that reduces healing received by 2% per stack. Tanks must kite and healers must triage.',
    flavor: 'A wound that forgets how to close.' },
  { id: 10, slot: 10, spellId: 121841, name: 'Starfall', pool: 'mid',
    iconName: 'spell_arcane_starfire',
    short: 'Astral stars fall and collapse into heavy AoE.',
    detail: 'Astral Stars fall from the sky and collapse into explosions dealing heavy AoE damage. Constant movement is required.',
    flavor: 'The sky empties, slowly.' },

  // High pool — Keys 10+
  { id: 11, slot: 11, spellId: 121844, name: 'Void Rift', pool: 'high',
    iconName: 'inv_misc_volatileshadow',
    short: 'Rifts pulse shadow damage and weaken nearby players.',
    detail: 'Void rifts tear open across the dungeon, pulsing shadow damage and weakening nearby players. Spread and dispel aggressively.',
    flavor: 'The dark looks back.' },
  { id: 12, slot: 12, spellId: 31571, name: 'Unstable Flux', pool: 'high',
    iconName: 'spell_nature_lightningshield',
    short: 'Interrupting enemy spells detonates the charge.',
    detail: 'Enemies are charged with unstable energy. Interrupting their spells detonates the charge, dealing damage to nearby players. Kick smart, not always.',
    flavor: 'Silence costs more than it used to.' },
  { id: 13, slot: 13, spellId: 74434, name: 'Soul Surge', pool: 'high',
    iconName: 'inv_sword_122',
    short: 'Slain enemies empower a Tormented Soul that casts at players.',
    detail: 'Slain enemies release soul fragments that empower a Tormented Soul, causing it to cast at players. Kill the Soul before it builds critical mass.',
    flavor: 'The dead remember where they fell.' },
  { id: 14, slot: 14, spellId: 85696, name: 'Tyrael\'s Judgement', pool: 'high',
    iconName: 'spell_holy_proclaimchampion_02',
    short: 'Stack on Tyrael after each boss — or face the chains.',
    detail: 'Tyrael descends after each boss kill. Stack on him to receive a reward. Fail, and the party is struck by Chains of Darkness.',
    flavor: 'Judgement does not wait for the ready.' },
  { id: 15, slot: 15, spellId: 100955, name: 'Stormcalled', pool: 'high',
    iconName: 'inv_misc_stormlordsfavor',
    short: 'Boss impacts leave crackling lightning zones.',
    detail: 'Boss spells leave crackling lightning zones at impact. Standing in them deals periodic nature damage. Bait the casts away from the group.',
    flavor: 'It does not care whose side you’re on.' },
];

export const POOL_META: Record<AffixPool, { label: string; range: string; color: string }> = {
  low: { label: 'Low', range: 'Keys 2–6', color: '#22c55e' },
  mid: { label: 'Mid', range: 'Keys 7–9', color: '#00b4ff' },
  high: { label: 'High', range: 'Keys 10+', color: '#a855f7' },
};

export function iconUrlFor(a: Affix): string {
  return `https://wow.zamimg.com/images/wow/icons/large/${a.iconName}.jpg`;
}

export function findAffix(idOrName: { id?: number | null; name?: string | null }): Affix | null {
  if (idOrName.id != null) {
    const byId = AFFIXES.find(a => a.id === idOrName.id);
    if (byId) return byId;
  }
  if (idOrName.name) {
    const target = idOrName.name.trim().toLowerCase();
    const byName = AFFIXES.find(a => a.name.toLowerCase() === target);
    if (byName) return byName;
  }
  return null;
}
