import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, query, where, setDoc, onSnapshot } from 'firebase/firestore';

// 🚀 Cache גלובלי למתכונים - נטען פעם אחת בסשן
let recipesCache: Recipe[] | null = null;
let recipesCachePromise: Promise<Recipe[]> | null = null;

async function getRecipesCached(): Promise<Recipe[]> {
  if (recipesCache) {
    return recipesCache;
  }

  if (recipesCachePromise) {
    return recipesCachePromise;
  }

  recipesCachePromise = getDocs(collection(db, 'recipes')).then(snap => {
    const recipes = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Recipe));
    recipesCache = recipes;
    return recipes;
  });

  return recipesCachePromise;
}

// 🚀 פונקציה לניקוי ה-cache - קוראים לה אחרי עריכת מתכון
export function invalidateRecipesCache() {
  recipesCache = null;
  recipesCachePromise = null;
}
import type { Category } from '../components/shopping/CategoryManager';

export interface ShoppingListItem {
  name: string;
  qty: number;
  unit: string;
  sources: string[];
  category: string;
  addedBy?: string; // שם העובד שהוסיף את הפריט
  isShortage?: boolean; // האם זה חוסר (מאחמ"ש) או פריט ידני רגיל
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: IngredientGroup[];
}

export interface IngredientGroup {
  groupName: string;
  items: Ingredient[];
}

export interface Ingredient {
  id: string;
  name: string;
  qty: string;
  unit: string;
}

export interface Order {
  __id: string;
  clientName: string;
  eventDate: string;
  items: OrderItem[];
}

export interface OrderItem {
  title: string;
  qty: number;
  unit?: string;
}

export interface MenuItem {
  name: string;
  recipeId: string | null;
  enabled: boolean;
}

export interface RecipeSettings {
  recipeId: string;
  recipeName: string;
  menuItemName: string;
  multiplier: number;
  enabled: boolean;
  customIngredients: CustomIngredient[];
  originalRecipeId?: string;
}

export interface CustomIngredient {
  name: string;
  qty: number;
  unit: string;
  enabled: boolean;
  originalQty?: number;
}

const normalizeIngredientName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[´"]/g, '"')
    .replace(/[³']/g, "'");
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'other', name: 'כללי', emoji: '📦', color: 'from-gray-100 to-slate-100' },
];

export function useShoppingList(selectedPeriod: { start: string; end: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [ingredientMappings, setIngredientMappings] = useState<Record<string, string>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [manualItemsReady, setManualItemsReady] = useState(false);
  const loading = dataLoading || !manualItemsReady;
  const [recipeSettings, setRecipeSettings] = useState<RecipeSettings[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [manualItems, setManualItems] = useState<ShoppingListItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<string[]>([]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      // Build orders query
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('eventDate', '>=', selectedPeriod.start),
        where('eventDate', '<=', selectedPeriod.end)
      );

      // Fetch all data in parallel for better performance
      // 🚀 משתמש ב-cache למתכונים - לא טוען מחדש בכל כניסה לעמוד
      const [
        ordersSnap,
        menuDoc,
        recipeLinksDoc,
        allRecipesData,
        mappingsDoc,
        settingsDoc,
        categoriesDoc,
        checkedDoc,
        deletedDoc,
      ] = await Promise.all([
        getDocs(ordersQuery),
        getDoc(doc(db, 'orderSettings', 'menu')),
        getDoc(doc(db, 'orderSettings', 'recipeLinks')),
        getRecipesCached(), // 🚀 מה-cache במקום קריאה ישירה
        getDoc(doc(db, 'orderSettings', 'ingredientMappings')),
        getDoc(doc(db, 'orderSettings', 'shoppingListSettings')),
        getDoc(doc(db, 'orderSettings', 'shoppingCategories')),
        getDoc(doc(db, 'orderSettings', 'checkedShoppingItems')),
        getDoc(doc(db, 'orderSettings', 'deletedShoppingItems')),
      ]);

      // Process orders
      const ordersData: Order[] = ordersSnap.docs.map(d => ({
        __id: d.id,
        ...d.data()
      })) as Order[];
      setOrders(ordersData);

      // Process menu
      const menuList = menuDoc.exists() ? menuDoc.data().items || [] : [];
      setAllMenuItems(menuList);

      // Process recipe links
      const links = recipeLinksDoc.exists() ? recipeLinksDoc.data().links || {} : {};
      setRecipeLinks(links);

      // Process recipes - 🚀 כבר מעובד מה-cache
      setRecipes(allRecipesData);

      // Build menu items from orders
      const itemsMap = new Map<string, MenuItem>();
      ordersData.forEach(order => {
        order.items.forEach(item => {
          if (!itemsMap.has(item.title)) {
            itemsMap.set(item.title, {
              name: item.title,
              recipeId: links[item.title] || null,
              enabled: true
            });
          }
        });
      });
      setMenuItems(Array.from(itemsMap.values()));

      // Process mappings
      if (mappingsDoc.exists()) {
        setIngredientMappings(mappingsDoc.data().mappings || {});
      }

      // Process settings
      if (settingsDoc.exists()) {
        setRecipeSettings(settingsDoc.data().settings || []);
      }

      // Process categories
      if (categoriesDoc.exists()) {
        setCategories(categoriesDoc.data().categories || DEFAULT_CATEGORIES);
        setItemCategories(categoriesDoc.data().itemCategories || {});
      }

      // manualShoppingItems loaded via real-time listener

      // Process checked items
      if (checkedDoc.exists()) {
        setCheckedItems(checkedDoc.data().checked || {});
      }

      // Process deleted items
      if (deletedDoc.exists()) {
        setDeletedItems(deletedDoc.data().deleted || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod.start, selectedPeriod.end]);

  // Real-time listener for manual items — marks ready after first snapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'orderSettings', 'manualShoppingItems'),
      (snapshot) => {
        setManualItems(snapshot.exists() ? snapshot.data().items || [] : []);
        setManualItemsReady(true);
      },
      (error) => {
        console.error('Error listening to manual items:', error);
        setManualItemsReady(true); // unblock loading even on error
      }
    );

    return () => unsubscribe();
  }, []);

const shoppingList = useMemo(() => {
  // 🚀 אופטימיזציה: חישוב מפת כמויות מראש - O(N*K) במקום O(M*N*K)
  const menuItemQtyMap = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      menuItemQtyMap.set(item.title, (menuItemQtyMap.get(item.title) || 0) + (item.qty || 1));
    }
  }

  // 🚀 אופטימיזציה: המרת deletedItems ל-Set - O(1) במקום O(n)
  const deletedSet = new Set(deletedItems.map(normalizeIngredientName));

  // 🚀 אופטימיזציה: שימוש ב-Set לבדיקת sources - O(1) במקום O(n)
  const aggregated: Record<string, ShoppingListItem & { _sourceSet: Set<string> }> = {};

  // 1️⃣ תחילה - מטפל במתכונים מקושרים
  for (const menuItem of menuItems) {
    if (!menuItem.enabled) continue;

    // 🚀 שימוש במפה המחושבת מראש
    const totalQty = menuItemQtyMap.get(menuItem.name) || 0;
    if (totalQty === 0) continue;

    // אם אין recipeId - בדוק אם יש הגדרה ידנית
    if (!menuItem.recipeId) {
      // חפש הגדרה ידנית למנה הזו
      const manualSettings = recipeSettings.find(s =>
        s.menuItemName === menuItem.name && !s.originalRecipeId
      );

      if (manualSettings && manualSettings.enabled) {
        const multiplier = manualSettings.multiplier || 1;

        // הוסף את הרכיבים הידניים
        for (const ingredient of manualSettings.customIngredients) {
          if (!ingredient.enabled) continue;

          const normalizedName = normalizeIngredientName(ingredient.name);
          const mappedName = ingredientMappings[normalizedName] || ingredient.name;
          const key = ingredientMappings[normalizedName]
            ? normalizeIngredientName(ingredientMappings[normalizedName])
            : normalizedName;

          if (!aggregated[key]) {
            aggregated[key] = {
              name: mappedName,
              qty: 0,
              unit: ingredient.unit,
              sources: [],
              category: itemCategories[normalizedName] || 'other',
              _sourceSet: new Set()
            };
          }

          const qtyPerUnit = ingredient.qty / multiplier;
          const totalIngredientQty = qtyPerUnit * totalQty;

          aggregated[key].qty += totalIngredientQty;
          // 🚀 O(1) lookup במקום O(n)
          if (!aggregated[key]._sourceSet.has(menuItem.name)) {
            aggregated[key].sources.push(menuItem.name);
            aggregated[key]._sourceSet.add(menuItem.name);
          }
        }
      }
      continue; // עבור למנה הבאה
    }

    // 2️⃣ מתכונים רגילים עם recipeId (הקוד המקורי שלך)
    const settings = recipeSettings.find(s =>
      (s.originalRecipeId || s.recipeId) === menuItem.recipeId &&
      s.menuItemName === menuItem.name
    );
    if (settings && !settings.enabled) continue;

    const recipe = recipes.find(r => r.id === menuItem.recipeId);
    if (!recipe) continue;

    const multiplier = settings?.multiplier || 1;

    if (settings && settings.customIngredients.length > 0) {
      for (const ingredient of settings.customIngredients) {
        if (!ingredient.enabled) continue;

        const normalizedName = normalizeIngredientName(ingredient.name);
        const mappedName = ingredientMappings[normalizedName] || ingredient.name;
        const key = ingredientMappings[normalizedName]
          ? normalizeIngredientName(ingredientMappings[normalizedName])
          : normalizedName;

        if (!aggregated[key]) {
          aggregated[key] = {
            name: mappedName,
            qty: 0,
            unit: ingredient.unit,
            sources: [],
            category: itemCategories[normalizedName] || 'other',
            _sourceSet: new Set()
          };
        }

        const qtyPerUnit = ingredient.qty / multiplier;
        const totalIngredientQty = qtyPerUnit * totalQty;

        aggregated[key].qty += totalIngredientQty;
        // 🚀 O(1) lookup במקום O(n)
        if (!aggregated[key]._sourceSet.has(menuItem.name)) {
          aggregated[key].sources.push(menuItem.name);
          aggregated[key]._sourceSet.add(menuItem.name);
        }
      }
    } else {
      for (const group of recipe.ingredients || []) {
        for (const ingredient of group.items || []) {
          const normalizedName = normalizeIngredientName(ingredient.name);
          const mappedName = ingredientMappings[normalizedName] || ingredient.name;
          const key = ingredientMappings[normalizedName]
            ? normalizeIngredientName(ingredientMappings[normalizedName])
            : normalizedName;

          if (!aggregated[key]) {
            aggregated[key] = {
              name: mappedName,
              qty: 0,
              unit: ingredient.unit,
              sources: [],
              category: itemCategories[normalizedName] || 'other',
              _sourceSet: new Set()
            };
          }

          const qty = (parseFloat(ingredient.qty) || 0) * totalQty;
          aggregated[key].qty += qty;
          // 🚀 O(1) lookup במקום O(n)
          if (!aggregated[key]._sourceSet.has(menuItem.name)) {
            aggregated[key].sources.push(menuItem.name);
            aggregated[key]._sourceSet.add(menuItem.name);
          }
        }
      }
    }
  }

  // 🚀 הסרת ה-_sourceSet הפנימי לפני החזרת התוצאה
  const cleanedAggregated: ShoppingListItem[] = Object.values(aggregated).map(({ _sourceSet, ...item }) => item);

  const allItems = [...cleanedAggregated, ...manualItems];
  return allItems
    // 🚀 O(1) lookup במקום O(n)
    .filter(item => !deletedSet.has(normalizeIngredientName(item.name)))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));
}, [menuItems, recipes, orders, ingredientMappings, recipeSettings, itemCategories, manualItems, deletedItems]);

  return {
    loading,
    shoppingList,
    categories,
    setCategories,
    itemCategories,
    setItemCategories,
    checkedItems,
    setCheckedItems,
    manualItems,
    setManualItems,
    deletedItems,
    setDeletedItems,
    recipeSettings,
    setRecipeSettings,
    allMenuItems,
    recipes,
    recipeLinks,
  };
}