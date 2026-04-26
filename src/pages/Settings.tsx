import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useLauncherStore, type CachePolicy } from "../state/launcher";
import { useAuthStore } from "../state/auth";
import { realmlistRead, cacheClear } from "../api/game";
import { api, type SessionEntry, type Enroll2faResponse } from "../api/cms";
import { logout } from "../api/auth";
import { useI18nStore, type Locale } from "../i18n/store";
import { useT } from "../i18n/useT";

const CACHE_POLICIES: { value: CachePolicy; label: string; description: string }[] = [
  { value: "on-launch", label: "On every launch", description: "Clears Cache/ and WDB/ each time you press Play." },
  { value: "weekly", label: "Weekly", description: "Clears when it's been at least 7 days since the last wipe." },
  { value: "manual-only", label: "Manual only", description: "Never clears automatically. Use the button below." },
  { value: "off", label: "Off", description: "Never touches Cache/WDB." },
];

export default function Settings() {
  const navigate = useNavigate();
  const tFn = useT();
  const {
    installDir,
    realmlistServer,
    cachePolicy,
    launchArgs,
    setInstallDir,
    setRealmlistServer,
    setCachePolicy,
    setLaunchArgs,
  } = useLauncherStore();
  const auth = useAuthStore();

  const [argsRaw, setArgsRaw] = useState(launchArgs.join(" "));
  const [realmlistDisk, setRealmlistDisk] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [enroll, setEnroll] = useState<Enroll2faResponse | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");

  useEffect(() => setArgsRaw(launchArgs.join(" ")), [launchArgs]);

  useEffect(() => {
    if (!installDir) return;
    realmlistRead(installDir)
      .then((s) => setRealmlistDisk(s.server))
      .catch(() => setRealmlistDisk(null));
  }, [installDir]);

  useEffect(() => {
    api.sessions().then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, []);

  const pickFolder = async () => {
    try {
      const picked = await open({ directory: true, multiple: false, title: "Select install folder" });
      if (typeof picked === "string" && picked.length > 0) setInstallDir(picked);
    } catch (e) {
      setError(String(e));
    }
  };

  const applyArgs = () => {
    const parsed = argsRaw.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    setLaunchArgs(parsed);
  };

  const wipeCache = async () => {
    setStatus(null);
    setError(null);
    if (!installDir) return setError("Pick an install folder first.");
    try {
      const r = await cacheClear(installDir);
      setStatus(`Cleared ${r.filesRemoved} file(s), ${r.dirsCleared.join(" + ") || "nothing"} (${formatBytes(r.bytesFreed)}).`);
    } catch (e) {
      setError(String(e));
    }
  };

  const doLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    auth.clear();
    navigate("/login", { replace: true });
  };

  const doBackup = async () => {
    setStatus(null);
    setError(null);
    if (!installDir) return setError("Pick an install folder first.");
    try {
      const picked = await save({
        title: "Save WTF backup",
        defaultPath: `starfall-wtf-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: "Zip", extensions: ["zip"] }],
      });
      if (!picked) return;
      const r = await invoke<{ zipPath: string; filesZipped: number; bytesZipped: number }>(
        "backup_wtf",
        { installDir, outPath: picked },
      );
      setStatus(`Backup: ${r.filesZipped} files, ${formatBytes(r.bytesZipped)} â†’ ${r.zipPath}`);
    } catch (e) {
      setError(String(e));
    }
  };

  const doRestore = async () => {
    setStatus(null);
    setError(null);
    if (!installDir) return setError("Pick an install folder first.");
    try {
      const picked = await open({
        title: "Restore WTF backup",
        multiple: false,
        filters: [{ name: "Zip", extensions: ["zip"] }],
      });
      if (typeof picked !== "string") return;
      const count = await invoke<number>("restore_wtf", {
        installDir,
        zipPath: picked,
      });
      setStatus(`Restored ${count} file(s) from backup.`);
    } catch (e) {
      setError(String(e));
    }
  };

  const startEnroll = async () => {
    setError(null);
    try {
      const r = await api.enroll2fa();
      setEnroll(r);
    } catch (e) {
      setError(String(e));
    }
  };

  const verifyEnroll = async () => {
    setError(null);
    try {
      await api.verify2fa(twoFaCode);
      auth.update2fa(true);
      setEnroll(null);
      setTwoFaCode("");
      setStatus("2FA enabled.");
    } catch (e) {
      setError(String(e));
    }
  };

  const disable2fa = async () => {
    setError(null);
    try {
      await api.disable2fa();
      auth.update2fa(false);
      setStatus("2FA disabled.");
    } catch (e) {
      setError(String(e));
    }
  };

  const revokeAll = async () => {
    setError(null);
    try {
      await api.revokeAll();
      auth.clear();
      navigate("/login", { replace: true });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">Account</div>
            <div className="text-lg font-semibold">{auth.displayName ?? auth.username ?? "—"}</div>
          </div>
          <button
            onClick={doLogout}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            {tFn("nav.signOut")}
          </button>
        </div>
      </section>

      <LocaleSection />


      <Section title="Install folder">
        <div className="flex gap-2">
          <input
            readOnly
            value={installDir}
            placeholder="No folder selected"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
          />
          <button onClick={pickFolder} className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
            Pick folder
          </button>
        </div>
      </Section>

      <Section title="Realmlist server">
        <input
          value={realmlistServer}
          onChange={(e) => setRealmlistServer(e.currentTarget.value)}
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm"
        />
        <div className="text-xs text-neutral-500">
          Currently on disk: <span className="font-mono text-neutral-300">{realmlistDisk ?? "—"}</span>
          {realmlistDisk && realmlistDisk !== realmlistServer && (
            <span className="ml-2 rounded bg-violet-500/20 px-2 py-0.5 text-violet-200">Will be rewritten on next Play</span>
          )}
        </div>
      </Section>

      <Section title="Cache clear policy">
        <div className="grid gap-2 sm:grid-cols-2">
          {CACHE_POLICIES.map((opt) => (
            <label
              key={opt.value}
              className={[
                "flex cursor-pointer flex-col gap-0.5 rounded border p-3",
                cachePolicy === opt.value ? "border-violet-500 bg-violet-500/10" : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={cachePolicy === opt.value}
                  onChange={() => setCachePolicy(opt.value)}
                  className="accent-violet-500"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </div>
              <span className="pl-6 text-xs text-neutral-400">{opt.description}</span>
            </label>
          ))}
        </div>
        <button onClick={wipeCache} className="self-start rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
          Clear cache now
        </button>
      </Section>

      <Section title="Launch options">
        <input
          value={argsRaw}
          onChange={(e) => setArgsRaw(e.currentTarget.value)}
          onBlur={applyArgs}
          placeholder="-windowed -console"
          className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm"
        />
        <div className="text-xs text-neutral-500">
          Space-separated. Passed to Wow.exe directly — no shell interpolation.
        </div>
      </Section>

      <Section title="Two-factor authentication">
        {auth.has2fa ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-emerald-300">Enabled.</div>
            <button onClick={disable2fa} className="rounded border border-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40">
              Disable
            </button>
          </div>
        ) : enroll ? (
          <div className="flex flex-col gap-2 text-sm">
            <div>Scan this URL in your authenticator, then enter the 6-digit code:</div>
            <code className="break-all rounded bg-neutral-950 p-2 text-xs text-neutral-300">{enroll.otpauthUrl}</code>
            <div className="text-xs text-neutral-400">
              Secret: <span className="font-mono">{enroll.secret}</span>
            </div>
            <div className="text-xs text-neutral-400">
              Backup codes (save these): <span className="font-mono">{enroll.backupCodes.join(", ")}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.currentTarget.value)}
                placeholder="123456"
                className="w-32 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-center font-mono tracking-widest"
              />
              <button onClick={verifyEnroll} className="rounded bg-violet-500 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400">
                Verify
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startEnroll} className="self-start rounded bg-violet-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-violet-400">
            Enable 2FA
          </button>
        )}
      </Section>

      <Section title="Session history">
        {sessions.length === 0 ? (
          <div className="text-sm text-neutral-500">No recent sessions.</div>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
                <div>
                  <div className="font-mono text-neutral-200">{s.ip}</div>
                  <div className="text-neutral-500">{s.ua}</div>
                </div>
                <div className="text-right text-neutral-400">{new Date(s.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
        <button onClick={revokeAll} className="self-start rounded border border-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40">
          Revoke all sessions
        </button>
      </Section>

      <Section title="Settings backup / restore (WTF)">
        <div className="flex flex-wrap gap-2">
          <button onClick={doBackup} className="rounded bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
            Backup now
          </button>
          <button onClick={doRestore} className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
            Restore from zip
          </button>
        </div>
      </Section>

      {status && <div className="text-xs text-emerald-300">{status}</div>}
      {error && <div className="text-xs text-red-300">{error}</div>}
    </div>
  );
}

function LocaleSection() {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const options: Array<{ id: Locale; flag: string; subtitle: string; nameKey: "locale.englishName" | "locale.germanName" }> = [
    { id: "en", flag: "🇬🇧", subtitle: "English", nameKey: "locale.englishName" },
    { id: "de", flag: "🇩🇪", subtitle: "Deutsch", nameKey: "locale.germanName" },
  ];
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-neutral-500">
          {t("settings.locale.heading")}
        </div>
        <p className="mt-1 text-xs text-neutral-400">{t("settings.locale.description")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = locale === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setLocale(opt.id)}
              className={[
                "flex items-center gap-3 rounded-md border px-4 py-2 text-sm transition-colors",
                selected
                  ? "border-violet-500 bg-violet-500/10 text-white"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:bg-white/5",
              ].join(" ")}
            >
              <span className="text-2xl leading-none" aria-hidden="true">{opt.flag}</span>
              <span className="flex flex-col items-start">
                <span className="font-semibold">{t(opt.nameKey)}</span>
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                  {opt.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="text-sm text-neutral-400">{title}</h2>
      {children}
    </section>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

