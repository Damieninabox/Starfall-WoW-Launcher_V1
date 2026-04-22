import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasToken } from "../api/auth";
import { useAuthStore } from "../state/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const username = useAuthStore((s) => s.username);
  const clear = useAuthStore((s) => s.clear);
  const [checked, setChecked] = useState(false);
  const [tokenOk, setTokenOk] = useState(false);

  useEffect(() => {
    hasToken()
      .then((ok) => {
        if (!ok) clear();
        setTokenOk(ok);
        setChecked(true);
      })
      .catch(() => {
        clear();
        setTokenOk(false);
        setChecked(true);
      });
  }, [clear]);

  if (!checked) {
    return <div className="p-6 text-sm text-neutral-500">Checking session…</div>;
  }
  if (!tokenOk || !username) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

