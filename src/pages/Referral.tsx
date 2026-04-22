import { useEffect, useState } from "react";
import { api, type Referral } from "../api/cms";

export default function ReferralPage() {
  const [r, setR] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.referral().then(setR).catch((e) => setError(String(e)));
  }, []);

  const copy = async () => {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (error) return <div className="text-red-300">{error}</div>;
  if (!r) return <div className="text-neutral-500">Loading…</div>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Refer a friend</h1>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="text-xs uppercase tracking-widest text-neutral-500">Your link</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={r.link}
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={copy}
            className="rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          Code:{" "}
          <span className="font-mono text-neutral-300">{r.code}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Signups" value={r.signups} />
        <Stat label="Active" value={r.active} highlight />
        <Stat label="Earned" value={`${r.rewardsEarned}g`} />
        <Stat label="Pending" value={`${r.rewardsPending}g`} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border p-4 text-center",
        highlight
          ? "border-violet-500/60 bg-violet-500/10"
          : "border-neutral-800 bg-neutral-900/60",
      ].join(" ")}
    >
      <div className="text-xs uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-2xl text-neutral-100">{value}</div>
    </div>
  );
}

