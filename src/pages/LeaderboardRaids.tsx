import { useEffect, useState } from "react";
import { api, type RaidProgress } from "../api/cms";

export default function LeaderboardRaids() {
  const [raids, setRaids] = useState<RaidProgress[]>([]);
  const [patch, setPatch] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .raids()
      .then((r) => {
        setRaids(r.raids);
        setPatch(r.currentPatch ?? "");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-neutral-500">Loading…</div>;
  if (error)
    return (
      <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
        {error}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {patch && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>Content patch:</span>
          <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 font-mono text-violet-200">
            {patch}
          </span>
          <span className="text-neutral-600">
            (showing raids from this patch and earlier)
          </span>
        </div>
      )}
      {raids.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          No raid progression tracked yet.
        </div>
      ) : (
        raids.map((r) => {
          const total = r.bosses.length;
          const killed = r.bosses.filter((b) => b.killed).length;
          const pct = total > 0 ? Math.round((killed / total) * 100) : 0;
          return (
            <section
              key={r.raid}
              className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-5"
            >
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{r.raid}</div>
                  <div className="text-xs text-neutral-500">
                    {r.tier}
                    {r.patch && <span className="ml-2">· patch {r.patch}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="font-mono text-sm text-violet-200">
                    {killed} / {total}
                  </div>
                </div>
              </header>
              <ul className="grid gap-2 md:grid-cols-2">
                {r.bosses.map((b) => (
                  <li
                    key={b.name}
                    className={[
                      "rounded border p-2 text-sm",
                      b.killed
                        ? "border-emerald-900/60 bg-emerald-950/30"
                        : "border-neutral-800 bg-neutral-950",
                    ].join(" ")}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{b.name}</span>
                      {b.killed ? (
                        <span className="text-xs text-emerald-300">Down</span>
                      ) : (
                        <span className="text-xs text-neutral-500">Alive</span>
                      )}
                    </div>
                    {b.firstKillGuild && (
                      <div className="mt-1 text-xs text-neutral-400">
                        First kill:{" "}
                        <span className="font-mono text-neutral-200">
                          {b.firstKillGuild}
                        </span>{" "}
                        on {b.firstKillDate}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
