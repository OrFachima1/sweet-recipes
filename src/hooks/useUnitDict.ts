"use client";
import { useMemo } from "react";
import { useRecipesContext } from "@/contexts/RecipesContext";

const norm = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[״"]/g, '"').replace(/[׳']/g, "'").toLowerCase();

function canonical(u: string): string {
  const x = norm(u);
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
  if (["קורט", "פינץ'", "קורט מלח"].includes(x)) return "קורט";
  if (["צרור", "חבילה", "אריזה", "קופסה", "פחית"].includes(x)) return u.trim();
  return u.trim();
}

const BASE_UNITS = ["גרם", "ק\"ג", "מ״ל", "ליטר", "כפית", "כף", "כוס", "יח׳", "שקית", "תבנית", "קורט"];

export function useUnitDict() {
  const { recipes } = useRecipesContext();

  const names = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      for (const g of r.ingredients || []) {
        for (const it of g.items || []) {
          const raw = (it.unit || "").trim();
          if (!raw) continue;
          const canon = canonical(raw);
          counts.set(canon, (counts.get(canon) || 0) + 1);
        }
      }
    }
    const dynamic = Array.from(counts.entries())
      .filter(([u]) => !BASE_UNITS.includes(u))
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], "he"))
      .map(([u]) => u);
    return [...BASE_UNITS, ...dynamic];
  }, [recipes]);

  return { names };
}
