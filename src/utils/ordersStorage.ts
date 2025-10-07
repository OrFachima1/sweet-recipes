export const STORAGE_KEYS = {
  LAST_JSON: "ordersCalendar.lastJson",
  MAPPING: "ordersCalendar.mapping",
  IGNORED: "ordersCalendar.ignoredUnknowns",
} as const;

const isBrowser = typeof window !== "undefined";

export function loadJson<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: any): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
