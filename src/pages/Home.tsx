import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  cacheClear,
  launchGame,
  realmlistRead,
  realmlistWrite,
} from "../api/game";
import { patcherCheck, patcherRun } from "../api/patcher";
import { api, type ExpansionApi } from "../api/cms";
import { useLauncherStore, shouldClearCache } from "../state/launcher";
import { useInstallerStore } from "../state/installer";
import { useAuthStore } from "../state/auth";
import {
  AffixesCard,
  GuildCard,
  NewsCard,
  ServerStatusCard,
  WorldEventsCard,
} from "../components/HomeWidgets";

type PlayStep =
  | "idle"
  | "checking-patches"
  | "patching"
  | "syncing-realmlist"
  | "clearing-cache"
  | "launching"
  | "running"
  | "error";

const EXPANSION_BG: Record<string, string> = {
  cataclysm: "from-orange-900/30 via-red-900/10 to-transparent",
  cata: "from-orange-900/30 via-red-900/10 to-transparent",
  wotlk: "from-sky-900/30 via-indigo-900/10 to-transparent",
  "wrath-of-the-lich-king": "from-sky-900/30 via-indigo-900/10 to-transparent",
  tbc: "from-fuchsia-900/30 via-violet-900/10 to-transparent",
  classic: "from-amber-900/30 via-stone-900/10 to-transparent",
  "mists-of-pandaria": "from-emerald-900/30 via-teal-900/10 to-transparent",
  mop: "from-emerald-900/30 via-teal-900/10 to-transparent",
};

export default function Home() {
  const navigate = useNavigate();
  const {
    installDir,
    realmlistServer,
    cachePolicy,
    launchArgs,
    selectedExpansion,
    lastCacheClearMs,
    setSelectedExpansion,
    setRealmlistServer,
    markCacheClear,
  } = useLauncherStore();
  const manifestUrl = useInstallerStore((s) => s.manifestUrl);
  const setManifestUrl = useInstallerStore((s) => s.setManifestUrl);
  const displayName = useAuthStore((s) => s.displayName);

  const [expansions, setExpansions] = useState<ExpansionApi[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [step, setStep] = useState<PlayStep>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const running = step !== "idle" && step !== "error";

  useEffect(() => {
    api
      .expansions()
      .then((r) => {
        const enabled = r.expansions.filter((e) => e.enabled);
        setExpansions(enabled);
        // pick the default if current selection isn't available
        if (enabled.length > 0 && !enabled.some((e) => e.id === selectedExpansion)) {
          setSelectedExpansion(enabled[0].id);
        }
        // auto-sync realmlist + manifest URL from the selected expansion
        const active = enabled.find((e) => e.id === selectedExpansion) ?? enabled[0];
        if (active) {
          if (active.realmlist && active.realmlist !== realmlistServer) {
            setRealmlistServer(active.realmlist);
          }
          if (active.manifestUrl && active.manifestUrl !== manifestUrl) {
            setManifestUrl(active.manifestUrl);
          }
        }
      })
      .catch(() => setExpansions([]))
      .finally(() => setLoadingExp(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = async () => {
    setError(null);
    if (!installDir) {
      setError("No install folder set. Open Install to pick one.");
      return;
    }

    try {
      setStep("checking-patches");
      setMessage("Checking for updates…");
      const summary = await patcherCheck(installDir, manifestUrl);
      if (summary.filesToDownload > 0 || summary.filesToReplace > 0) {
        setStep("patching");
        setMessage(
          `Updating ${summary.filesToDownload + summary.filesToReplace} file(s)…`,
        );
        await patcherRun(installDir, manifestUrl);
      }

      setStep("syncing-realmlist");
      setMessage("Syncing realmlist…");
      const current = await realmlistRead(installDir);
      if (current.server !== realmlistServer) {
        await realmlistWrite(installDir, realmlistServer);
      }

      if (shouldClearCache(cachePolicy, lastCacheClearMs)) {
        setStep("clearing-cache");
        setMessage("Clearing cache…");
        await cacheClear(installDir);
        markCacheClear();
      }

      setStep("launching");
      setMessage("Launching Wow.exe…");
      await launchGame(installDir, launchArgs);

      setStep("running");
      setMessage("Wow is running — good hunting.");
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  };

  const activeExpansion = expansions.find((e) => e.id === selectedExpansion) ?? expansions[0];
  const bgClass =
    EXPANSION_BG[selectedExpansion] ??
    (activeExpansion ? EXPANSION_BG[activeExpansion.id] : undefined) ??
    "from-violet-900/30 via-indigo-900/10 to-transparent";

  return (
    <div className="flex flex-col gap-8">
      <div
        className={`rounded-2xl bg-gradient-to-br ${bgClass} p-6 ring-1 ring-violet-500/20`}
      >
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, <span className="text-violet-200">{displayName ?? "stranger"}</span>.
          </h1>
          <p className="text-sm text-neutral-400">
            {installDir ? (
              <>
                Install: <span className="font-mono text-neutral-300">{installDir}</span>
              </>
            ) : (
              <>
                No install folder yet.{" "}
                <button
                  onClick={() => navigate("/install")}
                  className="text-violet-300 underline underline-offset-2 hover:text-violet-200"
                >
                  Go to Install
                </button>
              </>
            )}
          </p>
        </header>

        {!loadingExp && expansions.length === 0 && (
          <div className="mt-4 rounded border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-200">
            No realms configured yet. Ask an admin to add one in the CMS.
          </div>
        )}

        {expansions.length > 1 && (
          <section className="mt-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Realm
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {expansions.map((exp) => {
                const isSelected = exp.id === selectedExpansion;
                return (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExpansion(exp.id)}
                    className={[
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold">{exp.realmName ?? exp.name}</div>
                    <div className="text-xs text-neutral-500">{exp.version}</div>
                    {exp.tagline && (
                      <div className="text-xs text-neutral-400">{exp.tagline}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {activeExpansion && (
          <section className="mt-5 flex flex-col gap-4 rounded-xl border border-violet-500/20 bg-neutral-900/60 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-neutral-500">
                  Playing
                </div>
                <div className="text-xl font-semibold">
                  {activeExpansion.realmName ?? activeExpansion.name}
                </div>
                {activeExpansion.tagline && (
                  <div className="text-xs text-neutral-400">
                    {activeExpansion.tagline}
                  </div>
                )}
              </div>
              <div className="text-sm text-neutral-400">
                Realm:{" "}
                <span className="font-mono text-neutral-200">
                  {activeExpansion.realmlist ?? realmlistServer ?? "—"}
                </span>
              </div>
            </div>

            <button
              onClick={handlePlay}
              disabled={running}
              className="self-start rounded-md bg-violet-500 px-10 py-2.5 text-base font-semibold text-neutral-950 transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? message : "Play"}
            </button>

            {step !== "idle" && step !== "error" && (
              <div className="rounded border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">
                <div className="mb-1 text-xs uppercase tracking-widest text-neutral-500">
                  Status
                </div>
                {message}
              </div>
            )}

            {error && (
              <div className="rounded border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
                <div className="font-semibold text-red-300">Couldn't launch</div>
                <div className="mt-1 font-mono text-xs">{error}</div>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ServerStatusCard />
        <AffixesCard />
        <div className="md:col-span-2">
          <NewsCard />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WorldEventsCard />
        <GuildCard guid="ebon-dawn" />
      </div>
    </div>
  );
}
