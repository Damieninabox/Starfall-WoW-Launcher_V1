import { invoke } from "@tauri-apps/api/core";

export interface RealmlistState {
  locales: string[];
  server: string | null;
  paths: string[];
}

export interface CacheClearReport {
  bytesFreed: number;
  filesRemoved: number;
  dirsCleared: string[];
}

type RawCacheReport = {
  bytesFreed: number;
  filesRemoved: number;
  dirsCleared: string[];
};

export async function realmlistRead(installDir: string): Promise<RealmlistState> {
  return await invoke<RealmlistState>("realmlist_read", { installDir });
}

export async function realmlistWrite(
  installDir: string,
  server: string,
): Promise<RealmlistState> {
  return await invoke<RealmlistState>("realmlist_write", { installDir, server });
}

export async function cacheClear(installDir: string): Promise<CacheClearReport> {
  const raw = await invoke<RawCacheReport>("cache_clear", { installDir });
  return raw;
}

export async function launchGame(
  installDir: string,
  args: string[],
): Promise<void> {
  await invoke("launch_game", { installDir, args });
}

export async function addonSetEnabled(
  installDir: string,
  addonId: string,
  enabled: boolean,
): Promise<{ enabled: boolean; filesRenamed: number }> {
  return await invoke("addon_set_enabled", { installDir, addonId, enabled });
}

export async function addonListEnabled(installDir: string): Promise<string[]> {
  return await invoke("addon_list_enabled", { installDir });
}

