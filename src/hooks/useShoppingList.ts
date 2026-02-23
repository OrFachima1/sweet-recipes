import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, query, where, setDoc, onSnapshot } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(true);
  const [recipeSettings, setRecipeSettings] = useState<RecipeSettings[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [manualItems, setManualItems] = useState<ShoppingListItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(
        ordersRef,
        where('eventDate', '>=', selectedPeriod.start),
        where('eventDate', '<=', selectedPeriod.end)
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersData: Order[] = ordersSnap.docs.map(doc => ({
        __id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);

      const menuDoc = await getDoc(doc(db, 'orderSettings', 'menu'));
      const menuList = menuDoc.exists() ? menuDoc.data().items || [] : [];
      setAllMenuItems(menuList);

      const recipeLinksDoc = await getDoc(doc(db, 'orderSettings', 'recipeLinks'));
      const links = recipeLinksDoc.exists() ? recipeLinksDoc.data().links || {} : {};
      setRecipeLinks(links);

      const allRecipesSnap = await getDocs(collection(db, 'recipes'));
      const allRecipesData: Recipe[] = allRecipesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recipe));
      setRecipes(allRecipesData);

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

      const mappingsDoc = await getDoc(doc(db, 'orderSettings', 'ingredientMappings'));
      if (mappingsDoc.exists()) {
        setIngredientMappings(mappingsDoc.data().mappings || {});
      }

      const settingsDoc = await getDoc(doc(db, 'orderSettings', 'shoppingListSettings'));
      if (settingsDoc.exists()) {
        setRecipeSettings(settingsDoc.data().settings || []);
      }

      const categoriesDoc = await getDoc(doc(db, 'orderSettings', 'shoppingCategories'));
      if (categoriesDoc.exists()) {
        setCategories(categoriesDoc.data().categories || DEFAULT_CATEGORIES);
        setItemCategories(categoriesDoc.data().itemCategories || {});
      }

      // manualShoppingItems loaded via real-time listener

      const checkedDoc = await getDoc(doc(db, 'orderSettings', 'checkedShoppingItems'));
      if (checkedDoc.exists()) {
        setCheckedItems(checkedDoc.data().checked || {});
      }

      const deletedDoc = await getDoc(doc(db, 'orderSettings', 'deletedShoppingItems'));
      if (deletedDoc.exists()) {
        setDeletedItems(deletedDoc.data().deleted || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod.start, selectedPeriod.end]);

  // Real-time listener for manual items (including shortages)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'orderSettings', 'manualShoppingItems'),
      (snapshot) => {
        if (snapshot.exists()) {
          setManualItems(snapshot.data().items || []);
        } else {
          setManualItems([]);
        }
      },
      (error) => {
        console.error('Error listening to manual items:', error);
      }
    );

    return () => unsubscribe();
  }, []);

const shoppingList = useMemo(() => {
  const aggregated: Record<string, ShoppingListItem> = {};
  
  // 1️⃣ תחילה - מטפל במתכונים מקושרים
  for (const menuItem of menuItems) {
    if (!menuItem.enabled) continue;
    
    // אם אין recipeId - בדוק אם יש הגדרה ידנית
    if (!menuItem.recipeId) {
      // חפש הגדרה ידנית למנה הזו
      const manualSettings = recipeSettings.find(s => 
        s.menuItemName === menuItem.name && !s.originalRecipeId
      );
      
      if (manualSettings && manualSettings.enabled) {
        // חשב כמה פעמים המנה מופיעה בהזמנות
        let totalQty = 0;
        orders.forEach(order => {
          order.items.forEach(item => {
            if (item.title === menuItem.name) {
              totalQty += item.qty || 1;
            }
          });
        });
        
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
              category: itemCategories[normalizedName] || 'other'
            };
          }
          
          const qtyPerUnit = ingredient.qty / multiplier;
          const totalIngredientQty = qtyPerUnit * totalQty;
          
          aggregated[key].qty += totalIngredientQty;
          if (!aggregated[key].sources.includes(menuItem.name)) {
            aggregated[key].sources.push(menuItem.name);
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
    
    let totalQty = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.title === menuItem.name) {
          totalQty += item.qty || 1;
        }
      });
    });
    
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
            category: itemCategories[normalizedName] || 'other'
          };
        }
        
        const qtyPerUnit = ingredient.qty / multiplier;
        const totalIngredientQty = qtyPerUnit * totalQty;
        
        aggregated[key].qty += totalIngredientQty;
        if (!aggregated[key].sources.includes(menuItem.name)) {
          aggregated[key].sources.push(menuItem.name);
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
              category: itemCategories[normalizedName] || 'other'
            };
          }
          
          const qty = (parseFloat(ingredient.qty) || 0) * totalQty;
          aggregated[key].qty += qty;
          if (!aggregated[key].sources.includes(menuItem.name)) {
            aggregated[key].sources.push(menuItem.name);
          }
        }
      }
    }
  }
  
  const allItems = [...Object.values(aggregated), ...manualItems];
  return allItems
    .filter(item => !deletedItems.includes(normalizeIngredientName(item.name)))
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