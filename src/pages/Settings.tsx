import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useLauncherStore, type CachePolicy } from "../state/launcher";
import { realmlistRead, cacheClear } from "../api/game";

const CACHE_POLICIES: { value: CachePolicy; label: string; description: string }[] = [
  {
    value: "on-launch",
    label: "On every launch",
    description: "Clears Cache/ and WDB/ each time you press Play.",
  },
  {
    value: "weekly",
    label: "Weekly",
    description: "Clears when it's been at least 7 days since the last wipe.",
  },
  {
    value: "manual-only",
    label: "Manual only",
    description: "Never clears automatically. Use the button below.",
  },
  {
    value: "off",
    label: "Off",
    description: "Never touches Cache/WDB.",
  },
];

export default function Settings() {
  const {
    installDir,
    realmlistServer,
    cachePolicy,
    launchArgs,
    setInstallDir,
    setRealmlistServer,
    setCachePolicy,
    setLaunchArgs,
  } = useLauncherStore();

  const [argsRaw, setArgsRaw] = useState(launchArgs.join(" "));
  const [realmlistDisk, setRealmlistDisk] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArgsRaw(launchArgs.join(" "));
  }, [launchArgs]);

  useEffect(() => {
    if (!installDir) return;
    realmlistRead(installDir)
      .then((state) => setRealmlistDisk(state.server))
      .catch(() => setRealmlistDisk(null));
  }, [installDir]);

  const pickFolder = async () => {
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Select install folder",
      });
      if (typeof picked === "string" && picked.length > 0) {
        setInstallDir(picked);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const applyArgs = () => {
    const parsed = argsRaw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setLaunchArgs(parsed);
  };

  const wipeCache = async () => {
    setStatus(null);
    setError(null);
    if (!installDir) {
      setError("Pick an install folder first.");
      return;
    }
    try {
      const report = await cacheClear(installDir);
      setStatus(
        `Cleared ${report.filesRemoved} file(s), ${
          report.dirsCleared.join(" + ") || "nothing"
        } (${formatBytes(report.bytesFreed)}).`,
      );
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

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
            className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
          >
            Pick folder
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="text-sm text-neutral-400">Realmlist server</label>
        <input
          value={realmlistServer}
          onChange={(e) => setRealmlistServer(e.currentTarget.value)}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-200"
        />
        <div className="text-xs text-neutral-500">
          Currently on disk:{" "}
          <span className="font-mono text-neutral-300">
            {realmlistDisk ?? "—"}
          </span>
          {realmlistDisk && realmlistDisk !== realmlistServer && (
            <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">
              Will be rewritten on next Play
            </span>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="text-sm text-neutral-400">Cache clear policy</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {CACHE_POLICIES.map((opt) => (
            <label
              key={opt.value}
              className={[
                "flex cursor-pointer flex-col gap-0.5 rounded border p-3 transition-colors",
                cachePolicy === opt.value
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cache-policy"
                  value={opt.value}
                  checked={cachePolicy === opt.value}
                  onChange={() => setCachePolicy(opt.value)}
                  className="accent-amber-500"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </div>
              <span className="pl-6 text-xs text-neutral-400">
                {opt.description}
              </span>
            </label>
          ))}
        </div>
        <button
          onClick={wipeCache}
          className="self-start rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
        >
          Clear cache now
        </button>
        {status && <div className="text-xs text-emerald-300">{status}</div>}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="text-sm text-neutral-400">Launch options</label>
        <input
          value={argsRaw}
          onChange={(e) => setArgsRaw(e.currentTarget.value)}
          onBlur={applyArgs}
          placeholder="-windowed -console"
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-200"
        />
        <div className="text-xs text-neutral-500">
          Space-separated. Passed to Wow.exe directly — no shell interpolation.
        </div>
      </section>

      {error && (
        <section className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          <div className="font-semibold text-red-300">Error</div>
          <div className="mt-1 font-mono text-xs">{error}</div>
        </section>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
