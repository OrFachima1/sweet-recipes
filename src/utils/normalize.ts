// src/utils/normalize.ts
import { IngestJsonOrder } from '@/types/orders';

const normNotes = (x: unknown): string | undefined => {
  if (x == null) return undefined;
  const s = Array.isArray(x) ? x.map(v => String(v)).join(' ') : String(x);
  const t = s.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

// נרמול הערות "חשובות" לפריטים ולהזמנה עצמה
export function normalizeImportantNotes(order: IngestJsonOrder): IngestJsonOrder {
  const items = (order.items ?? []).map(it => ({
    ...it,
    notes: normNotes((it as any).notes),
  }));

  const notes = normNotes((order as any).notes);

  return { ...order, items, notes };
}
