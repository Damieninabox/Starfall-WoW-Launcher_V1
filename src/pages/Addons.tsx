import { useEffect, useState } from "react";
import { api, type Addon } from "../api/cms";

export default function Addons() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.addons().then((r) => setAddons(r.addons)).catch((e) => setError(String(e)));
    // persist disabled set locally — the server is source of truth for the list,
    // per-user on/off lives in the launcher until we wire it into the patcher.
    const raw = localStorage.getItem("starfall.disabled-addons");
    if (raw) {
      try {
        setDisabled(new Set(JSON.parse(raw)));
      } catch {
        // ignore
      }
    }
  }, []);

  const toggle = (id: string) => {
    const next = new Set(disabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDisabled(next);
    localStorage.setItem("starfall.disabled-addons", JSON.stringify([...next]));
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Addons</h1>
      {error && <div className="text-red-300">{error}</div>}
      <ul className="flex flex-col gap-2">
        {addons.map((a) => {
          const isDisabled = disabled.has(a.id);
          return (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4"
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
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 accent-violet-500"
                />
                <span>{isDisabled ? "Off" : "On"}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="text-xs text-neutral-500">
        Disabled addons get their .toc renamed to .toc.disabled on the next patcher run.
      </div>
    </div>
  );
}

