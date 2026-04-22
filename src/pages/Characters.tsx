import { useEffect, useState } from "react";
import { api, type Character } from "../api/cms";

const FACTION_COLORS: Record<Character["faction"], string> = {
  Alliance: "text-sky-300",
  Horde: "text-red-400",
};

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
                        <span className={["font-semibold", CLASS_COLORS[c.className] ?? ""].join(" ")}>
                          {c.name}
                        </span>
                        <span className={["text-xs", FACTION_COLORS[c.faction]].join(" ")}>
                          {c.faction}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        {c.race} {c.className} · Lv{c.level}
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

      <main className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6">
        {selected && <CharacterDetail c={selected} />}
      </main>
    </div>
  );
}

function CharacterDetail({ c }: { c: Character }) {
  const classColor = CLASS_COLORS[c.className] ?? "text-neutral-100";
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className={["text-3xl font-semibold tracking-tight", classColor].join(" ")}>
            {c.name}
          </h2>
          <span className={["text-sm", FACTION_COLORS[c.faction]].join(" ")}>
            {c.faction}
          </span>
          {c.online && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-neutral-400">
          Level {c.level} {c.race} {c.className}
          {c.gender ? ` · ${c.gender}` : ""}
        </div>
        {c.guild && (
          <div className="mt-1 text-sm text-neutral-500">
            &lt;<span className="text-violet-300">{c.guild}</span>&gt;
          </div>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gold" value={formatMoney(c.money)} />
        <Stat label="Honor" value={numberFmt(c.honorPoints)} />
        <Stat label="HKs" value={numberFmt(c.totalKills)} />
        <Stat label="Played" value={formatPlayed(c.totalPlayedSec)} />
      </section>

      <section className="text-xs text-neutral-500">
        Last played: <span className="font-mono text-neutral-300">{new Date(c.lastPlayed).toLocaleString()}</span>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-neutral-100">{value}</div>
    </div>
  );
}

function numberFmt(n?: number): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString();
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
