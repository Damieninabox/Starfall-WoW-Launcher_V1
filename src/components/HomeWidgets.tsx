import { useEffect, useState } from "react";
import {
  api,
  type AffixesResponse,
  type Guild,
  type GuildEvent,
  type NewsEntry,
  type ServerStatus,
} from "../api/cms";

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
  const [s, setS] = useState<ServerStatus | null>(null);
  useEffect(() => {
    const tick = () => api.serverStatus().then(setS).catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <SectionCard title="Server status">
      {!s && <div className="text-sm text-neutral-500">Loading…</div>}
      {s && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={[
                "h-2 w-2 rounded-full",
                s.online ? "bg-emerald-400" : "bg-red-500",
              ].join(" ")}
            />
            <span className="font-medium">{s.online ? "Online" : "Offline"}</span>
            <span className="text-neutral-500">· {s.realm}</span>
          </div>
          <div className="grid grid-cols-2 gap-y-1 text-xs text-neutral-400">
            <div>
              Pop:{" "}
              <span className="font-mono text-neutral-200">{s.population}</span>
            </div>
            <div>
              Uptime:{" "}
              <span className="font-mono text-neutral-200">{s.uptimeHours}h</span>
            </div>
            <div>
              TPS: <span className="font-mono text-neutral-200">{s.tps}</span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export function NewsCard() {
  const [n, setN] = useState<NewsEntry[]>([]);
  const [active, setActive] = useState<NewsEntry | null>(null);
  useEffect(() => {
    api.news().then((r) => setN(r.news)).catch(() => {});
  }, []);
  return (
    <SectionCard title="News">
      {n.length === 0 && <div className="text-sm text-neutral-500">No news.</div>}
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
                      Pinned
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
  const [a, setA] = useState<AffixesResponse | null>(null);
  useEffect(() => {
    api.affixes().then(setA).catch(() => {});
  }, []);
  return (
    <SectionCard title="Mythic+ affixes">
      {!a && <div className="text-sm text-neutral-500">Loading…</div>}
      {a && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-neutral-500">Week {a.week}</div>
          <div className="flex flex-col gap-2">
            {a.rotation.map((affix) => (
              <div
                key={affix.id}
                className="rounded border border-neutral-800 bg-neutral-950 p-2"
              >
                <div className="text-sm font-medium">{affix.name}</div>
                <div className="text-xs text-neutral-400">{affix.description}</div>
              </div>
            ))}
          </div>
        </div>
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

