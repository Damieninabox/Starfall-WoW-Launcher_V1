import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, type AccountPoints, type VoteSite } from "../api/cms";
import { useT } from "../i18n/useT";

export default function Vote() {
  const t = useT();
  const [sites, setSites] = useState<VoteSite[]>([]);
  const [points, setPoints] = useState<AccountPoints | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [s, p] = await Promise.all([api.voteSites(), api.accountPoints()]);
      setSites(s.sites);
      setPoints(p);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleVote = async (site: VoteSite) => {
    setError(null);
    setStatus(null);
    setBusyId(site.id);
    try {
      // Open the vote site in the user's default browser so they can complete
      // the vote there, then credit them in our CMS.
      await openUrl(site.url).catch(() => {});
      const r = await api.vote(site.id);
      if (r.ok) {
        setStatus(t("vote.success", { points: r.pointsAwarded ?? 0 }));
        await reload();
      } else if (r.error === "cooldown" && r.nextVoteMs) {
        const hrs = Math.ceil(r.nextVoteMs / 3_600_000);
        setError(t("vote.cooldown", { hours: hrs }));
      } else {
        setError(r.error ?? t("vote.failed"));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("vote.title")}</h1>
        <p className="text-sm text-neutral-400">
          {t("vote.subtitle")}
        </p>
      </header>

      {points && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t("vote.votePoints")} value={points.vote_points} accent="violet" />
          <Stat label={t("vote.donationPoints")} value={points.donation_points} accent="amber" />
          <Stat label={t("vote.totalVotes")} value={points.total_votes} />
        </section>
      )}

      {status && (
        <div className="rounded border border-emerald-900/60 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {status}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {sites.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          {t("vote.noSites", { table: "starfall_cms.vote_sites" })}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sites.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-4 rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4"
            >
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  className="h-12 w-12 rounded border border-neutral-800 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-xs text-neutral-500">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-neutral-500">
                  {t("vote.cooldownHours", { points: s.pointsReward, hours: s.cooldownHours })}
                </div>
              </div>
              <button
                onClick={() => handleVote(s)}
                disabled={busyId === s.id}
                className="rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
              >
                {busyId === s.id ? t("vote.voting") : t("vote.action")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "violet" | "amber";
}) {
  const ring =
    accent === "violet"
      ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
      : accent === "amber"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
        : "border-neutral-800 bg-neutral-900/60 text-neutral-100";
  return (
    <div className={["rounded-lg border p-4 text-center", ring].join(" ")}>
      <div className="text-xs uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value.toLocaleString()}</div>
    </div>
  );
}
