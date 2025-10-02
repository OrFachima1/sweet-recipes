"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, ensureAnonAuth } from "../lib/firebase";

type RecipeDoc = { category?: string | null };
type CategoryDoc = { key?: string; name?: string | null; active?: boolean | null; order?: number | null };

const norm = (s: string) => s.trim().toLowerCase();

export function useCategoryDict() {
  const [recipes, setRecipes] = useState<RecipeDoc[]>([]);
  const [catsDocs, setCatsDocs] = useState<CategoryDoc[]>([]);

  useEffect(() => {
    let u1: any, u2: any;
    (async () => {
      await ensureAnonAuth();
      u1 = onSnapshot(query(collection(db, "recipes"), orderBy("createdAt", "desc")),
        (snap) => setRecipes(snap.docs.map(d => d.data() as RecipeDoc)));
      u2 = onSnapshot(query(collection(db, "categories")),
        (snap) => setCatsDocs(snap.docs.map(d => d.data() as CategoryDoc)));
    })();
    return () => { u1 && u1(); u2 && u2(); };
  }, []);

  const names = useMemo(() => {
    // 1) איסוף ספירות מתוך מתכונים
    const map = new Map<string, { label: string; count: number; order?: number | null; active?: boolean | null }>();
    for (const r of recipes) {
      const raw = (r.category || "").trim();
      if (!raw) continue;
      if (raw === "ללא קטגוריה") continue;
      const key = norm(raw);
      const got = map.get(key);
      if (got) got.count += 1;
      else map.set(key, { label: raw, count: 1 });
    }
    // 2) מיזוג עם אוסף categories (שם/סדר/פעיל, גם אם count=0)
    for (const c of catsDocs) {
      const name = (c.name || c.key || "").trim();
      if (!name) continue;
      if (name === "ללא קטגוריה") continue;
      const key = norm(name);
      const got = map.get(key);
      if (got) {
        got.label = c.name || got.label;
        got.order = c.order ?? got.order;
        got.active = c.active ?? true;
      } else {
        map.set(key, { label: name, count: 0, order: c.order ?? null, active: c.active ?? true });
      }
    }
    // 3) לרשימה, מסנן inactive
    let arr = Array.from(map.values()).filter(x => x.active !== false);
    // סדר: לפי order אם יש, ואז לפי שכיחות, ואז אל"ף־בי"ת
    arr.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, "he");
    });
    return arr.map(x => x.label);
  }, [recipes, catsDocs]);

  return { names };
}
