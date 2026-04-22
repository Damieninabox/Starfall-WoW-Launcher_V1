import { useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  onProgress,
  patcherCancel,
  patcherCheck,
  patcherRepair,
  patcherRun,
} from "../api/patcher";
import { useInstallerStore } from "../state/installer";
import { useLauncherStore } from "../state/launcher";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(bytesRemaining: number, bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "—";
  const secs = Math.max(0, Math.round(bytesRemaining / bytesPerSec));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function Install() {
  const {
    manifestUrl,
    phase,
    summary,
    progress,
    errorMessage,
    setManifestUrl,
    setPhase,
    setSummary,
    setProgress,
    setError,
    reset,
  } = useInstallerStore();
  const installDir = useLauncherStore((s) => s.installDir);
  const setInstallDir = useLauncherStore((s) => s.setInstallDir);

  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    onProgress((snap) => {
      if (cancelled) return;
      setProgress(snap);
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlistenRef.current = unlisten;
      }
    });
    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [setProgress]);

  const pickFolder = async () => {
    setError(null);
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Select install folder",
      });
      if (typeof picked === "string" && picked.length > 0) {
        setInstallDir(picked);
        reset();
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const runCheck = async () => {
    if (!installDir) {
      setError("Pick an install folder first.");
      return;
    }
    setError(null);
    setPhase("checking");
    setSummary(null);
    try {
      const s = await patcherCheck(installDir, manifestUrl);
      setSummary(s);
      setPhase("ready");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  };

  const startInstall = async () => {
    if (!installDir) {
      setError("Pick an install folder first.");
      return;
    }
    setError(null);
    setPhase("running");
    try {
      await patcherRun(installDir, manifestUrl);
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  };

  const doRepair = async () => {
    if (!installDir) {
      setError("Pick an install folder first.");
      return;
    }
    setError(null);
    setPhase("running");
    try {
      await patcherRepair(installDir, manifestUrl);
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  };

  const doPause = async () => {
    setPhase("paused");
    try {
      await patcherCancel();
    } catch (e) {
      setError(String(e));
    }
  };

  const running = phase === "running";
  const overallPct = progress?.overallBytesTotal
    ? Math.min(
        100,
        (progress.overallBytesDone / progress.overallBytesTotal) * 100,
      )
    : 0;
  const bytesRemaining =
    progress && progress.overallBytesTotal > progress.overallBytesDone
      ? progress.overallBytesTotal - progress.overallBytesDone
      : 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Install / Repair</h1>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="text-sm text-neutral-400">Install folder</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={installDir}
            placeholder="No folder selected"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
          />
          <button
            onClick={pickFolder}
            disabled={running}
            className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
          >
            Pick folder
          </button>
        </div>

        <label className="mt-3 text-sm text-neutral-400">Manifest URL</label>
        <input
          value={manifestUrl}
          onChange={(e) => setManifestUrl(e.currentTarget.value)}
          disabled={running}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
        />
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          onClick={runCheck}
          disabled={running || !installDir}
          className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          Check
        </button>
        <button
          onClick={startInstall}
          disabled={running || !installDir}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Start install
        </button>
        <button
          onClick={doPause}
          disabled={!running}
          className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          Pause
        </button>
        <button
          onClick={doRepair}
          disabled={running || !installDir}
          className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          Repair
        </button>
      </section>

      {summary && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-sm">
          <div className="mb-2 text-neutral-400">
            Manifest {summary.manifestVersion}
          </div>
          <ul className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
            <li>
              <span className="text-neutral-500">Download: </span>
              <span className="font-mono">{summary.filesToDownload}</span>
            </li>
            <li>
              <span className="text-neutral-500">Replace: </span>
              <span className="font-mono">{summary.filesToReplace}</span>
            </li>
            <li>
              <span className="text-neutral-500">Skip: </span>
              <span className="font-mono">{summary.filesToSkip}</span>
            </li>
            <li>
              <span className="text-neutral-500">Delete: </span>
              <span className="font-mono">{summary.filesToDelete}</span>
            </li>
          </ul>
          <div className="mt-2 text-neutral-400">
            Total download: {formatBytes(summary.bytesTotal)}
          </div>
        </section>
      )}

      {(progress || phase === "running") && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-neutral-400">
              {progress?.status ?? "starting"}
            </span>
            <span className="font-mono text-sm">{overallPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-neutral-800">
            <div
              className="h-full bg-amber-500 transition-[width] duration-100"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-4">
              <span className="text-neutral-500">File: </span>
              <span className="font-mono">
                {progress?.currentFile || "—"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Overall: </span>
              <span className="font-mono">
                {formatBytes(progress?.overallBytesDone ?? 0)} /{" "}
                {formatBytes(progress?.overallBytesTotal ?? 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Speed: </span>
              <span className="font-mono">
                {formatBytes(progress?.bytesPerSec ?? 0)}/s
              </span>
            </div>
            <div>
              <span className="text-neutral-500">ETA: </span>
              <span className="font-mono">
                {formatEta(bytesRemaining, progress?.bytesPerSec ?? 0)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Phase: </span>
              <span className="font-mono">{phase}</span>
            </div>
          </div>
        </section>
      )}

      {errorMessage && (
        <section className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          <div className="font-semibold text-red-300">Error</div>
          <div className="mt-1 font-mono">{errorMessage}</div>
        </section>
      )}

      {phase === "done" && (
        <section className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-4 text-sm text-emerald-200">
          Install complete.
        </section>
      )}
    </div>
  );
}
