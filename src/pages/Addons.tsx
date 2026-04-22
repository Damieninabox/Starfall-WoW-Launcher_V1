import { useEffect, useState } from "react";
import { api, type Addon } from "../api/cms";
import { addonListEnabled, addonSetEnabled } from "../api/game";
import { useLauncherStore } from "../state/launcher";

export default function Addons() {
  const installDir = useLauncherStore((s) => s.installDir);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.addons().then((r) => setAddons(r.addons)).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!installDir) return;
    addonListEnabled(installDir)
      .then((disabledIds) => setDisabled(new Set(disabledIds)))
      .catch(() => setDisabled(new Set()));
  }, [installDir]);

  const toggle = async (a: Addon) => {
    if (!installDir) {
      setError("No install folder — open Install first.");
      return;
    }
    setError(null);
    setStatus(null);
    const next = new Set(pending);
    next.add(a.id);
    setPending(next);
    try {
      const wantEnabled = disabled.has(a.id); // currently off → want on
      const r = await addonSetEnabled(installDir, a.id, wantEnabled);
      setStatus(
        `${a.name}: ${wantEnabled ? "enabled" : "disabled"} (${r.filesRenamed} file${
          r.filesRenamed === 1 ? "" : "s"
        } renamed)`,
      );
      const d = new Set(disabled);
      if (wantEnabled) d.delete(a.id);
      else d.add(a.id);
      setDisabled(d);
    } catch (e) {
      setError(String(e));
    } finally {
      const p = new Set(pending);
      p.delete(a.id);
      setPending(p);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Addons</h1>
      {error && <div className="text-red-300">{error}</div>}
      {status && <div className="text-xs text-emerald-300">{status}</div>}
      {!installDir && (
        <div className="rounded border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          Pick an install folder in{" "}
          <span className="font-mono">Install</span> or{" "}
          <span className="font-mono">Settings</span> to manage addons.
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {addons.map((a) => {
          const isDisabled = disabled.has(a.id);
          const isPending = pending.has(a.id);
          return (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">{a.name}</div>
                  <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neutral-400">
                    {a.category}
                  </span>
                  <span className="text-xs text-neutral-500">v{a.version}</span>
                  <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-violet-200">
                    Managed
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">{a.description}</div>
              </div>
              <button
                onClick={() => toggle(a)}
                disabled={isPending || !installDir}
                className={[
                  "min-w-[76px] rounded px-3 py-1.5 text-sm font-medium",
                  isDisabled
                    ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    : "bg-violet-500 text-neutral-950 hover:bg-violet-400",
                  "disabled:opacity-50",
                ].join(" ")}
              >
                {isPending ? "…" : isDisabled ? "Enable" : "Disable"}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="text-xs text-neutral-500">
        Disabled addons have their <span className="font-mono">.toc</span> renamed to{" "}
        <span className="font-mono">.toc.disabled</span> so WoW skips them.
      </div>
    </div>
  );
}
