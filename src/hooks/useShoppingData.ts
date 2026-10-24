// src/hooks/useShoppingData.ts
// הנתונים שרשימת קניות נבנית מהם: מתכונים, קישורי מנות, מיפויים, הגדרות מנות, קטגוריות, רכיבים שלא קונים,
// וההזמנות בטווח של הרשימה — הכל בהאזנה חיה, כדי שהרשימה תתעדכן כשמשהו משתנה.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addDays, fmtYMD } from '@/utils/orders';
import { getRecipesCached, type Recipe } from '@/hooks/useShoppingList';
import type { Category, DishSetting } from '@/lib/shopping/types';
import {
  computeShoppingItems, dishesInOrders, ingredientKey, type ComputedItem, type OrderLike,
} from '@/lib/shopping/compute';

const DEFAULT_CATEGORIES: Category[] = [{ id: 'other', name: 'כללי', color: '' }];

const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export interface CatalogIngredient {
  key: string;
  name: string;
  units: string[];
  recipes: string[];   // שמות המתכונים/המנות שבהם הרכיב מופיע
}

export interface ShoppingData {
  loading: boolean;
  items: ComputedItem[];            // אחרי סינון רכיבים שלא קונים
  ignoredInList: ComputedItem[];    // רכיבים שהיו ברשימה אבל מסומנים "לא קונים"
  dishes: Array<{ dish: string; qty: number; status: string }>;
  ordersCount: number;
  categories: Category[];
  itemCategories: Record<string, string>;
  ignoredIngredients: Record<string, boolean>;
  ingredientMappings: Record<string, string>;
  recipes: Recipe[];
  recipeLinks: Record<string, string>;
  recipeSettings: DishSetting[];
  allMenuItems: string[];
  knownNames: string[];
  catalog: CatalogIngredient[];
}

export function useShoppingData(range: { start: string; end: string } | null, enabled = true): ShoppingData {
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [ingredientMappings, setIngredientMappings] = useState<Record<string, string>>({});
  const [recipeSettings, setRecipeSettings] = useState<DishSetting[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [ignoredIngredients, setIgnoredIngredients] = useState<Record<string, boolean>>({});
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // מתכונים ומיפויי שמות — פעם אחת (המתכונים במטמון לכל הסשן)
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [recipesData, mappingsDoc] = await Promise.all([
          getRecipesCached(),
          getDoc(doc(db, 'orderSettings', 'ingredientMappings')),
        ]);
        if (cancelled) return;
        setRecipes(recipesData);
        setIngredientMappings(mappingsDoc.exists() ? mappingsDoc.data().mappings || {} : {});
      } catch (e) {
        console.error('Failed loading recipes for shopping', e);
      } finally {
        if (!cancelled) setRecipesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // הגדרות שמשתנות תוך כדי עבודה — חי
  useEffect(() => {
    if (!enabled) return;
    const subs = [
      onSnapshot(doc(db, 'orderSettings', 'recipeLinks'), s => setRecipeLinks(s.data()?.links || {}), e => console.error(e)),
      onSnapshot(doc(db, 'orderSettings', 'shoppingListSettings'), s => setRecipeSettings(s.data()?.settings || []), e => console.error(e)),
      onSnapshot(doc(db, 'orderSettings', 'menu'), s => setAllMenuItems(s.data()?.items || []), e => console.error(e)),
      onSnapshot(
        doc(db, 'orderSettings', 'shoppingCategories'),
        (snap) => {
          const data = snap.data();
          setCategories(data?.categories?.length ? data.categories : DEFAULT_CATEGORIES);
          setItemCategories(data?.itemCategories || {});
          setIgnoredIngredients(data?.ignoredIngredients || {});
        },
        (e) => console.error('Failed loading shopping categories', e)
      ),
    ];
    return () => subs.forEach(u => u());
  }, [enabled]);

  // הזמנות בטווח הרשימה. גבול עליון לא כולל של היום שאחרי, כדי לתפוס גם "YYYY-MM-DDTHH:MM:SS"
  const start = range?.start;
  const end = range?.end;
  useEffect(() => {
    if (!enabled || !start || !end) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    const endExclusive = fmtYMD(addDays(parseYMD(end), 1));
    return onSnapshot(
      query(collection(db, 'orders'), where('eventDate', '>=', start), where('eventDate', '<', endExclusive)),
      (snap) => {
        setOrders(snap.docs.map(d => d.data() as OrderLike));
        setOrdersLoading(false);
      },
      (e) => { console.error('Failed loading orders for shopping list', e); setOrdersLoading(false); }
    );
  }, [enabled, start, end]);

  const allItems = useMemo(
    () => computeShoppingItems(orders, { recipes, recipeLinks, recipeSettings, ingredientMappings }),
    [orders, recipes, recipeLinks, recipeSettings, ingredientMappings]
  );
  const items = useMemo(() => allItems.filter(i => !ignoredIngredients[i.key]), [allItems, ignoredIngredients]);
  const ignoredInList = useMemo(() => allItems.filter(i => ignoredIngredients[i.key]), [allItems, ignoredIngredients]);

  const dishes = useMemo(
    () => dishesInOrders(orders, { recipes, recipeLinks, recipeSettings }),
    [orders, recipes, recipeLinks, recipeSettings]
  );

  // כל הרכיבים המוכרים — ממתכונים ומהגדרות ידניות
  const catalog = useMemo(() => {
    const map = new Map<string, { name: string; units: Set<string>; recipes: Set<string> }>();
    const add = (name: string, unit: string, source: string) => {
      const n = name?.trim();
      if (!n) return;
      const key = ingredientKey(n, ingredientMappings);
      let e = map.get(key);
      if (!e) { e = { name: ingredientMappings[key] || n, units: new Set(), recipes: new Set() }; map.set(key, e); }
      if (unit?.trim()) e.units.add(unit.trim());
      e.recipes.add(source);
    };
    for (const r of recipes) for (const g of r.ingredients || []) for (const ing of g.items || []) add(ing.name, ing.unit, r.title);
    for (const s of recipeSettings) {
      for (const ing of s.customIngredients || []) add(ing.name, ing.unit, s.menuItemName);
      for (const ing of s.extras || []) add(ing.name, ing.unit, s.menuItemName);
    }
    return [...map.entries()]
      .map(([key, e]) => ({ key, name: e.name, units: [...e.units], recipes: [...e.recipes].sort((a, b) => a.localeCompare(b, 'he')) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [recipes, recipeSettings, ingredientMappings]);

  const knownNames = useMemo(() => {
    const names = new Set(catalog.map(c => c.name));
    for (const it of allItems) names.add(it.name);
    return [...names].sort((a, b) => a.localeCompare(b, 'he'));
  }, [catalog, allItems]);

  return {
    loading: recipesLoading || ordersLoading,
    items,
    ignoredInList,
    dishes,
    ordersCount: orders.length,
    categories,
    itemCategories,
    ignoredIngredients,
    ingredientMappings,
    recipes,
    recipeLinks,
    recipeSettings,
    allMenuItems,
    knownNames,
    catalog,
  };
}
