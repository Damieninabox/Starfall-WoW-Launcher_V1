import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  api,
  type AffixesResponse,
  type MplusDungeon,
  type MplusRun,
  type MplusSeason,
} from "../api/cms";
import { dungeonImage } from "../lib/icons";
import {
  AFFIXES,
  POOL_META,
  findAffix,
  iconUrlFor,
  type Affix,
  type AffixPool,
} from "../lib/affixes";

type Tab = "leaderboard" | "affixes" | "dungeons";

export default function MythicPlus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): Tab => {
    const t = searchParams.get("tab");
    return t === "affixes" || t === "dungeons" || t === "leaderboard" ? t : "leaderboard";
  })();
  const [tab, setTabRaw] = useState<Tab>(initialTab);
  const setTab = (next: Tab) => {
    setTabRaw(next);
    const params = new URLSearchParams(searchParams);
    if (next === "leaderboard") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
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
            {affixes.rotation.map((a) => {
              const resolved = findAffix({ id: a.id, name: a.name });
              const color = resolved ? POOL_META[resolved.pool].color : "#7c3aed";
              return (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium"
                  style={{
                    borderColor: `${color}60`,
                    backgroundColor: `${color}14`,
                    color,
                  }}
                >
                  {resolved && (
                    <img
                      src={iconUrlFor(resolved)}
                      alt=""
                      className="h-4 w-4 rounded-sm"
                      draggable={false}
                    />
                  )}
                  {a.name}
                </span>
              );
            })}
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

      {tab === "affixes" && affixes && <AffixesTab affixes={affixes} />}

      {tab === "dungeons" && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dungeons.map((d) => {
            const img = dungeonImage(d.name);
            return (
              <div
                key={d.mapId}
                className="group relative overflow-hidden rounded-lg border border-violet-500/20 bg-neutral-900/60"
              >
                {img && (
                  <img
                    src={img}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    className="h-32 w-full object-cover opacity-70 transition-opacity group-hover:opacity-100"
                    draggable={false}
                  />
                )}
                <div className="p-4">
                  <div className="text-sm font-semibold">{d.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Time limit · {Math.floor(d.timeLimitSec / 60)}:{String(d.timeLimitSec % 60).padStart(2, "0")}
                  </div>
                </div>
              </div>
            );
          })}
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

function AffixesTab({ affixes }: { affixes: AffixesResponse }) {
  const [showAll, setShowAll] = useState(false);
  const [libraryTab, setLibraryTab] = useState<AffixPool>("mid");

  // Resolve the server-authored rotation to our local lookup, split into pool triplet.
  const resolved = affixes.rotation
    .map((a) => findAffix({ id: a.id, name: a.name }))
    .filter((a): a is Affix => a !== null);
  const featured: Record<AffixPool, Affix | undefined> = {
    low: resolved.find((a) => a.pool === "low"),
    mid: resolved.find((a) => a.pool === "mid"),
    high: resolved.find((a) => a.pool === "high"),
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Featured 3 cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {(["low", "mid", "high"] as AffixPool[]).map((pool) => {
          const a = featured[pool];
          return a ? (
            <FeaturedAffixCard key={pool} affix={a} />
          ) : (
            <UnknownAffixCard key={pool} pool={pool} />
          );
        })}
      </div>

      {/* Expander */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowAll((s) => !s)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-[12px] font-bold uppercase tracking-wider text-white/50 transition-colors hover:border-white/25 hover:text-white/90"
        >
          {showAll ? "Hide full library" : "View all 15 affixes"}
          <span
            className={[
              "inline-block transition-transform",
              showAll ? "rotate-180" : "",
            ].join(" ")}
          >
            ▾
          </span>
        </button>
      </div>

      {/* Full library */}
      {showAll && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(POOL_META) as AffixPool[]).map((p) => {
              const meta = POOL_META[p];
              const isActive = libraryTab === p;
              return (
                <button
                  key={p}
                  onClick={() => setLibraryTab(p)}
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[12px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    backgroundColor: isActive ? `${meta.color}1a` : "rgba(255,255,255,0.03)",
                    borderColor: isActive ? `${meta.color}55` : "rgba(255,255,255,0.08)",
                    color: isActive ? meta.color : "rgba(255,255,255,0.45)",
                  }}
                >
                  {meta.label}
                  <span className="font-mono text-[10px] opacity-60">{meta.range}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {AFFIXES.filter((a) => a.pool === libraryTab).map((affix) => (
              <LibraryAffixTile key={affix.id} affix={affix} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedAffixCard({ affix }: { affix: Affix }) {
  const meta = POOL_META[affix.pool];
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white/[0.02] p-5 backdrop-blur-sm"
      style={{ borderColor: `${meta.color}35`, boxShadow: `0 0 40px ${meta.color}15` }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: meta.color }} />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full"
        style={{ background: `radial-gradient(circle, ${meta.color}25 0%, transparent 70%)` }}
      />
      <div className="mb-4 flex items-center gap-3">
        <AffixIconBox affix={affix} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight text-white">{affix.name}</h3>
        </div>
      </div>
      <p className="mb-2 text-[13px] leading-relaxed text-white/65">{affix.detail}</p>
      {affix.flavor && (
        <p
          className="mt-3 border-l-2 pl-2.5 text-[11px] italic leading-relaxed text-white/30"
          style={{ borderColor: `${meta.color}50` }}
        >
          “{affix.flavor}”
        </p>
      )}
    </div>
  );
}

function LibraryAffixTile({ affix }: { affix: Affix }) {
  const meta = POOL_META[affix.pool];
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all hover:border-white/[0.15] hover:bg-white/[0.04]">
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl"
        style={{ backgroundColor: `${meta.color}88` }}
      />
      <div className="mb-2 flex items-center gap-2.5">
        <AffixIconBox affix={affix} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-white">{affix.name}</p>
        </div>
      </div>
      <p className="line-clamp-3 text-[11px] leading-relaxed text-white/45">{affix.short}</p>
    </div>
  );
}

function UnknownAffixCard({ pool }: { pool: AffixPool }) {
  const meta = POOL_META[pool];
  return (
    <div
      className="rounded-xl border border-dashed p-5 text-center"
      style={{ borderColor: `${meta.color}30` }}
    >
      <p className="text-xs text-white/40">
        Waiting for the next rotation to be posted by the realm.
      </p>
    </div>
  );
}

function AffixIconBox({ affix, size }: { affix: Affix; size: number }) {
  const meta = POOL_META[affix.pool];
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border"
      style={{
        width: size,
        height: size,
        borderColor: `${meta.color}35`,
        backgroundColor: `${meta.color}10`,
      }}
    >
      <img
        src={iconUrlFor(affix)}
        alt={affix.name}
        className="h-full w-full object-cover"
        draggable={false}
      />
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
