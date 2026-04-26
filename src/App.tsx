import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { logout } from "./api/auth";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Install from "./pages/Install";
import Characters from "./pages/Characters";
import Armory from "./pages/Armory";
import MythicPlus from "./pages/MythicPlus";
import Leaderboards from "./pages/Leaderboards";
import LeaderboardPvP from "./pages/LeaderboardPvP";
import LeaderboardRaids from "./pages/LeaderboardRaids";
import Shop from "./pages/Shop";
import Settings from "./pages/Settings";
import Vote from "./pages/Vote";
import Changelog from "./pages/Changelog";
import Calendar from "./pages/Calendar";
import Transmog from "./pages/Transmog";
import Addons from "./pages/Addons";
import Admin from "./pages/Admin";
import ProtectedRoute from "./components/ProtectedRoute";
import Starfield from "./components/Starfield";
import LocalePicker from "./components/LocalePicker";
import { useAuthStore } from "./state/auth";
import { useI18nStore } from "./i18n/store";
import { useT } from "./i18n/useT";

type NavSpec = { to: string; key: Parameters<ReturnType<typeof useT>>[0] };

const navItems: NavSpec[] = [
  { to: "/home", key: "nav.home" },
  { to: "/characters", key: "nav.characters" },
  { to: "/leaderboards", key: "nav.leaderboards" },
  { to: "/calendar", key: "nav.calendar" },
  { to: "/transmog", key: "nav.transmog" },
  { to: "/shop", key: "nav.shop" },
  { to: "/addons", key: "nav.addons" },
  { to: "/install", key: "nav.install" },
  { to: "/settings", key: "nav.settings" },
];

const secondary: NavSpec[] = [
  { to: "/vote", key: "nav.vote" },
  { to: "/changelog", key: "nav.changelog" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const displayName = useAuthStore((s) => s.displayName);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const clearAuth = useAuthStore((s) => s.clear);
  const t = useT();
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // backend already cleared state / network down — safe to fall through
    }
    clearAuth();
    navigate("/login", { replace: true });
  };
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-violet-500/20 bg-[#0c0f1f]/75 px-6 py-3 backdrop-blur">
        <img
          src="/logo.png"
          alt="Starfall"
          className="h-12 w-12 object-contain drop-shadow-[0_0_14px_rgba(124,58,237,0.5)]"
        />
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
                ].join(" ")
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                [
                  "rounded px-2 py-1",
                  isActive
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200",
                ].join(" ")
              }
            >
              {t("nav.admin")}
            </NavLink>
          )}
          <div className="flex gap-2">
            {secondary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded px-2 py-1",
                    isActive
                      ? "bg-white/10 text-cyan-200"
                      : "hover:bg-white/5 hover:text-neutral-100",
                  ].join(" ")
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </div>
          {displayName && (
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 font-mono text-violet-100">
                {displayName}
              </div>
              <button
                onClick={handleLogout}
                title={t("nav.signOut")}
                aria-label={t("nav.signOut")}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Shell>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/characters" element={<Characters />} />
                <Route path="/armory/:name" element={<Armory />} />
                <Route path="/leaderboards" element={<Leaderboards />}>
                  <Route path="mythicplus" element={<MythicPlus />} />
                  <Route path="pvp" element={<LeaderboardPvP />} />
                  <Route path="raids" element={<LeaderboardRaids />} />
                </Route>
                <Route path="/mythicplus" element={<Navigate to="/leaderboards/mythicplus" replace />} />
                <Route path="/transmog" element={<Transmog />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/addons" element={<Addons />} />
                <Route path="/install" element={<Install />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/vote" element={<Vote />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  // First-run language picker is layered above EVERYTHING — login screen
  // included — so the user can pick their language before anything else
  // appears, and only then does the locale store influence rendering.
  const hasChosenLocale = useI18nStore((s) => s.hasChosen);
  return (
    <>
      <Starfield />
      <AppRoutes />
      {!hasChosenLocale && <LocalePicker />}
    </>
  );
}

