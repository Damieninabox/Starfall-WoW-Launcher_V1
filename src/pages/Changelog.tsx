import { useEffect, useState } from "react";
import { api, type ChangelogEntry } from "../api/cms";

const CATEGORY_STYLES: Record<string, string> = {
  feature: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  bugfix: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  balance: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  content: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  system: "border-neutral-500/40 bg-neutral-500/10 text-neutral-200",
};

export default function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .changelog()
      .then((r) => setEntries(r.changelog))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-neutral-500">Loading changelog…</div>;
  if (error)
    return (
      <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
        {error}
      </div>
    );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Changelog</h1>
        <p className="text-sm text-neutral-400">Recent patches and updates.</p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No changelog entries yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-5"
            >
              <header className="flex flex-wrap items-baseline gap-3">
                <span className="rounded bg-neutral-950 px-2 py-0.5 font-mono text-xs text-violet-200 ring-1 ring-violet-500/30">
                  {e.version}
                </span>
                <h2 className="text-lg font-semibold">{e.title}</h2>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    CATEGORY_STYLES[e.category] ?? CATEGORY_STYLES.system,
                  ].join(" ")}
                >
                  {e.category}
                </span>
                <span className="ml-auto text-xs text-neutral-500">{e.date}</span>
              </header>
              <div
                className="mt-3 whitespace-pre-wrap text-sm text-neutral-300"
                dangerouslySetInnerHTML={{ __html: e.content }}
              />
              {e.author && (
                <div className="mt-3 text-xs text-neutral-500">— {e.author}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
