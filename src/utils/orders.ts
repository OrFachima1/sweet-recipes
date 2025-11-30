// =============================
// 📌 Orders Utilities
// =============================

// ---------- Date helpers ----------
export const fmtYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const genId = () =>
  `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

export function startOfWeek(d: Date, weekStartsOn = 0) {
  const x = new Date(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getMonthGridMax5(viewDate: Date, weekStartsOn = 0) {
 const first = startOfMonth(viewDate);
  const last = endOfMonth(viewDate);
  const leading = (first.getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = last.getDate();
  const rows = Math.ceil((leading + daysInMonth) / 7);  // ללא הגבלה ל-5
  const total = rows * 7;
  const cells: { date: Date | null; inMonth: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const dayOffset = i - leading;
    const cur = new Date(first);
    cur.setDate(first.getDate() + dayOffset);
    const inMonth = cur >= first && cur <= last;
    cells.push({ date: inMonth ? cur : null, inMonth });
  }
  return { cells, rows };
}

// ---------- Normalization + Mapping ----------
export const IMPORTANT_NOTE_TARGETS = [
  "קיש משפחתי קוטר 24",
  "'כריכונים 15 יח",
  "כריכונים 15 יח'",
  "מיקס טורטי 24 יחידות",
  "מיקס טורטי 18 יחידות",
];

export const LOSSLESS_MODE = true;

export const clean = (s: string) =>
  s.normalize("NFKC")
    .replace(/[\u200F\u200E]/g, "")
    .replace(/[“”„‟"׳’']/g, "'")
    .replace(/[–—־-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeTitleKey = (s: string) =>
  clean(s).replace(/[()\[\]{}.,:;!?]/g, "").toLowerCase();

export const buildMenuKeyMap = (menu: string[]) => {
  const map = new Map<string, string>();
  for (const title of menu) map.set(normalizeTitleKey(title), title);
  return map;
};

export const toCanonicalMenuTitle = (menuKeyMap: Map<string, string>, anyTitle: string) => {
  const key = normalizeTitleKey(anyTitle || '');
  return menuKeyMap.get(key) ?? null;
};

export const isStrictImportantTitle = (title: string) => {
  const key = normalizeTitleKey(title);
  return IMPORTANT_NOTE_TARGETS.map(normalizeTitleKey).some(t => t === key);
};

export const COLON_ANY = /\s*[:\u05C3\u0589\u2236\uFF1A]{1,2}\s*/;

export const boldSegments = (s: string) =>
  Array.from(s.matchAll(/\*\*([^*]+)\*\*/g)).map(m => clean(m[1]));

export const buildCleanMapping = (
  mapping: Record<string, string>,
  menu: string[]
): Record<string, string> => {
  const menuKeyMap = buildMenuKeyMap(menu);
  const cleanMap: Record<string, string> = {};

  for (const [unknownRaw, chosen] of Object.entries(mapping)) {
    if (!chosen) continue;
    const canonical = toCanonicalMenuTitle(menuKeyMap, chosen);
    if (canonical) {
      cleanMap[unknownRaw] = canonical;
    }
  }
  return cleanMap;
};

export type MappingDict = Record<string, string>;

export const applyMappingGlobally = <T extends { items: { title: string }[] }>(
  ordersList: T[],
  mapRaw: MappingDict
): T[] => {
  if (!mapRaw || !Object.keys(mapRaw).length) return ordersList;

  const normMap = new Map<string, string>();
  for (const [from, to] of Object.entries(mapRaw)) {
    normMap.set(normalizeTitleKey(from), to);
  }
  const rawMap = new Map(Object.entries(mapRaw));

  return ordersList.map((o) => ({
    ...o,
    items: (o.items || []).map(it => {
      const raw = (it.title || '').trim();
      if (rawMap.has(raw)) return { ...it, title: rawMap.get(raw)! };
      const alt = normMap.get(normalizeTitleKey(raw));
      if (alt) return { ...it, title: alt };
      return it;
    }),
  })) as T[];
};

export function splitTargetAndContent(note: string): { target: string | null; content: string } {
  const raw = clean(note).replace(/\s*::\s*/g, ": ");
  const m = raw.split(COLON_ANY);
  if (m.length >= 2) {
    const target = m[0]?.trim() || null;
    const content = m.slice(1).join(": ").trim();
    return { target, content };
  }
  return { target: null, content: raw };
}

export function pickItemIndexByTarget(items: any[], target: string | null) {
  if (!target) return -1;
  const tk = normalizeTitleKey(target);
  let idx = items.findIndex(it => normalizeTitleKey(it.title).startsWith(tk));
  if (idx !== -1) return idx;
  idx = items.findIndex(it => normalizeTitleKey(it.title).includes(tk));
  return idx;
}

export function appendNote(it: any, text: string) {
  const t = clean(text);
  const cur = it.notes ? clean(it.notes) : "";
  if (!t) return it;
  if (cur && (cur.includes(t) || t.includes(cur))) return it;
  return { ...it, notes: cur ? `${it.notes} | ${text}` : text };
}

// T generic to preserve typing for orders
export function normalizeImportantNotes<T extends { items: any[]; orderNotes?: string | string[] | null | undefined }>(order: T): T {
  const notesList: string[] = Array.isArray(order.orderNotes)
    ? (order.orderNotes as string[])
    : (typeof order.orderNotes === "string" && order.orderNotes.trim() ? [order.orderNotes] : []);

  if (!notesList.length) return order;

  const items = order.items.map(it => ({ ...it }));

  for (const raw of notesList) {
    const { target, content } = splitTargetAndContent(raw);
    const stars = boldSegments(raw);
    const payload = (content || "").trim() || String(raw).trim();

    if (target) {
      const targetedIdx = pickItemIndexByTarget(items, target);
      if (targetedIdx !== -1 && isStrictImportantTitle(items[targetedIdx].title)) {
        items[targetedIdx] = appendNote(items[targetedIdx], payload);
      }
      continue;
    }

    if (stars.length) {
      let attached = false;
      for (const seg of stars) {
        const idx = pickItemIndexByTarget(items, seg);
        if (idx !== -1) {
          items[idx] = appendNote(items[idx], payload);
          attached = true;
          break;
        }
      }
      if (attached) continue;
    }

    for (let i = 0; i < items.length; i++) {
      if (isStrictImportantTitle(items[i].title)) {
        items[i] = appendNote(items[i], payload);
      }
    }
  }

  return { ...order, items, orderNotes: null } as T;
}

export const getUnknownTitles = (
  ordersList: any[],
  menu: string[],
  ignoredList: string[]
) => {
  const menuKeyMap = buildMenuKeyMap(menu);
  const ignoredKeys = new Set(ignoredList.map(normalizeTitleKey));
  const titles = new Map<string, string>();

  for (const o of ordersList) {
    for (const it of (o.items || [])) {
      const raw = (it.title || '').trim();
      if (!raw) continue;
      const key = normalizeTitleKey(raw);
      if (ignoredKeys.has(key)) continue;
      if (menuKeyMap.has(key)) continue;
      if (!titles.has(key)) titles.set(key, raw);
    }
  }
  return Array.from(titles.values()).sort((a, b) => a.localeCompare(b, 'he'));
};

export const applyMappingOnOrders = <T extends { items: { title: string }[] }>(
  ordersList: T[],
  map: MappingDict
): T[] => {
  return ordersList.map((o) => ({
    ...o,
    items: o.items.map(it => (map[it.title] ? { ...it, title: map[it.title] } : it)),
  })) as T[];
};
