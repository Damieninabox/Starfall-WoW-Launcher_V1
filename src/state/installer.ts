import { create } from "zustand";
import type { ProgressSnapshot, WorkSummary } from "../api/patcher";

export type InstallPhase =
  | "idle"
  | "checking"
  | "ready"
  | "running"
  | "paused"
  | "done"
  | "error";

interface InstallerState {
  installDir: string;
  manifestUrl: string;
  phase: InstallPhase;
  summary: WorkSummary | null;
  progress: ProgressSnapshot | null;
  errorMessage: string | null;

  setInstallDir: (dir: string) => void;
  setManifestUrl: (url: string) => void;
  setPhase: (phase: InstallPhase) => void;
  setSummary: (summary: WorkSummary | null) => void;
  setProgress: (progress: ProgressSnapshot | null) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const DEFAULT_MANIFEST_URL = "http://127.0.0.1:8787/manifests/cata.json";

export const useInstallerStore = create<InstallerState>((set) => ({
  installDir: "",
  manifestUrl: DEFAULT_MANIFEST_URL,
  phase: "idle",
  summary: null,
  progress: null,
  errorMessage: null,

  setInstallDir: (installDir) => set({ installDir }),
  setManifestUrl: (manifestUrl) => set({ manifestUrl }),
  setPhase: (phase) => set({ phase }),
  setSummary: (summary) => set({ summary }),
  setProgress: (progress) => set({ progress }),
  setError: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      phase: "idle",
      summary: null,
      progress: null,
      errorMessage: null,
    }),
}));
