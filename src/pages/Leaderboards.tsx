import { NavLink, Outlet, useLocation } from "react-router-dom";

const TABS = [
  { to: "/leaderboards/mythicplus", label: "Mythic+" },
  { to: "/leaderboards/pvp", label: "PvP" },
  { to: "/leaderboards/raids", label: "Raid progression" },
];

export default function Leaderboards() {
  const loc = useLocation();
  const isRoot = loc.pathname === "/leaderboards";
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Leaderboards</h1>
        <p className="text-sm text-neutral-400">
          Competitive rankings across every endgame mode on Starfall.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-violet-500/20 pb-0">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              [
                "rounded-t-md px-4 py-2 text-sm font-medium",
                isActive
                  ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/40"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
              ].join(" ")
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {isRoot ? (
        <div className="grid gap-4 md:grid-cols-3">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className="group rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6 transition-colors hover:border-violet-400/50"
            >
              <div className="text-xs uppercase tracking-widest text-neutral-500">
                Leaderboard
              </div>
              <div className="mt-1 text-xl font-semibold text-violet-200 group-hover:text-violet-100">
                {t.label} →
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
