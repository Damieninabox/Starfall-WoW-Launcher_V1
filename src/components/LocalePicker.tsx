import { useState } from "react";
import { useI18nStore, type Locale } from "../i18n/store";

// First-run language picker is fully hardcoded in English. The user hasn't
// chosen a locale yet, so we don't go through the t() hook here — that would
// be confusing if a navigator-language guess decided to greet a German user
// in German before they had any say in it. Each option's tile shows the
// language in its own native form ("English" / "Deutsch") so the affordance
// is obvious regardless of what language the player actually reads.
const OPTIONS: Array<{ id: Locale; name: string; flag: string; nativeName: string }> = [
  { id: "en", name: "English", flag: "🇬🇧", nativeName: "English" },
  { id: "de", name: "German",  flag: "🇩🇪", nativeName: "Deutsch" },
];

export default function LocalePicker() {
  const setLocale = useI18nStore((s) => s.setLocale);
  const [pending, setPending] = useState<Locale>("en");

  const confirm = () => setLocale(pending);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-2xl border border-violet-500/30 bg-neutral-950/95 p-8 shadow-2xl">
        <h1 className="mb-1 text-center text-2xl font-semibold text-white">
          Choose your language
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-400">
          You can change this later in Settings.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {OPTIONS.map((opt) => {
            const selected = pending === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPending(opt.id)}
                className={[
                  "flex flex-col items-center gap-3 rounded-xl border-2 px-6 py-8 transition-all",
                  selected
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                    : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-600",
                ].join(" ")}
              >
                <div className="text-base font-semibold text-white">
                  {opt.nativeName}
                </div>
                <div className="text-4xl leading-none" aria-hidden="true">
                  {opt.flag}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-neutral-500">
                  {opt.name}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            onClick={confirm}
            className="rounded-md bg-violet-500 px-8 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-violet-400"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
