import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Character } from "../api/cms";
import {
  classIcon,
  classIconColor,
  raceIcon,
  racePortrait,
  factionIcon,
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

  useEffect(() => {
    api
      .characters()
      .then((r) => {
        const sorted = [...r.characters].sort((a, b) =>
          b.lastPlayed.localeCompare(a.lastPlayed),
        );
        setChars(sorted);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-red-300">{error}</div>;
  if (!chars) return <div className="text-neutral-500">Loading characters…</div>;
  if (chars.length === 0)
    return <div className="text-neutral-500">No characters on this account yet.</div>;

  const byRealm = groupBy(chars, (c) => c.realm);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-xs text-neutral-500">
        {chars.length} character{chars.length === 1 ? "" : "s"} · click to open armory
      </div>
      {Array.from(byRealm.entries()).map(([realm, list]) => (
        <section key={realm}>
          <h3 className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
            {realm}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <li key={c.id}>
                <CharacterTile c={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CharacterTile({ c }: { c: Character }) {
  const clsColor = classIconColor(c.className);
  const clsFlat = classIcon(c.className);
  const portrait = racePortrait(c.race, c.gender);
  const fallbackRace = raceIcon(c.race);
  return (
    <Link
      to={`/armory/${encodeURIComponent(c.name)}`}
      className="flex items-start gap-3 rounded border border-neutral-800 bg-neutral-900/60 p-3 transition-colors hover:border-violet-500/60 hover:bg-violet-500/[0.04]"
    >
      {(portrait || fallbackRace) && (
        <img
          src={portrait ?? fallbackRace!}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (fallbackRace && el.src !== fallbackRace) el.src = fallbackRace;
          }}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded object-cover ring-1 ring-neutral-800"
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
        {c.online && (
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Online
          </div>
        )}
      </div>
    </Link>
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
