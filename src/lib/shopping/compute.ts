// src/lib/shopping/compute.ts
// חישוב מצרכי הקניות מההזמנות: מנה → מתכון (עם השינויים שהוגדרו) או רכיבים ידניים → מאוחד לפי שם.
import type { Recipe } from '@/hooks/useShoppingList';
import type { DishIngredient, DishSetting } from './types';

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
  breakdown: BreakdownLine[]; // מאיפה הגיעה הכמות
}

export interface BreakdownLine {
  dish: string;
  dishQty: number;      // כמה מנות הוזמנו
  perDish: number;      // כמות המצרך למנה אחת (אחרי multiplier)
  unit: string;
  total: number;
}

interface ComputeDeps {
  recipes: Recipe[];
  recipeLinks: Record<string, string>;
  recipeSettings: DishSetting[];
  ingredientMappings: Record<string, string>;
}

export function ingredientKey(name: string, ingredientMappings: Record<string, string>) {
  const normalized = normalizeIngredientName(name);
  const mapped = ingredientMappings[normalized];
  return mapped ? normalizeIngredientName(mapped) : normalized;
}

export interface ResolvedDish {
  status: 'recipe' | 'custom' | 'manual' | 'excluded' | 'missing';
  recipe: Recipe | null;
  multiplier: number;
  // רכיבים למנה אחת לפני חלוקה ב-multiplier
  ingredients: Array<DishIngredient & { fromRecipe: boolean; changed: boolean }>;
}

// השינויים שהמשתמש עשה, מתוך הגדרה בכל אחד מהפורמטים
export function overridesOf(setting: DishSetting): { disabled: Set<string>; overrides: Record<string, DishIngredient>; extras: DishIngredient[] } {
  if (setting.mode === 'overrides') {
    return {
      disabled: new Set(setting.disabled || []),
      overrides: setting.overrides || {},
      extras: setting.extras || [],
    };
  }
  // פורמט ישן: משווים לכמות שהייתה במתכון בזמן השמירה (originalQty) —
  // רק מה שהמשתמש שינה נשמר, השאר נלקח מהמתכון העדכני
  const disabled = new Set<string>();
  const overrides: Record<string, DishIngredient> = {};
  const extras: DishIngredient[] = [];
  for (const ing of setting.customIngredients || []) {
    if (!ing.name?.trim()) continue;
    const key = normalizeIngredientName(ing.name);
    const qty = Number(ing.qty) || 0;
    if (ing.originalQty === undefined) {
      if (ing.enabled) extras.push({ name: ing.name, qty, unit: ing.unit });
      continue;
    }
    if (!ing.enabled) disabled.add(key);
    else if (qty !== ing.originalQty) overrides[key] = { name: ing.name, qty, unit: ing.unit };
  }
  return { disabled, overrides, extras };
}

export function resolveDish(dish: string, deps: Omit<ComputeDeps, 'ingredientMappings'>): ResolvedDish {
  const { recipes, recipeLinks, recipeSettings } = deps;
  const recipeId = recipeLinks[dish] || null;
  const setting = recipeSettings.find(s => s.menuItemName === dish);

  if (setting && setting.enabled === false) {
    return { status: 'excluded', recipe: null, multiplier: 1, ingredients: [] };
  }

  // מנה בלי מתכון מקושר — רק הגדרה ידנית
  if (!recipeId) {
    const isManual = setting && (setting.mode === 'manual' || (!setting.mode && !setting.originalRecipeId));
    const list = (setting?.customIngredients || []).filter(i => i.enabled && i.name?.trim());
    if (isManual && list.length) {
      return {
        status: 'manual',
        recipe: null,
        multiplier: setting!.multiplier || 1,
        ingredients: list.map(i => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit, fromRecipe: false, changed: false })),
      };
    }
    return { status: 'missing', recipe: null, multiplier: 1, ingredients: [] };
  }

  const recipe = recipes.find(r => r.id === recipeId) || null;
  if (!recipe) return { status: 'missing', recipe: null, multiplier: 1, ingredients: [] };

  // השינויים חלים רק אם נשמרו עבור המתכון שמקושר עכשיו
  const applies = setting && (setting.mode === 'overrides' ? setting.forRecipeId === recipeId : setting.originalRecipeId === recipeId);
  const ov = applies ? overridesOf(setting!) : { disabled: new Set<string>(), overrides: {} as Record<string, DishIngredient>, extras: [] as DishIngredient[] };

  const ingredients: ResolvedDish['ingredients'] = [];
  let changedAny = false;
  for (const group of recipe.ingredients || []) {
    for (const ing of group.items || []) {
      if (!ing.name?.trim()) continue;
      const key = normalizeIngredientName(ing.name);
      if (ov.disabled.has(key)) { changedAny = true; continue; }
      const o = ov.overrides[key];
      if (o) changedAny = true;
      ingredients.push({
        name: ing.name,
        qty: o ? o.qty : parseFloat(ing.qty) || 0,
        unit: o ? o.unit : ing.unit,
        fromRecipe: true,
        changed: !!o,
      });
    }
  }
  for (const ex of ov.extras) {
    changedAny = true;
    ingredients.push({ ...ex, fromRecipe: false, changed: true });
  }
  const multiplier = applies ? setting!.multiplier || 1 : 1;
  return {
    status: changedAny || multiplier !== 1 ? 'custom' : 'recipe',
    recipe,
    multiplier,
    ingredients,
  };
}

export function computeShoppingItems(orders: OrderLike[], deps: ComputeDeps): ComputedItem[] {
  const { ingredientMappings } = deps;

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
      entry = { key, altKey, name: ingredientMappings[altKey] || ingName, qty: 0, unit, sources: [], breakdown: [], _sources: new Set() };
      aggregated.set(key, entry);
    }
    entry.qty += qty;
    if (!entry._sources.has(dish)) {
      entry._sources.add(dish);
      entry.sources.push(dish);
    }
    const line = entry.breakdown.find(b => b.dish === dish && b.unit === unit);
    if (line) { line.total += qty; line.perDish = line.total / line.dishQty; }
    else entry.breakdown.push({ dish, dishQty: dishQty, perDish: qty / dishQty, unit, total: qty });
  };
  let dishQty = 1;

  for (const [dish, totalQty] of qtyByDish) {
    if (!totalQty) continue;
    dishQty = totalQty;
    const r = resolveDish(dish, deps);
    for (const ing of r.ingredients) add(ing.name, ing.unit, (ing.qty / r.multiplier) * totalQty, dish);
  }

  return [...aggregated.values()]
    .map(({ _sources, ...item }) => item)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

// כל המנות בהזמנות, עם הסטטוס שלהן — בשביל האזהרה "מנות שלא נספרות"
export function dishesInOrders(orders: OrderLike[], deps: Omit<ComputeDeps, 'ingredientMappings'>) {
  const qty = new Map<string, number>();
  for (const o of orders) for (const it of o.items || []) qty.set(it.title, (qty.get(it.title) || 0) + (Number(it.qty) || 1));
  return [...qty.entries()].map(([dish, q]) => ({ dish, qty: q, status: resolveDish(dish, deps).status }));
}

export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
