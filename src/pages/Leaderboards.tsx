import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useT } from "../i18n/useT";

const TABS: ReadonlyArray<{ to: string; key: "leaderboards.tabMplus" | "leaderboards.tabPvp" | "leaderboards.tabRaids" }> = [
  { to: "/leaderboards/mythicplus", key: "leaderboards.tabMplus" },
  { to: "/leaderboards/pvp", key: "leaderboards.tabPvp" },
  { to: "/leaderboards/raids", key: "leaderboards.tabRaids" },
];

export default function Leaderboards() {
  const t = useT();
  const loc = useLocation();
  const isRoot = loc.pathname === "/leaderboards";
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{t("leaderboards.title")}</h1>
        <p className="text-sm text-neutral-400">{t("leaderboards.subtitle")}</p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-violet-500/20 pb-0">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                "rounded-t-md px-4 py-2 text-sm font-medium",
                isActive
                  ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/40"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
              ].join(" ")
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </nav>

      {isRoot ? (
        <div className="grid gap-4 md:grid-cols-3">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="group rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6 transition-colors hover:border-violet-400/50"
            >
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                {t("leaderboards.cardLabel")}
              </div>
              <div className="mt-1 text-xl font-semibold text-violet-200 group-hover:text-violet-100">
                {t(tab.key)} →
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
