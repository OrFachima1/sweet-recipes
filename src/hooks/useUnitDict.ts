"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, ensureAnonAuth } from "../lib/firebase";

type RecipeDoc = {
  ingredients?: Array<{ items?: Array<{ unit?: string | null }> }>;
};

const norm = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[״"]/g, '"').replace(/[׳']/g, "'").toLowerCase();

// מיפוי כתיבים → צורה קנונית
function canonical(u: string): string {
  const x = norm(u);
  // יחידות נפוצות בעברית (אפשר להרחיב בהמשך)
  if (["ג", "ג'", "גרם", "גרם."].includes(x)) return "גרם";
  if (["קג", "ק\"ג", "ק'ג", "קילוגרם"].includes(x)) return "ק\"ג";
  if (["מל", "מ\"ל", "מ״ל", "מיליליטר", "מיליליטרים"].includes(x)) return "מ״ל";
  if (["ל", "ל'", "ליטר", "ליטרים"].includes(x)) return "ליטר";
  if (["כפ", "כפית", "כפיות", "tsp"].includes(x)) return "כפית";
  if (["כף", "כפות", "tbsp"].includes(x)) return "כף";
  if (["כוס", "כוסות", "cup", "cups"].includes(x)) return "כוס";
  if (["יח", "יח'", "יח׳", "יחידה", "יחידות"].includes(x)) return "יח׳";
  if (["שקית", "שקיות"].includes(x)) return "שקית";
  if (["תבנית", "תבניות"].includes(x)) return "תבנית";
  if (["קורט", "פינץ'","קורט מלח"].includes(x)) return "קורט";
  if (["צרור","חבילה","אריזה","קופסה","פחית"].includes(x)) return u.trim(); // משאיר כתיב מלא
  return u.trim(); // ברירת מחדל – לא נוגעים
}

// רשימת בסיס (תמיד למעלה), אח"כ דינמי מהמתכונים
const BASE_UNITS = ["גרם", "ק\"ג", "מ״ל", "ליטר", "כפית", "כף", "כוס", "יח׳", "שקית", "תבנית", "קורט"];

export function useUnitDict() {
  const [rows, setRows] = useState<RecipeDoc[]>([]);

  useEffect(() => {
    let unsub: any;
    (async () => {
      await ensureAnonAuth();
      const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qCol, (snap) => {
        setRows(snap.docs.map((d) => d.data() as RecipeDoc));
      });
    })();
    return () => unsub && unsub();
  }, []);

  const names = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const g of r.ingredients || []) {
        for (const it of g.items || []) {
          const raw = (it.unit || "").trim();
          if (!raw) continue;
          const canon = canonical(raw);
          counts.set(canon, (counts.get(canon) || 0) + 1);
        }
      }
    }
    // איחוד עם הבסיס (בלי כפילויות), סדר: בסיס קודם, אח"כ לפי שכיחות ואז אלפבית
    const dynamic = Array.from(counts.entries())
      .filter(([u]) => !BASE_UNITS.includes(u))
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], "he"))
      .map(([u]) => u);

    return [...BASE_UNITS, ...dynamic];
  }, [rows]);

  return { names };
}
