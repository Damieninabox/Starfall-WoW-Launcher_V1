import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type AffixesResponse,
  type Guild,
  type GuildEvent,
  type NewsEntry,
  type ServerStatus,
  type WorldEvent,
} from "../api/cms";
import { POOL_META, findAffix, iconUrlFor, localizeAffix } from "../lib/affixes";
import { useT } from "../i18n/useT";
import { useI18nStore } from "../i18n/store";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ServerStatusCard() {
  const t = useT();
  const [s, setS] = useState<ServerStatus | null>(null);
  useEffect(() => {
    const tick = () => api.serverStatus().then(setS).catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <SectionCard title={t("widget.serverStatus")}>
      {!s && <div className="text-sm text-neutral-500">{t("common.loading")}</div>}
      {s && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={[
                "h-2 w-2 rounded-full",
                s.online ? "bg-emerald-400" : "bg-red-500",
              ].join(" ")}
            />
            <span className="font-medium">{s.online ? t("common.online") : t("common.offline")}</span>
            <span className="text-neutral-500">· {s.realm}</span>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs text-neutral-400">
            <div>
              {t("widget.population")}{" "}
              <span className="font-mono text-neutral-200">{s.population}</span>
            </div>
            <div>
              {t("widget.uptime")}{" "}
              <span className="font-mono text-neutral-200">{s.uptimeHours}h</span>
            </div>
            <div>
              {t("widget.tps")} <span className="font-mono text-neutral-200">{s.tps}</span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function NewsCard() {
  const t = useT();
  const [n, setN] = useState<NewsEntry[]>([]);
  const [active, setActive] = useState<NewsEntry | null>(null);
  useEffect(() => {
    api.news().then((r) => setN(r.news)).catch(() => {});
  }, []);
  return (
    <SectionCard title={t("widget.news")}>
      {n.length === 0 && <div className="text-sm text-neutral-500">{t("widget.noNews")}</div>}
      <ul className="flex flex-col gap-3">
        {n.slice(0, 4).map((item) => (
          <li key={item.id}>
            <button
              onClick={() => setActive(item)}
              className="group flex w-full flex-col gap-1 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  {item.pinned && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
                      {t("widget.pinned")}
                    </span>
                  )}
                  <div className="text-sm font-medium group-hover:text-violet-200">
                    {item.title}
                  </div>
                </div>
                <div className="whitespace-nowrap text-xs text-neutral-500">
                  {item.date}
                </div>
              </div>
              <div className="line-clamp-2 text-xs text-neutral-400">{item.body}</div>
            </button>
          </li>
        ))}
      </ul>
      {active && <NewsModal entry={active} onClose={() => setActive(null)} />}
    </SectionCard>
  );
}

function NewsModal({ entry, onClose }: { entry: NewsEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl border border-violet-500/30 bg-neutral-950 p-6 shadow-2xl"
      >
        <header className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-violet-300">
              {entry.tag}
              {entry.author && <span className="text-neutral-500">· {entry.author}</span>}
              <span className="text-neutral-500">· {entry.date}</span>
            </div>
            <h2 className="text-2xl font-semibold">{entry.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800"
          >
            Close (Esc)
          </button>
        </header>
        {entry.imageUrl && (
          <img
            src={entry.imageUrl}
            alt={entry.title}
            className="mb-4 w-full rounded border border-neutral-800 object-cover"
          />
        )}
        <div className="whitespace-pre-wrap text-sm text-neutral-200">
          {entry.body}
        </div>
      </div>
    </div>
  );
}

export function AffixesCard() {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const [a, setA] = useState<AffixesResponse | null>(null);
  useEffect(() => {
    api.affixes().then(setA).catch(() => {});
  }, []);
  return (
    <SectionCard title={t("widget.affixes")}>
      {!a && <div className="text-sm text-neutral-500">{t("common.loading")}</div>}
      {a && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-neutral-500">{t("widget.week", { week: a.week.match(/W(\d+)/)?.[1] ?? a.week })}</div>
          {a.rotation.length === 0 ? (
            <div className="text-xs italic text-neutral-500">
              {t("widget.waitingRotation")}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {a.rotation.map((api) => {
                const resolved = findAffix({ id: api.id, name: api.name });
                const localized = resolved ? localizeAffix(resolved, locale) : null;
                const meta = resolved ? POOL_META[resolved.pool] : null;
                const color = meta?.color ?? "#7c3aed";
                const short = localized?.short ?? api.description;
                const displayName = localized?.name ?? api.name;
                return (
                  <li
                    key={api.id}
                    className="relative flex items-start gap-2.5 overflow-hidden rounded border border-white/[0.06] bg-white/[0.02] p-2 pl-2.5"
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-0.5"
                      style={{ backgroundColor: color }}
                    />
                    {resolved ? (
                      <img
                        src={iconUrlFor(resolved)}
                        alt=""
                        className="h-9 w-9 flex-shrink-0 rounded border"
                        style={{ borderColor: `${color}40` }}
                        draggable={false}
                      />
                    ) : (
                      <div
                        className="h-9 w-9 flex-shrink-0 rounded border"
                        style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-semibold text-neutral-100">
                        {displayName}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-400">
                        {short}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/leaderboards/mythicplus?tab=affixes"
            className="self-start text-xs text-violet-300 hover:text-violet-200"
          >
            {t("widget.fullRotation")}
          </Link>
        </div>
      )}
    </SectionCard>
  );
}

export function WorldEventsCard() {
  const t = useT();
  const [events, setEvents] = useState<WorldEvent[]>([]);
  useEffect(() => {
    api.worldEvents().then((r) => setEvents(r.events)).catch(() => {});
  }, []);
  const active = events.filter((e) => e.active).slice(0, 3);
  const upcoming = events.filter((e) => !e.active).slice(0, 4);
  return (
    <SectionCard title={t("widget.calendar")}>
      {events.length === 0 ? (
        <div className="text-sm text-neutral-500">{t("widget.noEvents")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-emerald-300">
                {t("widget.happeningNow")}
              </div>
              <ul className="flex flex-col gap-1">
                {active.map((ev) => (
                  <li
                    key={`a-${ev.id}`}
                    className="flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs"
                  >
                    <span className="truncate font-medium text-emerald-100">
                      {ev.title}
                    </span>
                    <span className="whitespace-nowrap font-mono text-[10px] text-emerald-300">
                      {t("widget.endsOn", { date: new Date(ev.end).toLocaleDateString() })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-violet-300">
                {t("widget.upcoming")}
              </div>
              <ul className="flex flex-col gap-1 text-xs">
                {upcoming.map((ev) => (
                  <li
                    key={`u-${ev.id}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{ev.title}</span>
                    <span className="whitespace-nowrap font-mono text-neutral-500">
                      {new Date(ev.start).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            to="/calendar"
            className="self-start text-xs text-violet-300 hover:text-violet-200"
          >
            {t("widget.fullCalendar")}
          </Link>
        </div>
      )}
    </SectionCard>
  );
}

export function TopGuildsCard() {
  const t = useT();
  const [guilds, setGuilds] = useState<
    { guildId: number; name: string; motd: string; memberCount: number }[]
  >([]);
  useEffect(() => {
    api.topGuilds().then((r) => setGuilds(r.guilds)).catch(() => setGuilds([]));
  }, []);
  return (
    <SectionCard title={t("widget.topGuilds")}>
      {guilds.length === 0 ? (
        <div className="text-sm text-neutral-500">{t("widget.noGuilds")}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {guilds.map((g) => (
            <li
              key={g.guildId}
              className="flex items-baseline justify-between gap-3 border-b border-neutral-800 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-100">
                  {g.name}
                </div>
                {g.motd && (
                  <div className="truncate text-xs italic text-neutral-400">
                    &ldquo;{g.motd}&rdquo;
                  </div>
                )}
              </div>
              <div className="whitespace-nowrap text-xs text-neutral-500">
                {t("widget.members", { count: g.memberCount })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function GuildCard({ guid }: { guid: string }) {
  const [g, setG] = useState<Guild | null>(null);
  const [events, setEvents] = useState<GuildEvent[]>([]);
  useEffect(() => {
    api.guild(guid).then(setG).catch(() => setG(null));
    api
      .guildEvents(guid)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, [guid]);
  if (!g) return null;
  return (
    <SectionCard title={`Guild · ${g.name}`}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="italic text-neutral-300">&ldquo;{g.motd}&rdquo;</div>
        <div className="text-xs text-neutral-500">
          {g.memberCount} members · {g.onlineCount} online now
        </div>
        {events.length > 0 && (
          <>
            <div className="mt-2 text-xs uppercase tracking-widest text-neutral-500">
              Upcoming
            </div>
            <ul className="flex flex-col gap-1 text-xs">
              {events.map((ev) => (
                <li key={ev.id} className="flex justify-between">
                  <span>{ev.title}</span>
                  <span className="font-mono text-neutral-400">
                    {new Date(ev.when).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </SectionCard>
  );
}

