import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface WorkSummary {
  filesToDownload: number;
  filesToReplace: number;
  filesToSkip: number;
  filesToDelete: number;
  bytesTotal: number;
  manifestVersion: string;
}

export interface ProgressSnapshot {
  currentFile: string;
  fileBytesDone: number;
  fileBytesTotal: number;
  overallBytesDone: number;
  overallBytesTotal: number;
  bytesPerSec: number;
  status: string;
}

type RawWorkSummary = {
  files_to_download: number;
  files_to_replace: number;
  files_to_skip: number;
  files_to_delete: number;
  bytes_total: number;
  manifest_version: string;
};

function toWorkSummary(raw: RawWorkSummary): WorkSummary {
  return {
    filesToDownload: raw.files_to_download,
    filesToReplace: raw.files_to_replace,
    filesToSkip: raw.files_to_skip,
    filesToDelete: raw.files_to_delete,
    bytesTotal: raw.bytes_total,
    manifestVersion: raw.manifest_version,
  };
}

export async function patcherCheck(
  installDir: string,
  manifestUrl: string,
): Promise<WorkSummary> {
  const raw = await invoke<RawWorkSummary>("patcher_check", {
    installDir,
    manifestUrl,
  });
  return toWorkSummary(raw);
}

export async function patcherRun(
  installDir: string,
  manifestUrl: string,
): Promise<void> {
  await invoke("patcher_run", { installDir, manifestUrl });
}

export async function patcherRepair(
  installDir: string,
  manifestUrl: string,
): Promise<void> {
  await invoke("patcher_repair", { installDir, manifestUrl });
}

export async function patcherCancel(): Promise<void> {
  await invoke("patcher_cancel");
}

export function onProgress(
  handler: (snap: ProgressSnapshot) => void,
): Promise<UnlistenFn> {
  return listen<ProgressSnapshot>("patcher:progress", (e) => handler(e.payload));
}

