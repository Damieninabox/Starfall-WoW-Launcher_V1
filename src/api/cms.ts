import { invoke } from "@tauri-apps/api/core";

const CMS_BASE = (import.meta.env.VITE_CMS_BASE as string | undefined) ?? "http://127.0.0.1:8787";

async function cmsFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  return await invoke<T>("cms_fetch", {
    cmsBase: CMS_BASE,
    method,
    path,
    body: body ?? null,
  });
}

export function cmsBase() {
  return CMS_BASE;
}

export function cmsGet<T>(path: string) {
  return cmsFetch<T>("GET", path);
}
export function cmsPost<T>(path: string, body?: unknown) {
  return cmsFetch<T>("POST", path, body);
}
export function cmsDelete<T>(path: string) {
  return cmsFetch<T>("DELETE", path);
}

// ----- Typed domain models -----

export interface NewsEntry {
  id: string;
  title: string;
  body: string;
  date: string;
  tag: string;
}
export interface ServerStatus {
  online: boolean;
  population: number;
  uptimeHours: number;
  realm: string;
  tps: number;
}
export interface Character {
  id: number;
  name: string;
  realm: string;
  className: string;
  race: string;
  faction: "Alliance" | "Horde";
  level: number;
  itemLevel: number;
  guild: string | null;
  lastPlayed: string;
}
export interface Affix {
  id: number;
  name: string;
  icon: string;
  description: string;
}
export interface AffixesResponse {
  week: string;
  rotation: Affix[];
}
export interface MplusRun {
  rank: number;
  party: string[];
  dungeon: string;
  timer: string;
  score: number;
}
export interface RaidProgress {
  raid: string;
  tier: string;
  bosses: {
    name: string;
    killed: boolean;
    firstKillGuild: string | null;
    firstKillDate: string | null;
  }[];
}
export interface Guild {
  name: string;
  motd: string;
  memberCount: number;
  onlineCount: number;
}
export interface GuildEvent {
  id: string;
  title: string;
  when: string;
  kind: string;
}
export interface Referral {
  code: string;
  link: string;
  signups: number;
  active: number;
  rewardsEarned: number;
  rewardsPending: number;
}
export interface Item {
  id: number;
  name: string;
  icon: string;
  quality: number;
  ilvl: number;
  type: string;
  setId: string | null;
}
export interface ItemSource {
  type: "boss" | "quest" | "vendor";
  name: string;
  zone: string;
  dropChance: number | null;
}
export interface Addon {
  id: string;
  name: string;
  description: string;
  version: string;
  enabledByDefault: boolean;
  category: string;
}
export interface SessionEntry {
  id: string;
  username: string;
  ip: string;
  ua: string;
  createdAt: string;
}
export interface Me {
  id: string;
  username: string;
  displayName: string;
  email: string;
  has2fa: boolean;
}
export interface Enroll2faResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}
export interface ShopSso {
  ssoToken: string;
  url: string;
}

// ----- Public API helpers -----

export const api = {
  news: () => cmsGet<{ news: NewsEntry[] }>("/api/launcher/news"),
  serverStatus: () => cmsGet<ServerStatus>("/api/launcher/server-status"),
  expansions: () => cmsGet<{ expansions: unknown[] }>("/api/launcher/expansions"),
  me: () => cmsGet<Me>("/api/account/me"),
  sessions: () => cmsGet<{ sessions: SessionEntry[] }>("/api/account/sessions"),
  revokeAll: () => cmsPost<{ ok: true }>("/api/account/sessions/revoke-all"),
  characters: () => cmsGet<{ characters: Character[] }>("/api/account/characters"),
  referral: () => cmsGet<Referral>("/api/account/referral"),
  wishlist: () => cmsGet<{ items: Item[] }>("/api/account/wishlist"),
  addToWishlist: (itemId: number) =>
    cmsPost<{ ok: true }>("/api/account/wishlist", { itemId }),
  removeFromWishlist: (itemId: number) =>
    cmsDelete<{ ok: true }>(`/api/account/wishlist/${itemId}`),
  searchItems: (q: string) =>
    cmsGet<{ items: Item[] }>(`/api/items/search?q=${encodeURIComponent(q)}`),
  itemSources: (id: number) =>
    cmsGet<{ sources: ItemSource[] }>(`/api/items/${id}/sources`),
  guild: (guid: string) => cmsGet<Guild>(`/api/guild/${guid}`),
  guildEvents: (guid: string) =>
    cmsGet<{ events: GuildEvent[] }>(`/api/guild/${guid}/events`),
  affixes: () => cmsGet<AffixesResponse>("/api/mplus/affixes/current"),
  mplusLeaderboard: () => cmsGet<{ runs: MplusRun[] }>("/api/mplus/leaderboard"),
  mplusCharacter: (id: number) =>
    cmsGet<{ runs: { dungeon: string; timer: string; score: number }[] }>(
      `/api/mplus/character/${id}/runs`,
    ),
  raids: () => cmsGet<{ raids: RaidProgress[] }>("/api/raids/progression"),
  addons: () => cmsGet<{ addons: Addon[] }>("/api/launcher/addons"),
  enroll2fa: () => cmsPost<Enroll2faResponse>("/api/account/2fa/enroll"),
  verify2fa: (code: string) =>
    cmsPost<{ enabled: true }>("/api/account/2fa/verify", { code }),
  disable2fa: () => cmsPost<{ enabled: false }>("/api/account/2fa/disable"),
  shopSso: () => cmsGet<ShopSso>("/api/shop-sso"),
  submitTicket: (payload: Record<string, unknown>) =>
    cmsPost<{ id: string; url: string }>("/api/support/tickets", payload),
};
