// ====== Orders domain types ======

// פריט הזמנה גולמי כפי שמגיע מהשרת (לפני נרמול אצלך)
export interface IngestJsonOrderItem {
  title: string;                // שם מנה
  qty: number;                  // כמות
  unit?: string | null;         // יחידה (אופציונלי)
  notes?: string | null;        // הערות לפריט (אופציונלי)
}

// הזמנה גולמית כפי שמגיעה מהשרת (לפני נרמול אצלך)
export interface IngestJsonOrder {
  __id?: string;
  orderId?: string | null;
  clientName: string;
  clientColor?: string; // ✅ הוסף את זה!
  eventDate?: string | null;
  status?: string;
  items: IngestJsonOrderItem[];
  orderNotes?: string | string[] | null;  // החדש/המועדף
  notes?: string | string[] | null;       // 🔁 תאימות לאחור (responses ישנים)
  totalSum?: number | null;
  currency?: string | null;
  source?: string | null;
  meta?: Record<string, unknown>;
}


// אחרי הנרמול אצלך (האוביקט שאתה מציג ושומר ב-local)
export interface NormalizedOrderItem {
  title: string;
  qty: number;
  unit?: string | null;
  notes?: string | null;
}

export interface NormalizedOrder {
  __id: string;
  orderId: string | null;
  clientName: string;
  eventDate: string | null;
  status: string;
  items: NormalizedOrderItem[];
  orderNotes: string | string[] | null;
  totalSum: number | null;
  currency: string | null;
  source?: string | null;
  meta?: Record<string, unknown>;
}

// תגובות API
export interface PreviewJsonResponse {
  ok?: boolean;
  unknown?: string[];
  orders?: IngestJsonOrder[]; // חלק מהמימושים מחזירים גם preview orders
  error?: string | null;
}

export interface IngestJsonResponse {
  orders?: IngestJsonOrder[];
  unknown?: string[];
  error?: string | null;
}

// מפות עזר
export type NoteOpenMap = Record<string, boolean>;              // למשל "orderId:index" => true/false
export type DaysMap = Map<string, NormalizedOrder[]>;           // "YYYY-MM-DD" => רשימת הזמנות
export type MappingDict = Record<string, string>;               // מיפוי שם לא מוכר -> שם תפריט קנוני
