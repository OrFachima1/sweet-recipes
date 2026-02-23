// ====== Orders domain types ======

// פריט הזמנה גולמי כפי שמגיע מהשרת (לפני נרמול אצלך)
export interface IngestJsonOrderItem {
  title: string;                // שם מנה
  qty: number;                  // כמות
  unit?: string | null;         // יחידה (אופציונלי)
  notes?: string | null;        // הערות לפריט (אופציונלי)
}

// סוג אספקה
export type DeliveryMethod = 'delivery' | 'pickup';

// הזמנה גולמית כפי שמגיעה מהשרת (לפני נרמול אצלך)
export interface IngestJsonOrder {
  __id?: string;
  orderId?: string | null;
  clientName: string;
  clientColor?: string;
  eventDate?: string | null;
  status?: string;
  items: IngestJsonOrderItem[];
  orderNotes?: string | string[] | null;
  notes?: string | string[] | null;       // תאימות לאחור
  totalSum?: number | null;
  currency?: string | null;
  source?: string | null;
  meta?: Record<string, unknown>;
  // שדות משלוח
  deliveryMethod?: DeliveryMethod | null;  // משלוח / איסוף
  estimatedTime?: string | null;           // שעה משוערת (HH:MM)
  phone1?: string | null;                  // טלפון ראשי
  phone2?: string | null;                  // טלפון משני
  address?: string | null;                 // כתובת למשלוח
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
  // שדות משלוח
  deliveryMethod?: DeliveryMethod | null;
  estimatedTime?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  address?: string | null;
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
