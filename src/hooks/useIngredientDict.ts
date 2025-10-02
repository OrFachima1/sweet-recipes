"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, ensureAnonAuth } from "../lib/firebase";

type RecipeDoc = {
  ingredients?: Array<{ items?: Array<{ name?: string }> }>;
};

function norm(s: string) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .toLowerCase();
}

/** מחזיר רשימה ממוינת לפי שכיחות (יורד), בלי כפילויות */
export function useIngredientDict() {
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
    const counts = new Map<string, { raw: string; n: number }>();
    for (const r of rows) {
      for (const g of r.ingredients || []) {
        for (const it of g.items || []) {
          const raw = (it.name || "").trim();
          if (!raw) continue;
          const key = norm(raw);
          const entry = counts.get(key);
          if (entry) entry.n += 1;
          else counts.set(key, { raw, n: 1 });
        }
      }
    }
    const arr = Array.from(counts.values());
    // שכיחים קודם, ואז לפי אל"ף־בי"ת
    arr.sort((a, b) => (b.n - a.n) || a.raw.localeCompare(b.raw, "he"));
    return arr.map((x) => x.raw);
  }, [rows]);

  return { names };
}
