import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, login2fa } from "../api/auth";
import { api } from "../api/cms";
import { useAuthStore } from "../state/auth";
import { useT } from "../i18n/useT";

export default function Login() {
  const navigate = useNavigate();
  const t = useT();
  const { pendingToken, username: pendingUsername, setPending, setAuthed } = useAuthStore();

  const [username, setUsername] = useState(pendingUsername ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(username.trim(), password, remember);
      if (result.kind === "needs2fa") {
        setPending(result.pendingToken, username.trim());
      } else {
        await finishAuth(result.username);
      }
    } catch (err) {
      setError(prettyError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit2fa = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await login2fa(
        pendingToken,
        code.trim(),
        pendingUsername ?? username.trim(),
        remember,
      );
      if (result.kind === "ok") {
        await finishAuth(result.username);
      } else {
        setError("Unexpected 2FA response.");
      }
    } catch (err) {
      setError(prettyError(err));
    } finally {
      setBusy(false);
    }
  };

  const finishAuth = async (name: string) => {
    try {
      const me = await api.me();
      setAuthed({ username: me.username, displayName: me.displayName, has2fa: me.has2fa });
    } catch {
      setAuthed({ username: name });
    }
    navigate("/home", { replace: true });
  };

  const cancelPending = () => {
    setPending(null, "");
    setCode("");
  };

  const showing2fa = !!pendingToken;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src="/logo.png"
          alt="Starfall"
          className="h-40 w-40 object-contain drop-shadow-[0_0_35px_rgba(124,58,237,0.55)]"
        />
        <div className="text-sm text-neutral-400">Sign in to continue</div>
      </div>

      {!showing2fa && (
        <form onSubmit={submitLogin} className="flex flex-col gap-3 rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">{t("login.username")}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">{t("login.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              required
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.currentTarget.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            {t("login.remember")}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {busy ? t("login.signing") : t("login.submit")}
          </button>
        </form>
      )}

      {showing2fa && (
        <form onSubmit={submit2fa} className="flex flex-col gap-3 rounded-lg border border-violet-500/20 bg-neutral-900/60 p-6">
          <div className="text-sm text-neutral-300">
            Two-factor required for <span className="font-mono">{pendingUsername}</span>.
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">{t("login.code2fa")}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-neutral-200"
              autoFocus
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {busy ? t("login.checking2fa") : t("login.verify2fa")}
          </button>
          <button
            type="button"
            onClick={cancelPending}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Start over
          </button>
        </form>
      )}

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          <div className="font-semibold text-red-300">Login failed</div>
          <div className="mt-1 font-mono text-xs">{error}</div>
          {error.toLowerCase().includes("reach") && (
            <div className="mt-2 text-xs text-neutral-400">
              The CMS at <span className="font-mono">127.0.0.1:8787</span> isn't
              responding. Start <span className="font-mono">node server.js</span> in{" "}
              <span className="font-mono">mock-server/</span>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function prettyError(err: unknown): string {
  const msg = String(err);
  return msg.replace(/^Error:\s*/, "");
}
