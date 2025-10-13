"use client";

interface ShoppingListItem {
  name: string;
  qty: number;
  unit: string;
  sources: string[];
  category: string;
}

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, getDoc, query, where, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import ShoppingListSettings from './ShoppingListSettings';
import CategoryManager from './CategoryManager';
import ShoppingItem from './ShoppingItem';
import type { Category } from './CategoryManager';

interface Recipe {
  id: string;
  title: string;
  ingredients: IngredientGroup[];
}

interface IngredientGroup {
  groupName: string;
  items: Ingredient[];
}

interface Ingredient {
  id: string;
  name: string;
  qty: string;
  unit: string;
}

interface Order {
  __id: string;
  clientName: string;
  eventDate: string;
  items: OrderItem[];
}

interface OrderItem {
  title: string;
  qty: number;
  unit?: string;
}

interface MenuItem {
  name: string;
  recipeId: string | null;
  enabled: boolean;
}

interface RecipeSettings {
  recipeId: string;
  recipeName: string;
  menuItemName: string;
  multiplier: number;
  enabled: boolean;
  customIngredients: CustomIngredient[];
  originalRecipeId?: string;
}

interface CustomIngredient {
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

export default function ShoppingListPage() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<{start: string, end: string}>({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ingredientMappings, setIngredientMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [recipeSettings, setRecipeSettings] = useState<RecipeSettings[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [itemCategories, setItemCategories] = useState<Record<string, string>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [manualItems, setManualItems] = useState<ShoppingListItem[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const allCats = [{ id: 'all', name: 'הכל', emoji: '🛒', color: '' }, ...categories];
    const currentIndex = allCats.findIndex(c => c.id === selectedCategory);
    
    if (isLeftSwipe && currentIndex < allCats.length - 1) {
      setSelectedCategory(allCats[currentIndex + 1].id);
    }
    if (isRightSwipe && currentIndex > 0) {
      setSelectedCategory(allCats[currentIndex - 1].id);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

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

      const manualDoc = await getDoc(doc(db, 'orderSettings', 'manualShoppingItems'));
      if (manualDoc.exists()) {
        setManualItems(manualDoc.data().items || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (settings: RecipeSettings[]) => {
    try {
      const cleanedSettings = settings.map(s => {
        const cleaned: any = {
          recipeId: s.recipeId,
          recipeName: s.recipeName,
          menuItemName: s.menuItemName,
          multiplier: s.multiplier,
          enabled: s.enabled,
          customIngredients: s.customIngredients.map(ing => ({
            name: ing.name,
            qty: ing.qty,
            unit: ing.unit,
            enabled: ing.enabled,
            ...(ing.originalQty !== undefined && { originalQty: ing.originalQty })
          }))
        };
        
        if (s.originalRecipeId) {
          cleaned.originalRecipeId = s.originalRecipeId;
        }
        
        return cleaned;
      });
      
      await setDoc(doc(db, 'orderSettings', 'shoppingListSettings'), {
        settings: cleanedSettings,
        updatedAt: new Date().toISOString()
      });
      setRecipeSettings(settings);
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות:', error);
      alert('שגיאה בשמירת ההגדרות. בדוק את הקונסול לפרטים.');
    }
  };

  const saveManualItems = async (items: ShoppingListItem[]) => {
    try {
      await setDoc(doc(db, 'orderSettings', 'manualShoppingItems'), {
        items,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('שגיאה בשמירת פריטים:', error);
    }
  };

  const shoppingList = useMemo(() => {
    const aggregated: Record<string, ShoppingListItem> = {};
    
    for (const menuItem of menuItems) {
      if (!menuItem.enabled || !menuItem.recipeId) continue;

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
    return allItems.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [menuItems, recipes, orders, ingredientMappings, recipeSettings, itemCategories, manualItems]);

  const groupedList = useMemo(() => {
    const grouped: Record<string, ShoppingListItem[]> = {};
    categories.forEach(cat => {
      grouped[cat.id] = [];
    });
    
    shoppingList.forEach(item => {
      const catId = item.category || 'other';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(item);
    });
    
    return grouped;
  }, [shoppingList, categories]);

  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: shoppingList.length };
    categories.forEach(cat => {
      counts[cat.id] = groupedList[cat.id]?.length || 0;
    });
    return counts;
  }, [shoppingList, categories, groupedList]);

  const displayedItems = selectedCategory === 'all' 
    ? shoppingList 
    : groupedList[selectedCategory] || [];

  const addManualItem = () => {
    if (!newItemName.trim()) return;
    
    const newItem: ShoppingListItem = {
      name: newItemName,
      qty: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
      sources: ['הוספה ידנית'],
      category: selectedCategory === 'all' ? 'other' : selectedCategory
    };
    
    const updated = [...manualItems, newItem];
    setManualItems(updated);
    saveManualItems(updated);
    
    setNewItemName('');
    setNewItemQty('');
    setNewItemUnit('');
    setShowAddItem(false);
  };

  const removeManualItem = (itemName: string) => {
    const updated = manualItems.filter(i => i.name !== itemName);
    setManualItems(updated);
    saveManualItems(updated);
  };

  const moveItemToCategory = async (itemName: string, newCategoryId: string) => {
    const normalized = normalizeIngredientName(itemName);
    const updatedItemCategories = {
      ...itemCategories,
      [normalized]: newCategoryId
    };
    
    setItemCategories(updatedItemCategories);
    
    try {
      await setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
        categories,
        itemCategories: updatedItemCategories,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('שגיאה בשמירת קטגוריה:', error);
    }
  };

  const updateCategoryName = (catId: string, newName: string) => {
    const updated = categories.map(c => 
      c.id === catId ? { ...c, name: newName } : c
    );
    setCategories(updated);
    
    setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
      categories: updated,
      itemCategories,
      updatedAt: new Date().toISOString()
    });
  };

  const deleteCategory = (catId: string) => {
    if (catId === 'other') {
      alert('לא נית למחוק את הקטגוריה "כללי"');
      return;
    }
    
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    
    const updatedItemCategories = { ...itemCategories };
    Object.keys(updatedItemCategories).forEach(key => {
      if (updatedItemCategories[key] === catId) {
        updatedItemCategories[key] = 'other';
      }
    });
    setItemCategories(updatedItemCategories);
    
    setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
      categories: updated,
      itemCategories: updatedItemCategories,
      updatedAt: new Date().toISOString()
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-2xl font-bold">טוען...</div>
        </div>
      </div>
    );
  }

  const totalItems = displayedItems.length;
  const checkedCount = displayedItems.filter(i => checkedItems[i.name]).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" dir="rtl">
      
      {/* כותרת קבועה */}
      <div className="sticky top-0 z-50 bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/')}
              className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
            >
              ←
            </button>
            
            <div className="text-center flex-1">
              <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                🛒 רשימת קניות
              </h1>
              {totalItems > 0 && (
                <div className="mt-2 text-white/90 font-bold text-xl">
                  {checkedCount} מתוך {totalItems}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
                >
                  📅
                </button>

                {showDatePicker && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDatePicker(false)}
                    />
                    <div 
                      className="absolute left-0 top-14 bg-white rounded-3xl shadow-2xl p-5 z-50 min-w-[280px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-lg font-bold text-gray-800 mb-3">בחר תקופה</div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">מתאריך:</label>
                          <input
                            type="date"
                            value={selectedPeriod.start}
                            onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-600 mb-1">עד תאריך:</label>
                          <input
                            type="date"
                            value={selectedPeriod.end}
                            onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setSettingsOpen(true)}
                className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* פס התקדמות */}
          {totalItems > 0 && (
            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-green-400 to-emerald-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <CategoryManager
          categories={[{ id: 'all', name: 'הכל', emoji: '🛒', color: '' }, ...categories]}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddCategory={(cat) => {
            const updated = [...categories, cat];
            setCategories(updated);
            setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
              categories: updated,
              itemCategories,
              updatedAt: new Date().toISOString()
            });
          }}
          onUpdateCategory={(id, name) => updateCategoryName(id, name)}
          onDeleteCategory={deleteCategory}
          itemCounts={itemCounts}
        />
      </div>

      {/* תוכן */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div 
          className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {displayedItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6">🛒</div>
              <div className="text-3xl text-gray-400 font-bold">
                אין פריטים ברשימה
              </div>
              <div className="text-gray-400 mt-2">
                הוסף פריטים או שנה את הגדרות התקופה
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {displayedItems.map((item, idx) => (
                <ShoppingItem
                  key={idx}
                  name={item.name}
                  qty={item.qty}
                  unit={item.unit}
                  isManual={item.sources[0] === 'הוספה ידנית'}
                  isChecked={checkedItems[item.name] || false}
                  categories={categories}
                  onToggleCheck={() => setCheckedItems(prev => ({
                    ...prev,
                    [item.name]: !prev[item.name]
                  }))}
                  onChangeCategory={(catId) => moveItemToCategory(item.name, catId)}
                  onDelete={item.sources[0] === 'הוספה ידנית' ? () => removeManualItem(item.name) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* כפתור הוספה */}
      <button
        onClick={() => setShowAddItem(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shadow-2xl flex items-center justify-center text-4xl text-white hover:scale-110 transition-all active:scale-95 z-40"
      >
        +
      </button>

      {/* מודל הוספה */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddItem(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-3xl font-bold mb-6 text-gray-800">הוסף פריט</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="שם המוצר"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="כמות"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  className="px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg"
                />
                <input
                  type="text"
                  placeholder="יחידה"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  className="px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={addManualItem}
                  className="flex-1 px-6 py-4 rounded-2xl bg-gradient-to-l from-purple-500 to-pink-500 text-white font-bold text-lg hover:shadow-xl transition-all active:scale-95"
                >
                  הוסף
                </button>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="px-6 py-4 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg transition-all active:scale-95"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShoppingListSettings
        show={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        menuItems={allMenuItems}
        recipes={recipes}
        recipeLinks={recipeLinks}
        onSave={handleSaveSettings}
        initialSettings={recipeSettings}
      />
    </div>
  );
}