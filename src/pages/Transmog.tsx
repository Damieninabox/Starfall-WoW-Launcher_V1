import { useEffect, useState } from "react";
import { api, type Item, type ItemSource } from "../api/cms";

export default function Transmog() {
  const [wishlist, setWishlist] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [sourcesFor, setSourcesFor] = useState<number | null>(null);
  const [sources, setSources] = useState<ItemSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const list = await api.wishlist();
      setWishlist(list.items);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const doSearch = async (q: string) => {
    setQuery(q);
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    try {
      const r = await api.searchItems(q);
      setResults(r.items);
    } catch (e) {
      setError(String(e));
    }
  };

  const add = async (id: number) => {
    try {
      await api.addToWishlist(id);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id: number) => {
    try {
      await api.removeFromWishlist(id);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const showSources = async (id: number) => {
    if (sourcesFor === id) {
      setSourcesFor(null);
      setSources([]);
      return;
    }
    try {
      const r = await api.itemSources(id);
      setSourcesFor(id);
      setSources(r.sources);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Transmog wishlist</h1>
      {error && <div className="text-red-300">{error}</div>}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-neutral-400">Find items</span>
          <input
            value={query}
            onChange={(e) => doSearch(e.currentTarget.value)}
            placeholder="Search by name…"
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
          />
        </label>
        {results.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {results.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-neutral-500">
                    iLvl {it.ilvl} · {it.type}
                  </div>
                </div>
                <button
                  onClick={() => add(it.id)}
                  className="rounded bg-violet-500 px-3 py-1 text-xs font-semibold text-neutral-950 hover:bg-violet-400"
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
          On your wishlist ({wishlist.length})
        </h2>
        {wishlist.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
            Nothing tracked yet. Search above to add items.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {wishlist.map((it) => (
              <li
                key={it.id}
                className="rounded border border-neutral-800 bg-neutral-900/60 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-neutral-500">
                      iLvl {it.ilvl} · {it.type}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => showSources(it.id)}
                      className="rounded border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
                    >
                      Where?
                    </button>
                    <button
                      onClick={() => remove(it.id)}
                      className="rounded border border-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {sourcesFor === it.id && (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-neutral-800 pt-2 text-xs text-neutral-400">
                    {sources.length === 0 && <li>No known sources.</li>}
                    {sources.map((s, i) => (
                      <li key={i}>
                        {s.type} · {s.name} ({s.zone})
                        {s.dropChance ? ` · ${s.dropChance}%` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

