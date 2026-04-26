import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasToken, logout } from "../api/auth";
import { api } from "../api/cms";
import { useAuthStore } from "../state/auth";
import { useT } from "../i18n/useT";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const t = useT();
  const location = useLocation();
  const username = useAuthStore((s) => s.username);
  const setAuthed = useAuthStore((s) => s.setAuthed);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const clear = useAuthStore((s) => s.clear);

  const [checked, setChecked] = useState(false);
  const [tokenOk, setTokenOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ok = await hasToken();
        if (!ok) {
          clear();
          setTokenOk(false);
          setChecked(true);
          return;
        }
        if (!username) {
          // we have a keyring token but no in-memory user — bootstrap from /me
          try {
            const me = await api.me();
            setAuthed({ username: me.username, displayName: me.displayName, has2fa: me.has2fa });
          } catch {
            // token is stale or CMS unreachable — force a fresh login
            try { await logout(); } catch { /* ignore */ }
            clear();
            setTokenOk(false);
            setChecked(true);
            return;
          }
        }
        // refresh admin flag on every protected render (cheap, single row)
        try {
          const a = await api.adminMe();
          setAdmin(a.isAdmin);
        } catch {
          setAdmin(false);
        }
        setTokenOk(true);
        setChecked(true);
      } catch {
        clear();
        setTokenOk(false);
        setChecked(true);
      }
    })();
  }, [clear, setAuthed, setAdmin, username]);

  if (!checked) {
    return <div className="p-6 text-sm text-neutral-500">{t("session.checking")}</div>;
  }
  if (!tokenOk || !username) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
