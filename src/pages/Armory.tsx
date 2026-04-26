import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { api, type ArmoryData } from "../api/cms";
import {
  classIcon,
  classIconColor,
  CURRENCY_ICONS,
  raceIcon,
  racePortrait,
  slotIcon,
} from "../lib/icons";
import { useT } from "../i18n/useT";

/* ────────────────────────────────────────────────────── constants ── */

// TrinityCore 4.3.4 race/class IDs.
const RACE_NAMES: Record<number, string> = {
  1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead",
  6: "Tauren", 7: "Gnome", 8: "Troll", 9: "Goblin", 10: "Blood Elf",
  11: "Draenei", 22: "Worgen",
};
const CLASS_NAMES: Record<number, string> = {
  1: "Warrior", 2: "Paladin", 3: "Hunter", 4: "Rogue", 5: "Priest",
  6: "Death Knight", 7: "Shaman", 8: "Mage", 9: "Warlock", 11: "Druid",
};
const ALLIANCE_RACES = new Set([1, 3, 4, 7, 11, 22]);
const factionOf = (race: number): "Alliance" | "Horde" =>
  ALLIANCE_RACES.has(race) ? "Alliance" : "Horde";

const FACTION_COLOR: Record<"Alliance" | "Horde", string> = {
  Alliance: "#4a90e2",
  Horde: "#c41e3a",
};

const QUALITY: Record<number, string> = {
  0: "#9d9d9d", 1: "#ffffff", 2: "#1eff00", 3: "#0070dd",
  4: "#a335ee", 5: "#ff8000", 6: "#e6cc80", 7: "#00ccff",
};

const SLOT_NAMES: Record<number, string> = {
  0: "Head", 1: "Neck", 2: "Shoulders", 3: "Shirt", 4: "Chest",
  5: "Waist", 6: "Legs", 7: "Feet", 8: "Wrists", 9: "Hands",
  10: "Ring 1", 11: "Ring 2", 12: "Trinket 1", 13: "Trinket 2",
  14: "Back", 15: "Main Hand", 16: "Off Hand", 17: "Ranged/Relic", 18: "Tabard",
};
const LEFT_SLOTS = [0, 1, 2, 14, 4, 3, 18, 8];
const RIGHT_SLOTS = [9, 5, 6, 7, 10, 11, 12, 13];
const BOTTOM_SLOTS = [15, 16, 17];

type Tab = "Character" | "Professions" | "Dungeons & Raids" | "Collections" | "Reputation";
const TABS: ReadonlyArray<{ id: Tab; key: "armory.tabs.character" | "armory.tabs.professions" | "armory.tabs.dungeonsRaids" | "armory.tabs.collections" | "armory.tabs.reputation" }> = [
  { id: "Character",        key: "armory.tabs.character" },
  { id: "Professions",      key: "armory.tabs.professions" },
  { id: "Dungeons & Raids", key: "armory.tabs.dungeonsRaids" },
  { id: "Collections",      key: "armory.tabs.collections" },
  { id: "Reputation",       key: "armory.tabs.reputation" },
];

const POWER_TYPE: Record<number, { name: string; color: string }> = {
  1: { name: "Rage", color: "#c41f3b" },
  4: { name: "Energy", color: "#fff569" },
  6: { name: "Runic Power", color: "#00b4ff" },
};
const defaultPower = { name: "Mana", color: "#3b82f6" };

function formatPlayed(seconds: number): string {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  if (h === 0) return `${Math.floor(seconds / 60)}m`;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/* ──────────────────────────────────────────────── tooltip cache ── */

const tooltipCache = new Map<number, string>();

function ItemTooltip({
  itemId,
  anchorRef,
}: {
  itemId: number;
  anchorRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  const [html, setHtml] = useState<string | null>(tooltipCache.get(itemId) ?? null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (tooltipCache.has(itemId)) {
      setHtml(tooltipCache.get(itemId)!);
      return;
    }
    let cancelled = false;
    api
      .itemTooltip(itemId)
      .then((data) => {
        if (cancelled || !data?.html) return;
        tooltipCache.set(itemId, data.html);
        setHtml(data.html);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    if (!html || !tipRef.current || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.right + 10;
    let top = anchor.top;
    if (left + tip.width > vw - 12) left = anchor.left - tip.width - 10;
    if (top + tip.height > vh - 12) top = vh - tip.height - 12;
    if (top < 12) top = 12;
    if (left < 12) left = 12;
    setPos({ left, top });
  }, [html, anchorRef]);

  if (!html) return null;

  return createPortal(
    <div
      ref={tipRef}
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        zIndex: 99999,
        maxWidth: 380,
        pointerEvents: "none",
      }}
      className="wh-tooltip"
      dangerouslySetInnerHTML={{ __html: html }}
    />,
    document.body,
  );
}

/* ──────────────────────────────────────────────────── main page ── */

export default function Armory() {
  const t = useT();
  const { name } = useParams<{ name: string }>();
  const [data, setData] = useState<ArmoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [icons, setIcons] = useState<Map<number, string>>(new Map());
  const [activeTab, setActiveTab] = useState<Tab>("Character");

  useEffect(() => {
    if (!name) return;
    setData(null);
    setError(null);
    setIcons(new Map());
    api
      .armory(name)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [name]);

  useEffect(() => {
    if (!data) return;
    const entries = [...new Set(data.equipment.map((e) => e.itemEntry))];
    if (entries.length === 0) return;
    let cancelled = false;
    Promise.all(
      entries.map((id) =>
        api
          .itemById(id)
          .then((it) => [id, it.iconUrl ?? null] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      const hits = pairs.filter(([, v]) => v !== null) as [number, string][];
      setIcons(new Map(hits));
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) {
    const is404 = /\b404\b/.test(error);
    return (
      <div className="mx-auto max-w-4xl">
        <Link to="/characters" className="text-sm text-[#d4a017] hover:text-[#d4a017]/80">
          {t("armory.back")}
        </Link>
        <div className="mt-16 text-center">
          <SwordsIcon size={48} className="mx-auto text-white/15" />
          <h1 className="mt-4 text-2xl font-bold text-white/80">{t("armory.notFound")}</h1>
          <p className="mt-2 text-sm text-white/50">
            {is404 ? t("armory.notFoundBody", { name: name ?? "" }) : error}
          </p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="text-neutral-500">{t("armory.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/characters"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[#d4a017] hover:text-[#d4a017]/80"
      >
        {t("armory.back")}
      </Link>

      {/* Tab bar */}
      <div className="mb-6 flex gap-0 overflow-x-auto border-b-2 border-[#d4a017]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors sm:px-6 sm:text-sm",
              activeTab === tab.id
                ? "bg-[#d4a017] text-black"
                : "text-[#d4a017]/70 hover:bg-[#d4a017]/10 hover:text-[#d4a017]",
            ].join(" ")}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0d0d0d]/50 p-4 sm:p-6">
        {activeTab === "Character" && <CharacterTab data={data} icons={icons} />}
        {activeTab === "Professions" && <ProfessionsTab professions={data.professions} />}
        {activeTab === "Dungeons & Raids" && (
          <DungeonsRaidsTab mythicPlus={data.mythicPlus} raidProgress={data.raidProgress} />
        )}
        {activeTab === "Collections" && <CollectionsTab collections={data.collections} />}
        {activeTab === "Reputation" && <ReputationTab reputations={data.reputations} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── tabs ── */

function CharacterTab({
  data,
  icons,
}: {
  data: ArmoryData;
  icons: Map<number, string>;
}) {
  const t = useT();
  const char = data.character;
  const raceName = RACE_NAMES[char.race] ?? `Race ${char.race}`;
  const className = CLASS_NAMES[char.class] ?? `Class ${char.class}`;
  const faction = factionOf(char.race);
  const factionColor = FACTION_COLOR[faction];
  const gender = char.gender === 1 ? t("armory.gender.female") : t("armory.gender.male");
  const portrait = racePortrait(raceName, gender) ?? raceIcon(raceName);
  const portraitFallback = raceIcon(raceName);
  const classIconSrc = classIconColor(className) ?? classIcon(className);
  const classIconFallback = classIcon(className);
  const equipBySlot = new Map(data.equipment.map((e) => [e.slot, e]));
  const powerRaw = POWER_TYPE[char.class] ?? defaultPower;
  const powerName =
    char.class === 1 ? t("armory.power.rage") :
    char.class === 4 ? t("armory.power.energy") :
    char.class === 6 ? t("armory.power.runic") :
    t("armory.power.mana");
  const power = { ...powerRaw, name: powerName };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start gap-5 px-2">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 border-[#4a3a1a]/60 bg-[#1a1a1a]">
          {portrait ? (
            <img
              src={portrait}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (portraitFallback && el.src !== portraitFallback) el.src = portraitFallback;
              }}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-white/20">?</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-wide text-[#d4a017] drop-shadow-lg sm:text-4xl">
            {char.name.toUpperCase()}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-[#4a3a1a]/40 bg-[#2a2a2a] px-2.5 py-1 text-xs font-bold text-white/80">
              {t("armory.level", { level: char.level })}
            </span>
            <span className="rounded border border-[#4a3a1a]/40 bg-[#2a2a2a] px-2.5 py-1 text-xs font-bold text-white/80">
              {raceName}
            </span>
            {classIconSrc && (
              <div className="h-7 w-7 overflow-hidden rounded border border-[#4a3a1a]/40">
                <img
                  src={classIconSrc}
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (classIconFallback && el.src !== classIconFallback) el.src = classIconFallback;
                  }}
                  alt={className}
                  title={className}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
            )}
            <span
              className="rounded border px-2.5 py-1 text-xs font-bold"
              style={{
                color: factionColor,
                borderColor: `${factionColor}40`,
                backgroundColor: `${factionColor}15`,
              }}
            >
              {faction}
            </span>
            {char.online && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("common.online")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Health / Power bars — shown only when we have real stats */}
      {data.stats && (
        <div className="mx-auto mb-6 max-w-sm space-y-1">
          <Bar
            label={t("armory.statHealth")}
            value={data.stats.maxHealth}
            color="#22c55e"
            gradient="linear-gradient(to right, #166534, #22c55e)"
          />
          <Bar
            label={power.name}
            value={data.maxPower > 0 ? data.maxPower : 100}
            color={power.color}
            gradient={`linear-gradient(to right, ${power.color}80, ${power.color})`}
          />
        </div>
      )}

      {/* Equipment — Blizzard-style layout */}
      <div className="flex items-stretch justify-center gap-2 sm:gap-4">
        {/* Left column */}
        <div className="flex flex-col justify-center gap-2">
          {LEFT_SLOTS.map((s) => (
            <EquipSlot key={s} slotId={s} item={equipBySlot.get(s)} icons={icons} />
          ))}
        </div>

        {/* Center — stats list or model placeholder */}
        <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-2">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]/60 p-4">
            {data.stats ? (
              <>
                <SectionHeading>{t("armory.baseStats")}</SectionHeading>
                <div className="space-y-2">
                  {(
                    [
                      [t("armory.statHealth"), data.stats.maxHealth, "#22c55e"],
                      [t("armory.strength"), data.stats.strength, "#c79c6e"],
                      [t("armory.agility"), data.stats.agility, "#fff569"],
                      [t("armory.stamina"), data.stats.stamina, "#ff7d0a"],
                      [t("armory.intellect"), data.stats.intellect, "#69ccf0"],
                      [t("armory.spirit"), data.stats.spirit, "#f58cba"],
                      [t("armory.statArmor"), data.stats.armor, "#c0c0c0"],
                      [t("armory.attackPower"), data.stats.attackPower, "#c41f3b"],
                      [t("armory.spellPower"), data.stats.spellPower, "#69ccf0"],
                      [t("armory.crit"), `${data.stats.critPct}%`, "#ff7d0a"],
                      [t("armory.resilience"), data.stats.resilience, "#a335ee"],
                    ] as [string, string | number, string][]
                  ).map(([label, value, color]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between border-b border-white/[0.04] py-1 last:border-0"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</span>
                      <span className="text-sm font-bold" style={{ color }}>
                        {typeof value === "number" ? value.toLocaleString("en-US") : value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-[#333] bg-[#1a1a1a]">
                  <SwordsIcon size={28} className="text-white/15" />
                </div>
                <p className="text-sm font-medium text-white/30">{t("armory.modelPreview")}</p>
                <p className="mt-1 text-xs text-white/15">
                  {t("armory.modelPreviewHint")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col justify-center gap-2">
          {RIGHT_SLOTS.map((s) => (
            <EquipSlot key={s} slotId={s} item={equipBySlot.get(s)} icons={icons} />
          ))}
        </div>
      </div>

      {/* Bottom weapons */}
      <div className="mt-4 flex justify-center gap-2">
        {BOTTOM_SLOTS.map((s) => (
          <EquipSlot key={s} slotId={s} item={equipBySlot.get(s)} icons={icons} />
        ))}
      </div>

      {/* Account totals — always useful and now rendered with currency icons */}
      <div className="mt-8">
        <SectionHeading>{t("armory.accountTotals")}</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CurrencyStat
            label={t("armory.honor")}
            value={char.honorPoints.toLocaleString("en-US")}
            icon={faction === "Horde" ? CURRENCY_ICONS.honorHorde : CURRENCY_ICONS.honorAlliance}
          />
          <CurrencyStat
            label={t("armory.conquest")}
            value={char.conquestPoints.toLocaleString("en-US")}
            icon={faction === "Horde" ? CURRENCY_ICONS.conquestHorde : CURRENCY_ICONS.conquestAlliance}
          />
          <CurrencyStat
            label={t("armory.hks")}
            value={char.totalKills.toLocaleString("en-US")}
            icon={CURRENCY_ICONS.kills}
          />
          <CurrencyStat
            label={t("armory.played")}
            value={formatPlayed(char.totaltime)}
            icon={CURRENCY_ICONS.played}
          />
        </div>
      </div>
    </div>
  );
}

function ProfessionsTab({ professions }: { professions: ArmoryData["professions"] }) {
  const t = useT();
  if (professions.length === 0) {
    return <p className="py-12 text-center text-white/30">{t("armory.noProfessions")}</p>;
  }
  return (
    <div className="mx-auto max-w-lg">
      <SectionHeading>{t("armory.professions")}</SectionHeading>
      <div className="space-y-4">
        {professions.map((prof) => (
          <div key={prof.name} className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-[#4a3a1a]/50 bg-[#1a1a1a]">
              <span className="text-[10px] leading-tight text-white/30">{prof.name.slice(0, 4)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold text-white/90">{prof.name}</span>
                <span className="text-xs text-white/50">
                  {prof.value}/{prof.max}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-[#2a2a2a] bg-[#1a1a1a]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#166534] to-[#22c55e]"
                  style={{ width: `${prof.max > 0 ? (prof.value / prof.max) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DungeonsRaidsTab({
  mythicPlus,
  raidProgress,
}: {
  mythicPlus: ArmoryData["mythicPlus"];
  raidProgress: ArmoryData["raidProgress"];
}) {
  const t = useT();
  const mythicRating = mythicPlus.allTimeHighest * mythicPlus.totalRuns;

  return (
    <div>
      <div className="mb-8">
        <SectionHeading>{t("armory.raidProgression")}</SectionHeading>
        {raidProgress.length === 0 ? (
          <p className="py-6 text-center text-white/30">{t("armory.noRaids")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {raidProgress.map((raid) => (
              <div
                key={raid.raidName}
                className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0d0d1a]"
              >
                <div className="relative h-36 bg-[#1a1a2e]">
                  <img
                    src={raid.image}
                    alt={raid.raidName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d1a] via-transparent to-transparent" />
                </div>
                <div className="px-3 pt-2 pb-3">
                  <h3 className="mb-2.5 text-sm font-bold text-white">{raid.raidName}</h3>
                  <div className="space-y-1.5">
                    <RaidProgressBar killed={raid.normalKills} total={raid.totalBosses} label={t("armory.normal")} />
                    <RaidProgressBar killed={raid.heroicKills} total={raid.totalBosses} label={t("armory.heroic")} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeading>{t("armory.mythicPlusRating")}</SectionHeading>
        <p className="mb-4 text-center text-4xl font-bold text-white/80">{mythicRating}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label={t("armory.allTimeBest")} value={`+${mythicPlus.allTimeHighest}`} />
          <MiniStat label={t("armory.totalRuns")} value={mythicPlus.totalRuns.toString()} />
          <MiniStat label={t("armory.trackedWeeks")} value={mythicPlus.history.length.toString()} />
        </div>
        {mythicPlus.history.length > 0 && (
          <ul className="mt-4 space-y-1">
            {mythicPlus.history.map((w) => (
              <li
                key={w.week}
                className="flex items-center justify-between rounded border border-white/[0.04] bg-[#0d0d1a] px-3 py-1.5 text-xs"
              >
                <span className="text-white/50">{t("armory.weekN", { n: w.week })}</span>
                <span className="font-mono text-[#d4a017]">+{w.highestKey}</span>
                <span className="text-white/50">
                  {t(w.runs === 1 ? "armory.runs.one" : "armory.runs.many", { count: w.runs })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CollectionsTab({ collections }: { collections: ArmoryData["collections"] }) {
  const t = useT();
  const [which, setWhich] = useState<"Mounts" | "Companions">("Mounts");
  const items = which === "Mounts" ? collections.mounts : collections.companions;
  const labelFor = (k: "Mounts" | "Companions") => k === "Mounts" ? t("armory.mounts") : t("armory.companions");
  return (
    <div>
      <div className="mb-6 flex justify-center gap-2">
        {(["Mounts", "Companions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setWhich(tab)}
            className={[
              "rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
              which === tab
                ? "bg-[#d4a017] text-black"
                : "text-[#d4a017]/70 hover:bg-[#d4a017]/10 hover:text-[#d4a017]",
            ].join(" ")}
          >
            {labelFor(tab)} ({tab === "Mounts" ? collections.mounts.length : collections.companions.length})
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-white/30">{t("armory.noCollection", { kind: labelFor(which) })}</p>
      ) : (
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
          {items.map((it) => (
            <a
              key={it.spellId}
              href={`https://www.wowhead.com/cata/spell=${it.spellId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={it.name}
              className="block aspect-square overflow-hidden rounded border border-[#2a2a2a] bg-[#0d0d0d]"
            >
              {it.icon ? (
                <img
                  src={`https://wow.zamimg.com/images/wow/icons/large/${it.icon}.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">
                  {it.name.charAt(0).toUpperCase()}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ReputationTab({ reputations }: { reputations: ArmoryData["reputations"] }) {
  const t = useT();
  if (reputations.length === 0) {
    return <p className="py-12 text-center text-white/30">{t("armory.noReputation")}</p>;
  }
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeading>{t("armory.reputations")}</SectionHeading>
      <div className="space-y-1">
        {reputations.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between border-b border-white/[0.03] py-1.5 last:border-0"
          >
            <span className="text-sm text-white/80">{r.name}</span>
            <span
              className="rounded px-2 py-0.5 text-xs font-bold"
              style={{ color: r.standingColor, backgroundColor: `${r.standingColor}15` }}
            >
              {r.standingName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── sub-components ── */

function EquipSlot({
  slotId,
  item,
  icons,
}: {
  slotId: number;
  item: { itemEntry: number; name: string; quality: number } | undefined;
  icons: Map<number, string>;
}) {
  const slotLabel = SLOT_NAMES[slotId] ?? `Slot ${slotId}`;
  const [hovered, setHovered] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  if (!item) {
    return (
      <div
        className="h-14 w-14 rounded border-2 border-[#2a2a2a] bg-[#0d0d0d]"
        title={`${slotLabel}: Empty`}
      />
    );
  }
  const iconUrl = icons.get(item.itemEntry);
  const border = QUALITY[item.quality] ?? "#9d9d9d";
  // Items with no world-db row (deleted entries still stuck in character_inventory)
  // come back with empty name. Render the slot-type silhouette at low opacity
  // instead of a letter so the slot still reads as armor.
  const unresolved = !item.name || /^Item #\d+$/.test(item.name);
  const slotFallbackIcon = slotIcon(slotLabel);
  return (
    <>
      <a
        ref={linkRef}
        href={`https://www.wowhead.com/cata/item=${item.itemEntry}`}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-14 w-14 overflow-hidden rounded border-2 bg-[#1c1a14] shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_0_14px_rgba(163,53,238,0.3)]"
        style={{ borderColor: border }}
        title={`${slotLabel}: ${item.name || `Item #${item.itemEntry}`}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : unresolved && slotFallbackIcon ? (
          <img
            src={slotFallbackIcon}
            alt=""
            className="h-full w-full object-contain opacity-25"
            draggable={false}
          />
        ) : slotFallbackIcon ? (
          <img
            src={slotFallbackIcon}
            alt=""
            className="h-full w-full object-contain opacity-60"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-500">
            {(item.name || "?").charAt(0).toUpperCase()}
          </div>
        )}
      </a>
      {hovered && <ItemTooltip itemId={item.itemEntry} anchorRef={linkRef} />}
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-[#d4a017]">
      {children}
    </h2>
  );
}

function Bar({
  label,
  value,
  color,
  gradient,
}: {
  label: string;
  value: number;
  color: string;
  gradient: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: `${color}cc` }}
        >
          {label}
        </span>
        <span className="text-[10px] font-bold" style={{ color }}>
          {value.toLocaleString("en-US")}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm border border-[#333] bg-[#1a1a1a]">
        <div className="h-full rounded-sm" style={{ width: "100%", background: gradient }} />
      </div>
    </div>
  );
}

function RaidProgressBar({
  killed,
  total,
  label,
}: {
  killed: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? (killed / total) * 100 : 0;
  const color = killed === total && total > 0 ? "#22c55e" : "#d4a017";
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-16 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "#d4a017" }}
      >
        {label}
      </span>
      <div className="relative h-6 flex-1 overflow-hidden rounded border border-white/[0.06] bg-[#1a1a2e]">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
        <span className="absolute inset-0 flex items-center px-2.5 text-[11px] font-bold text-white">
          {killed}/{total}
        </span>
      </div>
    </div>
  );
}

function CurrencyStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d]/60 p-3">
      <img
        src={icon}
        alt=""
        className="h-9 w-9 flex-shrink-0 rounded ring-1 ring-[#4a3a1a]/50"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-lg font-bold text-white/90">{value}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#2a2a2a] bg-[#0d0d0d]/60 p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xl font-bold text-[#d4a017]">{value}</div>
    </div>
  );
}

function SwordsIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
      <line x1="5" y1="14" x2="9" y2="18" />
      <line x1="7" y1="17" x2="4" y2="20" />
      <line x1="3" y1="19" x2="5" y2="21" />
    </svg>
  );
}
