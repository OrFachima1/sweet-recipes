"use client";
import { useMemo } from "react";
import { useRecipesContext } from "@/contexts/RecipesContext";

function norm(s: string) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .toLowerCase();
}

export function useIngredientDict() {
  const { recipes } = useRecipesContext();

  const names = useMemo(() => {
    const counts = new Map<string, { raw: string; n: number }>();
    for (const r of recipes) {
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
    arr.sort((a, b) => (b.n - a.n) || a.raw.localeCompare(b.raw, "he"));
    return arr.map((x) => x.raw);
  }, [recipes]);

  return { names };
}
