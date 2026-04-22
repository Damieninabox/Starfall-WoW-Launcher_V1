export interface ExpansionCard {
  id: string;
  name: string;
  version: string;
  tagline: string;
  enabled: boolean;
}

export const EXPANSIONS: ExpansionCard[] = [
  {
    id: "classic",
    name: "Classic",
    version: "1.12.1",
    tagline: "Vanilla",
    enabled: false,
  },
  {
    id: "tbc",
    name: "The Burning Crusade",
    version: "2.4.3",
    tagline: "Outland",
    enabled: false,
  },
  {
    id: "wotlk",
    name: "Wrath of the Lich King",
    version: "3.3.5a",
    tagline: "Northrend",
    enabled: false,
  },
  {
    id: "cata",
    name: "Cataclysm",
    version: "4.3.4",
    tagline: "Deathwing's shattered world",
    enabled: true,
  },
  {
    id: "mop",
    name: "Mists of Pandaria",
    version: "5.4.8",
    tagline: "Pandaria",
    enabled: false,
  },
];

