import { useI18nStore } from "./store";
import { STRINGS, type StringKey } from "./strings";

type Params = Record<string, string | number>;

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

/**
 * Subscribes to the active locale (so components re-render when it changes)
 * and returns a memoization-friendly `t(key, params?)` function. Falls back
 * to the English entry when a key is missing in the active locale — this
 * shouldn't happen in production thanks to the StringKey type, but it keeps
 * the UI readable during translation work.
 */
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const table = STRINGS[locale] ?? STRINGS.en;
  return (key: StringKey, params?: Params): string => {
    const raw = (table as Record<string, string>)[key] ?? STRINGS.en[key] ?? key;
    return format(raw, params);
  };
}
