import { useEffect, useMemo, useState } from "react";
import { api, type ShopCategory, type ShopItem } from "../api/cms";

export default function Shop() {
  const [cats, setCats] = useState<ShopCategory[]>([]);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [activeCat, setActiveCat] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .shop()
      .then((r) => {
        setCats(r.categories);
        setItems(r.items);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => (activeCat === "all" ? items : items.filter((i) => i.categoryId === activeCat)),
    [items, activeCat],
  );

  if (loading) return <div className="text-neutral-500">Loading shop…</div>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Shop</h1>
        <p className="text-sm text-neutral-400">
          Spend your Vote Points (VP) or Donation Points (DP).
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <CatPill active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            All
          </CatPill>
          {cats.map((c) => (
            <CatPill
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name}
            </CatPill>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No items in the shop yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((it) => (
            <article
              key={it.id}
              className="flex flex-col gap-3 rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4 transition-colors hover:border-violet-400/50"
            >
              <div className="flex items-start gap-3">
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt={it.name}
                    className="h-14 w-14 rounded border border-neutral-800 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-xs text-neutral-500">
                    #{it.itemEntry ?? "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{it.name}</div>
                  {it.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-neutral-400">
                      {it.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {it.priceVp > 0 && (
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-200">
                    {it.priceVp} VP
                  </span>
                )}
                {it.priceDp > 0 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-amber-200">
                    {it.priceDp} DP
                  </span>
                )}
                <button className="ml-auto rounded bg-violet-500 px-3 py-1 text-sm font-semibold text-neutral-950 hover:bg-violet-400">
                  Buy
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CatPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
          : "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
