import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, login2fa } from "../api/auth";
import { api } from "../api/cms";
import { useAuthStore } from "../state/auth";

export default function Login() {
  const navigate = useNavigate();
  const { pendingToken, username: pendingUsername, setPending, setAuthed } = useAuthStore();

  const [username, setUsername] = useState(pendingUsername ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(username.trim(), password);
      if (result.kind === "needs2fa") {
        setPending(result.pendingToken, username.trim());
      } else {
        await finishAuth(result.username);
      }
    } catch (err) {
      setError(String(err));
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
      const result = await login2fa(pendingToken, code.trim(), pendingUsername ?? username.trim());
      if (result.kind === "ok") {
        await finishAuth(result.username);
      } else {
        setError("Unexpected 2FA response.");
      }
    } catch (err) {
      setError(String(err));
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
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-4xl font-bold tracking-tight text-violet-300">Starfall</div>
        <div className="text-sm text-neutral-400">Sign in to continue</div>
      </div>

      {!showing2fa && (
        <form onSubmit={submitLogin} className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="text-center text-xs text-neutral-500">
            Mock account: <span className="font-mono">starfall / starfall</span>
          </div>
        </form>
      )}

      {showing2fa && (
        <form onSubmit={submit2fa} className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6">
          <div className="text-sm text-neutral-300">
            Two-factor required for <span className="font-mono">{pendingUsername}</span>.
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-400">6-digit code</span>
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
            {busy ? "Verifying…" : "Verify"}
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
          {error}
        </div>
      )}
    </div>
  );
}

