import { useEffect, useMemo, useState } from "react";
import { api, type WorldEvent } from "../api/cms";
import { useT } from "../i18n/useT";

export default function Calendar() {
  const t = useT();
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .worldEvents()
      .then((r) => setEvents(r.events))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const active = useMemo(() => events.filter((e) => e.active), [events]);
  const upcoming = useMemo(
    () => events.filter((e) => !e.active).slice(0, 30),
    [events],
  );

  if (loading) return <div className="text-neutral-500">{t("calendar.loading")}</div>;
  if (error)
    return (
      <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
        {error}
      </div>
    );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
        <p className="text-sm text-neutral-400">
          {t("calendar.subtitle", { table: "game_event" })}
        </p>
      </header>

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            {t("calendar.happeningNow")}
          </h2>
          <ul className="flex flex-col gap-2">
            {active.map((ev) => (
              <EventRow key={`a-${ev.id}`} ev={ev} now={now} highlight t={t} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-300">
          {t("calendar.upcoming")}
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
            {t("calendar.nothing")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((ev) => (
              <EventRow key={`u-${ev.id}`} ev={ev} now={now} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventRow({
  ev,
  now,
  highlight,
  t,
}: {
  ev: WorldEvent;
  now: number;
  highlight?: boolean;
  t: (key: Parameters<ReturnType<typeof import("../i18n/useT").useT>>[0], params?: Record<string, string | number>) => string;
}) {
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  const delta = (highlight ? end.getTime() : start.getTime()) - now;
  const label = highlight
    ? t("calendar.endsIn", { delta: formatDelta(delta) })
    : t("calendar.startsIn", { delta: formatDelta(delta) });
  return (
    <li
      className={[
        "flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm",
        highlight
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-violet-500/20 bg-neutral-900/60",
      ].join(" ")}
    >
      <div className="flex-1 min-w-[14rem]">
        <div className="font-semibold text-neutral-100">{ev.title}</div>
        <div className="text-xs text-neutral-500">
          {start.toLocaleString()} → {end.toLocaleString()}
          {ev.recurs && (
            <span className="ml-2 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-widest">
              {t("calendar.every", { duration: formatDuration(ev.occurrenceMin) })}
            </span>
          )}
        </div>
      </div>
      <div
        className={[
          "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
          highlight
            ? "bg-emerald-500/20 text-emerald-200"
            : "bg-violet-500/15 text-violet-200",
        ].join(" ")}
      >
        {label}
      </div>
    </li>
  );
}

function formatDelta(ms: number): string {
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60_000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}
