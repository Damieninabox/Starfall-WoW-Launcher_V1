import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Locale = "en" | "de";

interface I18nState {
  locale: Locale;
  hasChosen: boolean;          // false until the player picks once on first run
  setLocale: (l: Locale) => void;
  resetChoice: () => void;     // dev/debug only
}

// Always start in English — the first-run picker is the canonical choice
// point. Auto-detecting from navigator.language was confusing because a
// German user would see partial German UI peeking through behind the picker
// before they'd actually picked anything.
export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: "en",
      hasChosen: false,
      setLocale: (locale) => set({ locale, hasChosen: true }),
      resetChoice: () => set({ hasChosen: false }),
    }),
    {
      name: "starfall.i18n",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
