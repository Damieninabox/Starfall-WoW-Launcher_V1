import { useEffect, useState } from "react";
import { api, type ArenaTeam } from "../api/cms";
import { CURRENCY_ICONS, classIcon } from "../lib/icons";

type Bracket = "2v2" | "3v3" | "soloq-3v3" | "soloq-1v1";

const TABS: { id: Bracket; label: string; iconKey: keyof typeof CURRENCY_ICONS; placeholder?: boolean }[] = [
  { id: "2v2", label: "Arena 2v2", iconKey: "arena2v2" },
  { id: "3v3", label: "Arena 3v3", iconKey: "arena3v3" },
  { id: "soloq-3v3", label: "3v3 Solo Shuffle", iconKey: "arena3v3", placeholder: true },
  { id: "soloq-1v1", label: "1v1 Solo", iconKey: "arena2v2", placeholder: true },
];

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

export default function LeaderboardPvP() {
  const [active, setActive] = useState<Bracket>("2v2");
  const [teams, setTeams] = useState<ArenaTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const tab = TABS.find((t) => t.id === active);
    if (!tab || tab.placeholder) {
      setTeams([]);
      return;
    }
    setLoading(true);
    api
      .arena(active as "2v2" | "3v3")
      .then((r) => setTeams(r.teams))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [active]);

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={[
              "flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
              active === t.id
                ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
            ].join(" ")}
          >
            <img
              src={CURRENCY_ICONS[t.iconKey]}
              alt=""
              className="h-5 w-5 rounded"
              draggable={false}
            />
            {t.label}
            {t.placeholder && (
              <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neutral-500">
                soon
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab.placeholder && (
        <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center">
          <div className="mb-2 text-lg font-semibold text-neutral-300">
            {activeTab.label}
          </div>
          <div className="text-sm text-neutral-500">
            Solo queue backend isn't wired up yet. Leaderboard will light up
            automatically once the queue records are posted by the core.
          </div>
        </div>
      )}

      {!activeTab.placeholder && (
        <>
          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {loading && <div className="text-sm text-neutral-500">Loading…</div>}
          {!loading && teams.length === 0 && !error && (
            <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
              No teams in this bracket yet.
            </div>
          )}
          {teams.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-violet-500/20">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-900/80">
                  <tr className="text-left text-xs uppercase tracking-widest text-neutral-500">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Team</th>
                    <th className="px-4 py-2">Rating</th>
                    <th className="px-4 py-2">Record</th>
                    <th className="px-4 py-2">Win %</th>
                    <th className="px-4 py-2">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
                  {teams.map((t, i) => (
                    <tr key={t.teamId}>
                      <td className="px-4 py-2 font-mono text-neutral-400">
                        #{i + 1}
                      </td>
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 font-mono text-violet-200">
                        {t.rating}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-400">
                        {t.seasonWins} – {t.seasonGames - t.seasonWins}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span
                          className={
                            t.winRate >= 50 ? "text-emerald-300" : "text-neutral-400"
                          }
                        >
                          {t.winRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {t.members.map((m) => {
                            const iconSrc = classIcon(m.className);
                            return (
                              <span
                                key={m.guid}
                                className="inline-flex items-center gap-1"
                              >
                                {iconSrc && (
                                  <img
                                    src={iconSrc}
                                    alt=""
                                    className="h-4 w-4 rounded"
                                    draggable={false}
                                  />
                                )}
                                <span className={CLASS_COLORS[m.className] ?? ""}>
                                  {m.name}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
