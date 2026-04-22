import { useEffect, useState } from "react";
import { api, cmsBase, type Character } from "../api/cms";

export default function Characters() {
  const [chars, setChars] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Character | null>(null);

  useEffect(() => {
    api
      .characters()
      .then((r) => {
        const sorted = [...r.characters].sort((a, b) =>
          b.lastPlayed.localeCompare(a.lastPlayed),
        );
        setChars(sorted);
        setSelected(sorted[0] ?? null);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-red-300">{error}</div>;
  if (!chars) return <div className="text-neutral-500">Loading characters…</div>;
  if (chars.length === 0)
    return <div className="text-neutral-500">No characters on this account yet.</div>;

  const byRealm = groupBy(chars, (c) => c.realm);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-4">
        {Array.from(byRealm.entries()).map(([realm, list]) => (
          <section key={realm}>
            <h3 className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
              {realm}
            </h3>
            <ul className="flex flex-col gap-2">
              {list.map((c) => {
                const isSel = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelected(c)}
                      className={[
                        "flex w-full flex-col items-start gap-0.5 rounded border p-3 text-left transition-colors",
                        isSel
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700",
                      ].join(" ")}
                    >
                      <div className="flex w-full items-baseline justify-between gap-2">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-neutral-500">
                          {c.faction}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        {c.race} {c.className} · Lv{c.level} · iLvl {c.itemLevel}
                      </div>
                      {c.guild && (
                        <div className="text-xs text-neutral-500">
                          &lt;{c.guild}&gt;
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </aside>

      <main className="min-h-[500px] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/60">
        {selected && (
          <iframe
            key={selected.id}
            title={`Armory — ${selected.name}`}
            src={`${cmsBase()}/armory/${encodeURIComponent(selected.name)}`}
            className="h-full w-full border-0"
            style={{ minHeight: 500 }}
          />
        )}
      </main>
    </div>
  );
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of arr) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

