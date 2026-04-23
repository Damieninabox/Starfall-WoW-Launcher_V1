import { useEffect, useState } from "react";
import { api, type Character } from "../api/cms";
import {
  classIcon,
  classIconColor,
  raceIcon,
  racePortrait,
  factionIcon,
  CURRENCY_ICONS,
} from "../lib/icons";

const CLASS_COLORS: Record<string, string> = {
  Warrior: "text-[#C69B6D]",
  Paladin: "text-[#F48CBA]",
  Hunter: "text-[#AAD372]",
  Rogue: "text-[#FFF468]",
  Priest: "text-[#FFFFFF]",
  "Death Knight": "text-[#C41E3A]",
  Shaman: "text-[#0070DD]",
  Mage: "text-[#3FC7EB]",
  Warlock: "text-[#8788EE]",
  Druid: "text-[#FF7C0A]",
};

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
                const clsColor = classIconColor(c.className);
                const clsFlat = classIcon(c.className);
                const portrait = racePortrait(c.race, c.gender);
                const fallbackRace = raceIcon(c.race);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelected(c)}
                      className={[
                        "flex w-full items-start gap-3 rounded border p-3 text-left transition-colors",
                        isSel
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700",
                      ].join(" ")}
                    >
                      {(portrait || fallbackRace) && (
                        <img
                          src={portrait ?? fallbackRace!}
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            if (fallbackRace && el.src !== fallbackRace) el.src = fallbackRace;
                          }}
                          alt=""
                          className="h-11 w-11 flex-shrink-0 rounded object-cover ring-1 ring-neutral-800"
                          draggable={false}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {(clsColor || clsFlat) && (
                            <img
                              src={clsColor ?? clsFlat!}
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                if (clsFlat && el.src !== clsFlat) el.src = clsFlat;
                              }}
                              alt=""
                              className="h-5 w-5 flex-shrink-0"
                              draggable={false}
                            />
                          )}
                          <span
                            className={[
                              "truncate font-semibold",
                              CLASS_COLORS[c.className] ?? "",
                            ].join(" ")}
                          >
                            {c.name}
                          </span>
                          <img
                            src={factionIcon(c.faction)}
                            alt={c.faction}
                            title={c.faction}
                            className="ml-auto h-4 w-4 flex-shrink-0"
                            draggable={false}
                          />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-neutral-400">
                          {c.race} {c.className} · Lv{c.level}
                        </div>
                        {c.guild && (
                          <div className="truncate text-xs text-neutral-500">
                            &lt;{c.guild}&gt;
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </aside>

      <main className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6">
        {selected && <CharacterDetail c={selected} />}
      </main>
    </div>
  );
}

function CharacterDetail({ c }: { c: Character }) {
  console.log(
    `[char] ${c.name} raw money=${c.money} (formatted: ${formatMoney(c.money)}) honor=${c.honorPoints} kills=${c.totalKills}`,
  );
  const classColor = CLASS_COLORS[c.className] ?? "text-neutral-100";
  const clsColor = classIconColor(c.className);
  const clsFlat = classIcon(c.className);
  const portrait = racePortrait(c.race, c.gender);
  const fallbackRace = raceIcon(c.race);
  const factionImg = factionIcon(c.faction);
  const honorIcon =
    c.faction === "Horde" ? CURRENCY_ICONS.honorHorde : CURRENCY_ICONS.honorAlliance;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        {(portrait || fallbackRace) && (
          <img
            src={portrait ?? fallbackRace!}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (fallbackRace && el.src !== fallbackRace) el.src = fallbackRace;
            }}
            alt=""
            className="h-20 w-20 rounded-lg object-cover ring-1 ring-violet-500/30"
            draggable={false}
          />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            {(clsColor || clsFlat) && (
              <img
                src={clsColor ?? clsFlat!}
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  if (clsFlat && el.src !== clsFlat) el.src = clsFlat;
                }}
                alt=""
                className="h-8 w-8"
                draggable={false}
              />
            )}
            <h2 className={["text-3xl font-semibold tracking-tight", classColor].join(" ")}>
              {c.name}
            </h2>
            <img
              src={factionImg}
              alt={c.faction}
              title={c.faction}
              className="h-7 w-7"
              draggable={false}
            />
            {c.online && (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
              </span>
            )}
          </div>
          <div className="mt-2 text-sm text-neutral-400">
            Level {c.level} {c.race} {c.className}
            {c.gender ? ` · ${c.gender}` : ""}
          </div>
          {c.guild && (
            <div className="mt-1 text-sm text-neutral-500">
              &lt;<span className="text-violet-300">{c.guild}</span>&gt;
            </div>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gold" value={formatMoney(c.money)} iconUrl={CURRENCY_ICONS.gold} />
        <Stat label="Honor" value={numberFmt(c.honorPoints)} iconUrl={honorIcon} />
        <Stat label="HKs" value={numberFmt(c.totalKills)} iconUrl={CURRENCY_ICONS.kills} />
        <Stat label="Played" value={formatPlayed(c.totalPlayedSec)} iconUrl={CURRENCY_ICONS.played} />
      </section>

      <section className="text-xs text-neutral-500">
        Last played: <span className="font-mono text-neutral-300">{new Date(c.lastPlayed).toLocaleString()}</span>
      </section>
    </div>
  );
}

function Stat({ label, value, iconUrl }: { label: string; value: string; iconUrl?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
      {iconUrl && (
        <img
          src={iconUrl}
          alt=""
          className="h-8 w-8 rounded ring-1 ring-neutral-800"
          draggable={false}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
        <div className="mt-0.5 font-mono text-lg text-neutral-100 truncate">{value}</div>
      </div>
    </div>
  );
}

function numberFmt(n?: number): string {
  if (n === undefined || n === null) return "—";
  // Force comma thousands separator — the browser's locale sometimes uses
  // a thin-space ("2 769") which reads weirdly.
  return n.toLocaleString("en-US");
}

function formatMoney(copper?: number): string {
  if (copper === undefined || copper === null) return "—";
  if (copper === 0) return "0c";
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const cop = copper % 100;
  if (gold > 0) return `${gold.toLocaleString()}g ${silver}s ${cop}c`;
  if (silver > 0) return `${silver}s ${cop}c`;
  return `${cop}c`;
}

function formatPlayed(sec?: number): string {
  if (sec === undefined || sec === null) return "—";
  if (sec === 0) return "0m";
  const h = Math.floor(sec / 3600);
  if (h === 0) {
    const m = Math.floor(sec / 60);
    return `${m}m`;
  }
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
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
