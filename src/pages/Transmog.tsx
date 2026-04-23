import { useEffect, useState } from "react";
import { api, type Item, type ItemSource } from "../api/cms";

const QUALITY_RING: Record<number, string> = {
  0: "ring-neutral-500",
  1: "ring-neutral-300",
  2: "ring-emerald-400",
  3: "ring-sky-400",
  4: "ring-fuchsia-400",
  5: "ring-orange-400",
  6: "ring-red-500",
  7: "ring-amber-300",
};

const QUALITY_COLOR: Record<number, string> = {
  0: "text-neutral-400",
  1: "text-neutral-200",
  2: "text-emerald-400",
  3: "text-sky-400",
  4: "text-fuchsia-400",
  5: "text-orange-400",
  6: "text-red-500",
  7: "text-amber-300",
};

function ItemIcon({ item, size = 40 }: { item: Item; size?: number }) {
  const [errored, setErrored] = useState(false);
  const ring = QUALITY_RING[item.quality] ?? "ring-neutral-700";
  const px = `${size}px`;
  const iconSrc = item.iconUrl ?? null;
  const fallback = item.name.trim().charAt(0).toUpperCase();
  return (
    <div
      className={["overflow-hidden rounded ring-1", ring].join(" ")}
      style={{ width: px, height: px }}
    >
      {iconSrc && !errored ? (
        <img
          src={iconSrc}
          alt=""
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-950 text-sm font-semibold text-neutral-500">
          {fallback}
        </div>
      )}
    </div>
  );
}

export default function Transmog() {
  const [wishlist, setWishlist] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [sourcesFor, setSourcesFor] = useState<number | null>(null);
  const [sources, setSources] = useState<ItemSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setError(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      const r = await api.searchItems(q);
      setResults(r.items);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
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
      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4">
        <div className="flex items-end justify-between gap-2">
          <label className="flex flex-1 flex-col gap-2 text-sm">
            <span className="text-neutral-400">Find items</span>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => doSearch(e.currentTarget.value)}
                placeholder="Search by name (2+ chars)…"
                className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 pr-9 text-sm text-neutral-200"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                >
                  ✕
                </button>
              )}
            </div>
          </label>
        </div>
        {busy && <div className="mt-2 text-xs text-neutral-500">Searching…</div>}
        {results.length > 0 && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                Close
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {results.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                >
                  <ItemIcon item={it} />
                  <div className="min-w-0 flex-1">
                    <div className={["font-medium truncate", QUALITY_COLOR[it.quality] ?? ""].join(" ")}>
                      {it.name}
                    </div>
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
          </div>
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
                className="rounded border border-violet-500/20 bg-neutral-900/60 p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <ItemIcon item={it} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className={["font-medium truncate", QUALITY_COLOR[it.quality] ?? ""].join(" ")}>
                      {it.name}
                    </div>
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
