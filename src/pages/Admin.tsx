import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api/cms";

type Setting = {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json" | "html";
  category: string;
  label: string | null;
  description: string | null;
};

// Settings that exist in starfall_cms.site_settings but aren't actionable
// from the launcher's admin panel (they're website-only flows).
const HIDDEN_KEYS = new Set([
  "account_deletion_enabled",
  "max_accounts_per_email",
  "registration_enabled",
  "site_description",
  "donations_enabled",
  "discord_notifications_changelog",
  "discord_notifications_bugtracker",
]);

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminMe()
      .then((r) => setAllowed(r.isAdmin))
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    api
      .adminSettings()
      .then((r) => setSettings(r.settings))
      .catch((e) => setError(String(e)));
  }, [allowed]);

  const grouped = useMemo(() => {
    const m = new Map<string, Setting[]>();
    for (const s of settings) {
      if (HIDDEN_KEYS.has(s.key)) continue;
      const list = m.get(s.category) ?? [];
      list.push(s);
      m.set(s.category, list);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [settings]);

  if (allowed === null) return <div className="text-neutral-500">Checking…</div>;
  if (!allowed) return <Navigate to="/home" replace />;

  const save = async (key: string) => {
    const draft = edits[key];
    if (draft === undefined) return;
    setBusy(key);
    setError(null);
    try {
      await api.adminSetSetting(key, draft);
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: draft } : s)),
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-neutral-400">
            Global launcher + site settings. Every launcher reads these live.
          </p>
        </div>
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-widest text-violet-200">
          Admin
        </span>
      </header>

      {error && (
        <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {grouped.map(([cat, list]) => (
        <section
          key={cat}
          className="rounded-lg border border-violet-500/20 bg-neutral-900/60 p-4"
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-violet-200">
            {cat}
          </h2>
          <div className="flex flex-col gap-3">
            {list.map((s) => {
              const draft = edits[s.key];
              const current = draft ?? s.value;
              const dirty = draft !== undefined && draft !== s.value;
              const saved = savedKey === s.key;
              return (
                <div
                  key={s.key}
                  className="grid grid-cols-1 gap-2 border-b border-neutral-800 pb-3 last:border-b-0 md:grid-cols-[1fr_2fr_auto] md:gap-3"
                >
                  <div>
                    <div className="text-sm font-medium text-neutral-100">
                      {s.label || s.key}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-500">
                      {s.key}
                    </div>
                    {s.description && (
                      <div className="mt-1 text-xs text-neutral-500">
                        {s.description}
                      </div>
                    )}
                  </div>
                  <div>
                    {s.type === "boolean" ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={current === "1"}
                          onChange={(e) =>
                            setEdits((p) => ({
                              ...p,
                              [s.key]: e.currentTarget.checked ? "1" : "0",
                            }))
                          }
                          className="h-4 w-4 accent-violet-500"
                        />
                        <span>{current === "1" ? "Enabled" : "Disabled"}</span>
                      </label>
                    ) : s.type === "html" ? (
                      <textarea
                        value={current}
                        onChange={(e) =>
                          setEdits((p) => ({ ...p, [s.key]: e.currentTarget.value }))
                        }
                        rows={4}
                        className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 font-mono text-xs"
                      />
                    ) : (
                      <input
                        type="text"
                        inputMode={s.type === "number" ? "numeric" : undefined}
                        value={current}
                        onChange={(e) =>
                          setEdits((p) => ({ ...p, [s.key]: e.currentTarget.value }))
                        }
                        className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 font-mono text-sm"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save(s.key)}
                      disabled={!dirty || busy === s.key}
                      className="rounded bg-violet-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-violet-400 disabled:opacity-50"
                    >
                      {busy === s.key ? "…" : saved ? "Saved ✓" : "Save"}
                    </button>
                    {dirty && (
                      <button
                        onClick={() =>
                          setEdits((p) => {
                            const n = { ...p };
                            delete n[s.key];
                            return n;
                          })
                        }
                        className="text-xs text-neutral-500 hover:text-neutral-300"
                      >
                        Revert
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
