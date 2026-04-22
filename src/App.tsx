import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Install from "./pages/Install";
import Characters from "./pages/Characters";
import MythicPlus from "./pages/MythicPlus";
import Shop from "./pages/Shop";
import Settings from "./pages/Settings";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/install", label: "Install" },
  { to: "/characters", label: "Characters" },
  { to: "/mythicplus", label: "Mythic+" },
  { to: "/shop", label: "Shop" },
  { to: "/settings", label: "Settings" },
  { to: "/login", label: "Login" },
];

function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-6 py-3">
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
      </header>
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/install" element={<Install />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/mythicplus" element={<MythicPlus />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
