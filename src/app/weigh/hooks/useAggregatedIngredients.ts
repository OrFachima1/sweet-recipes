import { useMemo } from "react";
import { parseQtyToNumber } from "../utils/qtyParser";
import { norm } from "../utils/colorUtils";
import type { Recipe, AggregatedIngredient, RecipeProgress } from "../utils/types";

/**
 * Normalize units to base units (kg, liters, etc.)
 */
function normalizeUnit(unit: string): { normalized: string; factor: number } {
  const u = unit.toLowerCase().trim();
  
  // Weight conversions
  if (u === 'ק"ג' || u === 'קילוגרם' || u === 'kg') return { normalized: 'גרם', factor: 1000 };
  if (u === 'גרם' || u === 'גר' || u === 'g' || u === 'gr') return { normalized: 'גרם', factor: 1 };
  
  // Volume conversions
  if (u === 'ליטר' || u === 'ל' || u === 'l') return { normalized: 'מ"ל', factor: 1000 };
  if (u === 'מ"ל' || u === 'מל' || u === 'ml') return { normalized: 'מ"ל', factor: 1 };
  
  // Keep as-is for other units
  return { normalized: u, factor: 1 };
}

/**
 * Format quantity with appropriate unit
 */
function formatWithUnit(qty: number, baseUnit: string): { qty: number; unit: string } {
  if (baseUnit === 'גרם' && qty >= 1000) {
    return { qty: qty / 1000, unit: 'ק"ג' };
  }
  if (baseUnit === 'מ"ל' && qty >= 1000) {
    return { qty: qty / 1000, unit: 'ליטר' };
  }
  return { qty, unit: baseUnit };
}

/**
 * Hook to aggregate ingredients from multiple recipes
 */
export function useAggregatedIngredients(
  recipes: Recipe[],
  scales: Record<string, number>
) {
  const getScale = (id: string) => scales[id] ?? 1;

  const aggregatedIngredients = useMemo(() => {
    const aggregateMap = new Map<string, AggregatedIngredient & { baseUnit: string; baseQty: number }>();
    
    for (const r of recipes) {
      const scale = getScale(r.id);
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          const k = norm(it.name);
          if (!k) continue;
          
          const qty = parseQtyToNumber(it.qty);
          if (qty === null) continue;
          
          const scaledQty = qty * scale;
          
          // Normalize the unit
          const { normalized: baseUnit, factor } = normalizeUnit(it.unit || '');
          const baseQty = scaledQty * factor;
          
          if (aggregateMap.has(k)) {
            const existing = aggregateMap.get(k)!;
            existing.baseQty += baseQty;
            if (!existing.sources.includes(r.title)) {
              existing.sources.push(r.title);
            }
            existing.items.push({
              ...it,
              qty: scaledQty,
              recipeTitle: r.title,
              recipeId: r.id,
              groupName: g.groupName || '', // Add group name
            });
          } else {
            aggregateMap.set(k, {
              name: it.name,
              totalQty: 0, // Will be calculated below
              unit: '', // Will be calculated below
              baseUnit,
              baseQty,
              sources: [r.title],
              items: [{
                ...it,
                qty: scaledQty,
                recipeTitle: r.title,
                recipeId: r.id,
                groupName: g.groupName || '', // Add group name
              }]
            });
          }
        }
      }
    }
    
    // Convert back to display units
    const result = Array.from(aggregateMap.values()).map(item => {
      const { qty, unit } = formatWithUnit(item.baseQty, item.baseUnit);
      return {
        name: item.name,
        totalQty: qty,
        unit,
        sources: item.sources,
        items: item.items,
      };
    });
    
    return result.sort((a, b) => b.totalQty - a.totalQty);
  }, [recipes, scales]);

  return aggregatedIngredients;
}

/**
 * Hook to calculate base quantities (without scaling)
 */
export function useBaseQuantities(recipes: Recipe[]) {
  return useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of recipes) {
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          m.set(it.id, parseQtyToNumber(it.qty));
        }
      }
    }
    return m;
  }, [recipes]);
}

/**
 * Hook to calculate per-recipe completion progress
 */
export function useRecipeProgress(
  recipes: Recipe[],
  weighed: Set<string>
): Record<string, RecipeProgress> {
  return useMemo(() => {
    const progress: Record<string, RecipeProgress> = {};
    
    for (const r of recipes) {
      let completed = 0;
      let total = 0;
      
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          total++;
          if (weighed.has(it.name)) completed++;
        }
      }
      
      progress[r.id] = { completed, total };
    }
    
    return progress;
  }, [recipes, weighed]);
}

/**
 * Hook to get all unique ingredients (for filtering/search)
 */
export function useAllIngredients(recipes: Recipe[]) {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes) {
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          const k = norm(it.name);
          if (!k) continue;
          if (!map.has(k)) map.set(k, it.name || k);
        }
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "he"));
  }, [recipes]);
}