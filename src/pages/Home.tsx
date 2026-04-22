import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EXPANSIONS } from "../data/expansions";
import {
  cacheClear,
  launchGame,
  realmlistRead,
  realmlistWrite,
} from "../api/game";
import { patcherCheck, patcherRun } from "../api/patcher";
import { useLauncherStore, shouldClearCache } from "../state/launcher";
import { useInstallerStore } from "../state/installer";

type PlayStep =
  | "idle"
  | "checking-patches"
  | "patching"
  | "syncing-realmlist"
  | "clearing-cache"
  | "launching"
  | "running"
  | "error";

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
    markCacheClear,
  } = useLauncherStore();
  const manifestUrl = useInstallerStore((s) => s.manifestUrl);

  const [step, setStep] = useState<PlayStep>("idle");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const running = step !== "idle" && step !== "error";

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

  const activeExpansion = EXPANSIONS.find((e) => e.id === selectedExpansion);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="text-sm text-neutral-400">
          {installDir ? (
            <>
              Install:{" "}
              <span className="font-mono text-neutral-300">{installDir}</span>
            </>
          ) : (
            <>
              No install folder yet.{" "}
              <button
                onClick={() => navigate("/install")}
                className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                Go to Install
              </button>
            </>
          )}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Expansion
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {EXPANSIONS.map((exp) => {
            const isSelected = exp.id === selectedExpansion;
            return (
              <button
                key={exp.id}
                disabled={!exp.enabled}
                onClick={() => setSelectedExpansion(exp.id)}
                className={[
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  exp.enabled
                    ? isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700"
                    : "cursor-not-allowed border-neutral-900 bg-neutral-950 opacity-50",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">{exp.name}</div>
                <div className="text-xs text-neutral-500">v{exp.version}</div>
                <div className="text-xs text-neutral-400">{exp.tagline}</div>
                {!exp.enabled && (
                  <span className="mt-1 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">
              Playing
            </div>
            <div className="text-xl font-semibold">{activeExpansion?.name}</div>
          </div>
          <div className="text-sm text-neutral-400">
            Realm:{" "}
            <span className="font-mono text-neutral-200">
              {realmlistServer || "—"}
            </span>
          </div>
        </div>

        <button
          onClick={handlePlay}
          disabled={running || !activeExpansion?.enabled}
          className="w-full rounded-lg bg-amber-500 px-6 py-4 text-lg font-semibold text-neutral-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
