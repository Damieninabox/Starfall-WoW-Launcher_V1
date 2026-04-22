import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CachePolicy = "on-launch" | "weekly" | "manual-only" | "off";

interface LauncherSettings {
  installDir: string;
  realmlistServer: string;
  cachePolicy: CachePolicy;
  launchArgs: string[];
  selectedExpansion: string;
  lastCacheClearMs: number;

  setInstallDir: (dir: string) => void;
  setRealmlistServer: (server: string) => void;
  setCachePolicy: (p: CachePolicy) => void;
  setLaunchArgs: (args: string[]) => void;
  setSelectedExpansion: (id: string) => void;
  markCacheClear: () => void;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const useLauncherStore = create<LauncherSettings>()(
  persist(
    (set) => ({
      installDir: "",
      realmlistServer: "logon.starfall.gg",
      cachePolicy: "on-launch",
      launchArgs: [],
      selectedExpansion: "cata",
      lastCacheClearMs: 0,

      setInstallDir: (installDir) => set({ installDir }),
      setRealmlistServer: (realmlistServer) => set({ realmlistServer }),
      setCachePolicy: (cachePolicy) => set({ cachePolicy }),
      setLaunchArgs: (launchArgs) => set({ launchArgs }),
      setSelectedExpansion: (selectedExpansion) => set({ selectedExpansion }),
      markCacheClear: () => set({ lastCacheClearMs: Date.now() }),
    }),
    {
      name: "starfall.launcher",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function shouldClearCache(
  policy: CachePolicy,
  lastMs: number,
  now: number = Date.now(),
): boolean {
  switch (policy) {
    case "on-launch":
      return true;
    case "weekly":
      return now - lastMs >= WEEK_MS;
    case "manual-only":
    case "off":
      return false;
  }
}
