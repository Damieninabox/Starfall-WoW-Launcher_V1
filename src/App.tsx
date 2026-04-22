import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Install from "./pages/Install";
import Characters from "./pages/Characters";
import MythicPlus from "./pages/MythicPlus";
import Shop from "./pages/Shop";
import Settings from "./pages/Settings";
import Referral from "./pages/Referral";
import Transmog from "./pages/Transmog";
import BugReport from "./pages/BugReport";
import Addons from "./pages/Addons";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./state/auth";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/characters", label: "Characters" },
  { to: "/mythicplus", label: "Mythic+" },
  { to: "/transmog", label: "Transmog" },
  { to: "/shop", label: "Shop" },
  { to: "/addons", label: "Addons" },
  { to: "/install", label: "Install" },
  { to: "/settings", label: "Settings" },
];

const secondary = [
  { to: "/referral", label: "Refer" },
  { to: "/bug-report", label: "Bug" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const displayName = useAuthStore((s) => s.displayName);
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
        <div className="text-lg font-semibold tracking-wide text-amber-400">
          Starfall
        </div>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "rounded px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
          <div className="flex gap-2">
            {secondary.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded px-2 py-1",
                    isActive
                      ? "bg-neutral-800 text-amber-300"
                      : "hover:bg-neutral-800 hover:text-neutral-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          {displayName && (
            <div className="rounded-full border border-neutral-800 px-3 py-1 font-mono text-neutral-300">
              {displayName}
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
                <Route path="/mythicplus" element={<MythicPlus />} />
                <Route path="/transmog" element={<Transmog />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/addons" element={<Addons />} />
                <Route path="/install" element={<Install />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/referral" element={<Referral />} />
                <Route path="/bug-report" element={<BugReport />} />
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
  return <AppRoutes />;
}
