import { useEffect, useState } from "react";
import {
  api,
  type AffixesResponse,
  type MplusRun,
  type RaidProgress,
} from "../api/cms";

type Tab = "affixes" | "leaderboard" | "raids";

export default function MythicPlus() {
  const [tab, setTab] = useState<Tab>("affixes");
  const [affixes, setAffixes] = useState<AffixesResponse | null>(null);
  const [runs, setRuns] = useState<MplusRun[]>([]);
  const [raids, setRaids] = useState<RaidProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.affixes().then(setAffixes).catch((e) => setError(String(e)));
    api
      .mplusLeaderboard()
      .then((r) => setRuns(r.runs))
      .catch((e) => setError(String(e)));
    api
      .raids()
      .then((r) => setRaids(r.raids))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {(["affixes", "leaderboard", "raids"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded px-4 py-2 text-sm",
              tab === t
                ? "bg-violet-500/20 text-violet-200"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
            ].join(" ")}
          >
            {t === "affixes"
              ? "This week"
              : t === "leaderboard"
                ? "Leaderboard"
                : "Raid progression"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {tab === "affixes" && affixes && (
        <div className="grid gap-3 md:grid-cols-3">
          {affixes.rotation.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4"
            >
              <div className="mb-1 text-lg font-semibold">{a.name}</div>
              <div className="text-sm text-neutral-400">{a.description}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900">
              <tr className="text-left text-xs uppercase tracking-widest text-neutral-500">
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Dungeon</th>
                <th className="px-4 py-2">Timer</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Party</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
              {runs.map((r) => (
                <tr key={r.rank}>
                  <td className="px-4 py-2 font-mono">#{r.rank}</td>
                  <td className="px-4 py-2">{r.dungeon}</td>
                  <td className="px-4 py-2 font-mono">{r.timer}</td>
                  <td className="px-4 py-2 font-mono text-violet-200">{r.score}</td>
                  <td className="px-4 py-2 text-xs text-neutral-400">
                    {r.party.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "raids" && (
        <div className="flex flex-col gap-6">
          {raids.map((r) => {
            const total = r.bosses.length;
            const killed = r.bosses.filter((b) => b.killed).length;
            return (
              <section
                key={r.raid}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <div>
                    <div className="text-lg font-semibold">{r.raid}</div>
                    <div className="text-xs text-neutral-500">{r.tier}</div>
                  </div>
                  <div className="font-mono text-sm text-violet-200">
                    {killed} / {total}
                  </div>
                </div>
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
                          <span className="text-xs text-emerald-300">
                            Down
                          </span>
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
          })}
        </div>
      )}
    </div>
  );
}

