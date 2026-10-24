// src/hooks/useShoppingData.ts
// הנתונים שרשימת קניות נבנית מהם: מתכונים, קישורי מנות, מיפויים, הגדרות מתכונים, קטגוריות,
// וההזמנות בטווח של הרשימה — בהאזנה חיה, כדי שהרשימה תתעדכן כשנכנסת הזמנה.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { addDays, fmtYMD } from '@/utils/orders';
import { getRecipesCached, type Recipe, type RecipeSettings } from '@/hooks/useShoppingList';
import type { Category } from '@/components/shopping/CategoryManager';
import { computeShoppingItems, normalizeIngredientName, type ComputedItem, type OrderLike } from '@/lib/shopping/compute';

const DEFAULT_CATEGORIES: Category[] = [{ id: 'other', name: 'כללי', emoji: '📦', color: '' }];

const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export interface ShoppingData {
  loading: boolean;
  items: ComputedItem[];
  ordersCount: number;
  categories: Category[];
  itemCategories: Record<string, string>;
  ingredientMappings: Record<string, string>;
  recipes: Recipe[];
  recipeLinks: Record<string, string>;
  recipeSettings: RecipeSettings[];
  setRecipeSettings: (s: RecipeSettings[]) => void;
  allMenuItems: string[];
  knownNames: string[];
}

export function useShoppingData(range: { start: string; end: string } | null, enabled = true): ShoppingData {
  const [staticLoading, setStaticLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [ingredientMappings, setIngredientMappings] = useState<Record<string, string>>({});
  const [recipeSettings, setRecipeSettings] = useState<RecipeSettings[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // נתונים שכמעט לא משתנים — פעם אחת
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const [recipesData, linksDoc, mappingsDoc, settingsDoc, menuDoc] = await Promise.all([
          getRecipesCached(),
          getDoc(doc(db, 'orderSettings', 'recipeLinks')),
          getDoc(doc(db, 'orderSettings', 'ingredientMappings')),
          getDoc(doc(db, 'orderSettings', 'shoppingListSettings')),
          getDoc(doc(db, 'orderSettings', 'menu')),
        ]);
        if (cancelled) return;
        setRecipes(recipesData);
        setRecipeLinks(linksDoc.exists() ? linksDoc.data().links || {} : {});
        setIngredientMappings(mappingsDoc.exists() ? mappingsDoc.data().mappings || {} : {});
        setRecipeSettings(settingsDoc.exists() ? settingsDoc.data().settings || [] : []);
        setAllMenuItems(menuDoc.exists() ? menuDoc.data().items || [] : []);
      } catch (e) {
        console.error('Failed loading shopping data', e);
      } finally {
        if (!cancelled) setStaticLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // קטגוריות ושיוך מצרכים לקטגוריות — חי, כי משתנה תוך כדי עבודה
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      doc(db, 'orderSettings', 'shoppingCategories'),
      (snap) => {
        const data = snap.data();
        setCategories(data?.categories?.length ? data.categories : DEFAULT_CATEGORIES);
        setItemCategories(data?.itemCategories || {});
      },
      (e) => console.error('Failed loading shopping categories', e)
    );
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

  const items = useMemo(
    () => computeShoppingItems(orders, { recipes, recipeLinks, recipeSettings, ingredientMappings }),
    [orders, recipes, recipeLinks, recipeSettings, ingredientMappings]
  );

  // שמות מצרכים מוכרים — להצעות בזמן הקלדה
  const knownNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of recipes) {
      for (const g of r.ingredients || []) {
        for (const ing of g.items || []) {
          const n = ing.name?.trim();
          if (n) names.set(normalizeIngredientName(n), n);
        }
      }
    }
    for (const it of items) names.set(it.key, it.name);
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'he'));
  }, [recipes, items]);

  return {
    loading: staticLoading || ordersLoading,
    items,
    ordersCount: orders.length,
    categories,
    itemCategories,
    ingredientMappings,
    recipes,
    recipeLinks,
    recipeSettings,
    setRecipeSettings,
    allMenuItems,
    knownNames,
  };
}
