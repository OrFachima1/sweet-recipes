// src/lib/shopping/compute.ts
// חישוב מצרכי הקניות מההזמנות: מנה → מתכון (או הגדרה ידנית) → רכיבים, מאוחד לפי שם.
// אותה לוגיקה שהייתה ב-useShoppingList, כפונקציה טהורה.
import type { Recipe, RecipeSettings } from '@/hooks/useShoppingList';

export const normalizeIngredientName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[´"]/g, '"')
    .replace(/[³']/g, "'");

export interface OrderLike {
  items?: Array<{ title: string; qty?: number | string }>;
}

export interface ComputedItem {
  key: string;          // שם מנורמל אחרי מיפוי — מזהה המצרך ברשימה
  altKey: string;       // השם המנורמל לפני מיפוי (לחיפוש קטגוריה ישנה)
  name: string;
  qty: number;
  unit: string;
  sources: string[];    // אילו מנות צריכות את המצרך
}

interface ComputeDeps {
  recipes: Recipe[];
  recipeLinks: Record<string, string>;
  recipeSettings: RecipeSettings[];
  ingredientMappings: Record<string, string>;
}

export function ingredientKey(name: string, ingredientMappings: Record<string, string>) {
  const normalized = normalizeIngredientName(name);
  const mapped = ingredientMappings[normalized];
  return mapped ? normalizeIngredientName(mapped) : normalized;
}

export function computeShoppingItems(orders: OrderLike[], deps: ComputeDeps): ComputedItem[] {
  const { recipes, recipeLinks, recipeSettings, ingredientMappings } = deps;

  const qtyByDish = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items || []) {
      qtyByDish.set(item.title, (qtyByDish.get(item.title) || 0) + (Number(item.qty) || 1));
    }
  }

  const aggregated = new Map<string, ComputedItem & { _sources: Set<string> }>();
  const add = (ingName: string, unit: string, qty: number, dish: string) => {
    const altKey = normalizeIngredientName(ingName);
    const key = ingredientKey(ingName, ingredientMappings);
    let entry = aggregated.get(key);
    if (!entry) {
      entry = {
        key,
        altKey,
        name: ingredientMappings[altKey] || ingName,
        qty: 0,
        unit,
        sources: [],
        _sources: new Set(),
      };
      aggregated.set(key, entry);
    }
    entry.qty += qty;
    if (!entry._sources.has(dish)) {
      entry._sources.add(dish);
      entry.sources.push(dish);
    }
  };

  for (const [dish, totalQty] of qtyByDish) {
    if (!totalQty) continue;
    const recipeId = recipeLinks[dish] || null;

    // מנה בלי מתכון מקושר — רק אם יש לה הגדרה ידנית
    if (!recipeId) {
      const manual = recipeSettings.find(s => s.menuItemName === dish && !s.originalRecipeId);
      if (manual && manual.enabled) {
        const multiplier = manual.multiplier || 1;
        for (const ing of manual.customIngredients) {
          if (ing.enabled) add(ing.name, ing.unit, (ing.qty / multiplier) * totalQty, dish);
        }
      }
      continue;
    }

    const settings = recipeSettings.find(
      s => (s.originalRecipeId || s.recipeId) === recipeId && s.menuItemName === dish
    );
    if (settings && !settings.enabled) continue;

    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) continue;

    const multiplier = settings?.multiplier || 1;
    if (settings && settings.customIngredients.length > 0) {
      for (const ing of settings.customIngredients) {
        if (ing.enabled) add(ing.name, ing.unit, (ing.qty / multiplier) * totalQty, dish);
      }
    } else {
      for (const group of recipe.ingredients || []) {
        for (const ing of group.items || []) {
          add(ing.name, ing.unit, (parseFloat(ing.qty) || 0) * totalQty, dish);
        }
      }
    }
  }

  return [...aggregated.values()]
    .map(({ _sources, ...item }) => item)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
