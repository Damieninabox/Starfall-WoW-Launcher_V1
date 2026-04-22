import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AffixesResponse,
  type MplusDungeon,
  type MplusRun,
  type MplusSeason,
} from "../api/cms";

type Tab = "leaderboard" | "affixes" | "dungeons";

export default function MythicPlus() {
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [season, setSeason] = useState<MplusSeason | null>(null);
  const [affixes, setAffixes] = useState<AffixesResponse | null>(null);
  const [runs, setRuns] = useState<MplusRun[]>([]);
  const [dungeons, setDungeons] = useState<MplusDungeon[]>([]);
  const [dungeonFilter, setDungeonFilter] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.mplusSeason().then((r) => setSeason(r.season)).catch((e) => setError(String(e)));
    api.affixes().then(setAffixes).catch((e) => setError(String(e)));
    api.mplusLeaderboard().then((r) => setRuns(r.runs)).catch((e) => setError(String(e)));
    api.mplusDungeons().then((r) => setDungeons(r.dungeons)).catch(() => setDungeons([]));
  }, []);

  const filteredRuns = useMemo(
    () => (dungeonFilter === "all" ? runs : runs.filter((r) => r.mapId === dungeonFilter)),
    [runs, dungeonFilter],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mythic+</h1>
          {season && (
            <div className="text-xs text-neutral-500">
              {season.name}
              {season.startDate && ` · since ${String(season.startDate).slice(0, 10)}`}
            </div>
          )}
        </div>
        {affixes && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="uppercase tracking-widest text-neutral-500">This week</span>
            {affixes.rotation.map((a) => (
              <span
                key={a.id}
                className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 font-medium text-violet-200"
              >
                {a.name}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="flex gap-1">
        {(["leaderboard", "affixes", "dungeons"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded px-4 py-2 text-sm capitalize",
              tab === t
                ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {tab === "leaderboard" && (
        <>
          {dungeons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Pill active={dungeonFilter === "all"} onClick={() => setDungeonFilter("all")}>
                All dungeons
              </Pill>
              {dungeons.map((d) => (
                <Pill
                  key={d.mapId}
                  active={dungeonFilter === d.mapId}
                  onClick={() => setDungeonFilter(d.mapId)}
                >
                  {d.name}
                </Pill>
              ))}
            </div>
          )}
          {filteredRuns.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
              No runs recorded yet this season.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-900/80">
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-500">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Character</th>
                    <th className="px-4 py-2">Dungeon</th>
                    <th className="px-4 py-2">Key</th>
                    <th className="px-4 py-2">Timer</th>
                    <th className="px-4 py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
                  {filteredRuns.map((r, i) => (
                    <tr key={`${r.guid}-${r.mapId}`}>
                      <td className="px-4 py-2 font-mono text-neutral-400">#{i + 1}</td>
                      <td className="px-4 py-2">
                        <span className="font-semibold">{r.name}</span>
                        <span className="ml-2 text-xs text-neutral-500">
                          {r.race} {r.className}
                        </span>
                      </td>
                      <td className="px-4 py-2">{r.dungeon}</td>
                      <td className="px-4 py-2">
                        <span className="rounded bg-violet-500/15 px-2 py-0.5 font-mono text-violet-200">
                          +{r.keyLevel}
                        </span>
                      </td>
                      <td
                        className={[
                          "px-4 py-2 font-mono",
                          r.inTime ? "text-emerald-300" : "text-red-300",
                        ].join(" ")}
                      >
                        {r.timer}
                        {!r.inTime && " ⌚"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-violet-200">
                        {r.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "affixes" && affixes && (
        <div className="grid gap-3 md:grid-cols-3">
          {affixes.rotation.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4"
            >
              <div className="mb-1 text-lg font-semibold text-violet-200">{a.name}</div>
              {a.description && (
                <div className="text-sm text-neutral-400">{a.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "dungeons" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dungeons.map((d) => (
            <div
              key={d.mapId}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4"
            >
              <div className="text-sm font-semibold">{d.name}</div>
              <div className="mt-1 text-xs text-neutral-500">
                Time limit · {Math.floor(d.timeLimitSec / 60)}:{String(d.timeLimitSec % 60).padStart(2, "0")}
              </div>
            </div>
          ))}
          {dungeons.length === 0 && (
            <div className="col-span-full text-sm text-neutral-500">
              No dungeons configured.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({
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
