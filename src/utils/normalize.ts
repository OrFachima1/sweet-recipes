// src/utils/normalize.ts
import { IngestJsonOrder } from '@/types/orders';

// דוגמה לפונקציית נרמול הערות "חשובות". אפשר לעדן ע"פ הלוגיקה שלך
export function normalizeImportantNotes(order: IngestJsonOrder): IngestJsonOrder {
  // החלת נרמול על פריטי ההזמנה והערות כלליות — פעם אחת בלבד במהלך ה-ingest
  const items = (order.items || []).map(it => {
    let n = it.notes?.trim();
    // כאן אפשר להוסיף הלוגיקה שלך לזיהוי/מיזוג הערות
    return { ...it, notes: n };
  });
  const notes = order.notes?.trim();
  return { ...order, items, notes };
}
