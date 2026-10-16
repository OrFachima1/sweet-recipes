"use client";
import { useMemo } from "react";
import { useRecipesContext } from "@/contexts/RecipesContext";

const norm = (s: string) => s.trim().toLowerCase();

export function useCategoryDict() {
  const { recipes, catsDocs } = useRecipesContext();

  const names = useMemo(() => {
    const map = new Map<string, { label: string; count: number; order?: number | null; active?: boolean | null }>();
    for (const r of recipes) {
      const raw = (r.category || "").trim();
      if (!raw || raw === "ללא קטגוריה") continue;
      const key = norm(raw);
      const got = map.get(key);
      if (got) got.count += 1;
      else map.set(key, { label: raw, count: 1 });
    }
    for (const c of catsDocs) {
      const name = (c.name || c.key || "").trim();
      if (!name || name === "ללא קטגוריה") continue;
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
    let arr = Array.from(map.values()).filter(x => x.active !== false);
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
