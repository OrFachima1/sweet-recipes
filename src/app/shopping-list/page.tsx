"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import ShoppingListSettings from '@/components/shopping/ShoppingListSettings';
import CategoryManager, { type Category } from '@/components/shopping/CategoryManager';
import ShoppingItem from '@/components/shopping/ShoppingItem';
import ShoppingHeader from '@/components/shopping/ShoppingHeader';
import { ShoppingToolbar } from '@/components/shopping/ShoppingToolbar';
import { AddItemModal } from '@/components/shopping/AddItemModal';
import { useShoppingList, ShoppingListItem } from '@/hooks/useShoppingList';
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from '@/contexts/AuthContext';

// Debounce hook for search optimization
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const normalizeIngredientName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[´"]/g, '"')
    .replace(/[³']/g, "'");
};

export default function ShoppingListPage() {
  const router = useRouter();
  const { user, role, displayName } = useAuth();
  const isManager = role === 'manager';
  const isSeniorWorker = role === 'senior_worker';
  const userName = displayName || user?.email?.split('@')[0] || 'משתמש';

  const [selectedPeriod, setSelectedPeriod] = useState<{start: string, end: string}>({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  
  const {
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
  } = useShoppingList(selectedPeriod);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [sortBy, setSortBy] = useState<'name' | 'checked'>('name');

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

  const saveCheckedItems = async (checked: Record<string, boolean>) => {
    try {
      await setDoc(doc(db, 'orderSettings', 'checkedShoppingItems'), {
        checked,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('שגיאה בשמירת סימונים:', error);
    }
  };

  const saveDeletedItems = async (deleted: string[]) => {
    try {
      await setDoc(doc(db, 'orderSettings', 'deletedShoppingItems'), {
        deleted,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('שגיאה בשמירת מחיקות:', error);
    }
  };

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

    // סינון חוסרים אמיתיים (עם isShortage: true)
    const shortageItems = useMemo(() =>
      manualItems.filter(item => item.isShortage === true),
      [manualItems]
    );

    const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: shoppingList.length };
    categories.forEach(cat => {
        // רק אם זה לא 'all'
        if (cat.id !== 'all') {
        counts[cat.id] = groupedList[cat.id]?.length || 0;
        }
    });
    // הוספת ספירה לקטגוריית חוסרים (רק למנהל) - רק פריטים שסומנו כחוסרים
    if (isManager) {
      counts['__shortages__'] = shortageItems.length;
    }
    return counts;
    }, [shoppingList, categories, groupedList, isManager, shortageItems.length]);

  const totalItemsCount = shoppingList.length;


  // 🚀 אופטימיזציה: הפרדת הסינון מהמיון לפי checkedItems
  // כך סימון פריט לא גורר חישוב מחדש של הסינון
  const filteredItems = useMemo(() => {
    // קטגוריית חוסרים - מחזירה רק פריטים שסומנו כחוסרים (isShortage: true)
    if (selectedCategory === '__shortages__') {
      let items = [...shortageItems];
      if (debouncedSearchTerm.trim()) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        items = items.filter(item =>
          item.name.toLowerCase().includes(searchLower)
        );
      }
      return items;
    }

    let items = selectedCategory === 'all'
      ? shoppingList
      : groupedList[selectedCategory] || [];

    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchLower)
      );
    }

    return items;
  }, [selectedCategory, shoppingList, groupedList, debouncedSearchTerm, shortageItems]);

  // 🚀 מיון נפרד - רק כשמשתנה sortBy או checkedItems
  const filteredAndSortedItems = useMemo(() => {
    if (sortBy !== 'checked') return filteredItems;

    return [...filteredItems].sort((a, b) => {
      const aChecked = checkedItems[a.name] || false;
      const bChecked = checkedItems[b.name] || false;
      if (aChecked === bChecked) return 0;
      return aChecked ? 1 : -1;
    });
  }, [filteredItems, sortBy, checkedItems]);

  const addManualItem = async (name: string, qty: string, unit: string) => {
    // קביעת קטגוריה - אם נמצאים בחוסרים או הכל, לשמור כ-other
    const categoryId = selectedCategory === 'all' || selectedCategory === '__shortages__' ? 'other' : selectedCategory;

    // אחמ"ש תמיד מוסיף חוסרים, מנהל מוסיף רק אם נמצא בקטגוריית חוסרים
    const isShortageItem = isSeniorWorker || selectedCategory === '__shortages__';

    const newItem: ShoppingListItem = {
      name,
      qty: parseFloat(qty) || 1,
      unit,
      sources: [`הוסף ע"י ${userName}`],
      category: categoryId,
      addedBy: userName,
      isShortage: isShortageItem
    };

    const updated = [...manualItems, newItem];
    setManualItems(updated);
    await saveManualItems(updated);

    // שמירת הקטגוריה גם ב-itemCategories mapping (רק אם לא חוסר)
    if (!isShortageItem) {
      const normalized = normalizeIngredientName(name);
      const updatedItemCategories = {
        ...itemCategories,
        [normalized]: categoryId
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
    }
  };

  const removeManualItem = (itemName: string) => {
    const updated = manualItems.filter(i => i.name !== itemName);
    setManualItems(updated);
    saveManualItems(updated);
  };

  const moveItemToCategory = async (itemName: string, newCategoryId: string) => {
    const normalized = normalizeIngredientName(itemName);

    // עדכון ב-itemCategories mapping
    const updatedItemCategories = {
      ...itemCategories,
      [normalized]: newCategoryId
    };
    setItemCategories(updatedItemCategories);

    // עדכון גם בפריטים הידניים אם הפריט שם
    const manualItemIndex = manualItems.findIndex(i => i.name === itemName);
    if (manualItemIndex !== -1) {
      const updatedManual = manualItems.map(item =>
        item.name === itemName
          ? { ...item, category: newCategoryId, isShortage: false } // הסרת סימון חוסר בהעברה לקטגוריה
          : item
      );
      setManualItems(updatedManual);
      await saveManualItems(updatedManual);
    }

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

  const updateCategoryName = async (catId: string, newName: string, newEmoji?: string) => {
    const updated = categories.map(c =>
        c.id === catId
        ? {
            ...c,
            name: newName,
            emoji: newEmoji || c.emoji  // שמור את האימוג'י החדש או הישן
            }
        : c
    );

    setCategories(updated);

    await setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
        categories: updated,
        itemCategories,
        updatedAt: new Date().toISOString()
    });
    };

  const deleteCategory = async (catId: string) => {
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);

    const updatedItemCategories = { ...itemCategories };
    Object.keys(updatedItemCategories).forEach(key => {
      if (updatedItemCategories[key] === catId) {
        updatedItemCategories[key] = 'other';
      }
    });
    setItemCategories(updatedItemCategories);

    await setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
      categories: updated,
      itemCategories: updatedItemCategories,
      updatedAt: new Date().toISOString()
    });
  };

  const clearCheckedItems = async () => {
  if (confirm('למחוק את כל הפריטים המסומנים מהרשימה?')) {
    // מצא את כל שמות הפריטים המסומנים
    const checkedNames = Object.keys(checkedItems).filter(name => checkedItems[name]);
    
    // הוסף את כל הפריטים המסומנים לרשימת המחיקות
    const normalizedCheckedNames = checkedNames.map(name => normalizeIngredientName(name));
    const updatedDeleted = [...new Set([...deletedItems, ...normalizedCheckedNames])];
    
    // מחק גם פריטים ידניים שסומנו
    const updatedManual = manualItems.filter(item => !checkedNames.includes(item.name));
    
    // עדכן את ה-state ושמור
    setDeletedItems(updatedDeleted);
    setManualItems(updatedManual);
    setCheckedItems({});
    
    await saveDeletedItems(updatedDeleted);
    await saveManualItems(updatedManual);
    await saveCheckedItems({});
  }
};

  const deleteItem = (itemName: string) => {
    const normalized = normalizeIngredientName(itemName);
    const updated = [...deletedItems, normalized];
    setDeletedItems(updated);
    saveDeletedItems(updated);
  };

  const resetAll = async () => {
    if (confirm('לאפס את כל הרשימה? (סימונים ומחיקות יוסרו)')) {
      setCheckedItems({});
      setDeletedItems([]);
      await saveCheckedItems({});
      await saveDeletedItems([]);
    }
  };

  const handleSaveSettings = async (settings: any[]) => {
  try {
    // קודם שומרים ל-Firebase
    await setDoc(doc(db, 'orderSettings', 'shoppingListSettings'), {
      settings,
      updatedAt: new Date().toISOString()
    });
    
    // רק אחרי שהשמירה הצליחה - מעדכנים את ה-state
    setRecipeSettings(settings);
    
    console.log('✅ הגדרות נשמרו בהצלחה');
  } catch (error) {
    console.error('❌ שגיאה בשמירת הגדרות:', error);
    // זורק את השגיאה הלאה כדי ש-handleSave ב-ShoppingListSettings יטפל בה
    throw error;
  }
};

  const handleReorderCategories = async (reorderedCategories: Category[]) => {
  // Safety guard: never overwrite with fewer categories than currently exist
  const realCategories = reorderedCategories.filter(c => c.id !== 'all' && c.id !== '__shortages__');
  if (realCategories.length < categories.length) {
    console.warn('[handleReorderCategories] blocked: would reduce categories', categories.length, '->', realCategories.length);
    return;
  }

  setCategories(realCategories);

  try {
    // Use updateDoc — reorder only touches `categories`, never overwrites `itemCategories`
    await updateDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
      categories: realCategories,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בשמירת סדר קטגוריות:', error);
  }
};

  // קטגוריות עם "חוסרים" בהתחלה (רק למנהל) - חייב להיות לפני כל return!
  const categoriesWithShortages = useMemo(() => {
    if (!isManager) return categories;
    const shortagesCategory: Category = {
      id: '__shortages__',
      name: 'חוסרים',
      emoji: '📦',
      color: '#f59e0b'
    };
    return [shortagesCategory, ...categories];
  }, [categories, isManager]);

  // חישוב סטטיסטיקות - חייב להיות לפני כל return!
  const totalItems = filteredAndSortedItems.length;
  const checkedCount = filteredAndSortedItems.filter(i => checkedItems[i.name]).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  if (loading) return <LoadingScreen />;

  // אחמ"ש רואה רק מסך חוסרים פשוט
  if (isSeniorWorker) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" dir="rtl">
        {/* Header פשוט לאחמ"ש */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
            >
              <span className="text-xl">➡️</span>
            </button>
            <div className="text-center">
              <h1 className="text-2xl font-bold">רשימת חוסרים</h1>
              <p className="text-sm opacity-90">{shortageItems.length} פריטים</p>
            </div>
            <div className="w-10"></div>
          </div>
        </div>

        {/* רשימת החוסרים */}
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {shortageItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-7xl mb-4">📦</div>
                <div className="text-2xl text-gray-400 font-bold">אין חוסרים ברשימה</div>
                <div className="text-gray-400 mt-2 text-sm">לחץ על + כדי להוסיף פריט</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {shortageItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        {item.qty} {item.unit}
                        {item.addedBy && (
                          <span className="mr-2 text-amber-600">• {item.addedBy}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeManualItem(item.name)}
                      className="w-10 h-10 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all"
                      title="מחק פריט"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* כפתור הוספה */}
        <button
          onClick={() => setShowAddItem(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 shadow-2xl flex items-center justify-center text-4xl text-white hover:scale-110 transition-all active:scale-95 z-40"
          title="הוסף פריט לחוסרים"
        >
          +
        </button>

        <AddItemModal
          show={showAddItem}
          onClose={() => setShowAddItem(false)}
          onAdd={addManualItem}
        />
      </div>
    );
  }

  // מנהל רואה את המסך המלא
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-100 to-orange-100" dir="rtl">
      <ShoppingHeader
        router={router}
        totalItems={totalItems}
        checkedCount={checkedCount}
        progress={progress}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        resetAll={resetAll}
        setSettingsOpen={setSettingsOpen}
      />

      <div className="sticky top-0 z-40 bg-gradient-to-r from-rose-400 to-pink-400 shadow-md">
        <CategoryManager
          categories={categoriesWithShortages}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onAddCategory={async (cat) => {
            const updated = [...categories, cat];
            setCategories(updated);
            await setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
              categories: updated,
              itemCategories,
              updatedAt: new Date().toISOString()
            });
          }}
          onUpdateCategory={(catId, name, emoji) => {
            // לא לאפשר עריכה של קטגוריית חוסרים
            if (catId === '__shortages__') return;
            updateCategoryName(catId, name, emoji);
          }}
          onDeleteCategory={(catId) => {
            // לא לאפשר מחיקה של קטגוריית חוסרים
            if (catId === '__shortages__') return;
            deleteCategory(catId);
          }}
          onReorderCategories={handleReorderCategories}
          itemCounts={itemCounts}
          totalItems={totalItemsCount}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4">
        <ShoppingToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortBy={sortBy}
          setSortBy={setSortBy}
          checkedCount={checkedCount}
          clearCheckedItems={clearCheckedItems}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="bg-white rounded-2xl shadow-xl overflow-visible">
          {filteredAndSortedItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-7xl mb-4">
                {searchTerm ? '🔍' : selectedCategory === '__shortages__' ? '📦' : '🛒'}
              </div>
              <div className="text-2xl text-gray-400 font-bold">
                {searchTerm ? 'לא נמצאו תוצאות' : selectedCategory === '__shortages__' ? 'אין חוסרים ברשימה' : 'אין פריטים ברשימה'}
              </div>
              <div className="text-gray-400 mt-2 text-sm">
                {searchTerm ? 'נסה חיפוש אחר' : selectedCategory === '__shortages__' ? 'לחץ על + כדי להוסיף חוסר' : 'הוסף פריטים או שנה הגדרות'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredAndSortedItems.map((item, idx) => (
                <ShoppingItem
                  currentCategory={item.category}
                  selectedCategory={selectedCategory}
                  key={idx}
                  name={item.name}
                  qty={item.qty}
                  unit={item.unit}
                  isManual={item.sources[0] === 'הוספה ידנית'}
                  isChecked={checkedItems[item.name] || false}
                  categories={categories}
                  sources={item.sources}
                  onToggleCheck={() => {
                    const updated = {
                      ...checkedItems,
                      [item.name]: !checkedItems[item.name]
                    };
                    setCheckedItems(updated);
                    saveCheckedItems(updated);
                  }}
                  onChangeCategory={(catId) => moveItemToCategory(item.name, catId)}
                  onDelete={item.sources[0] === 'הוספה ידנית' ? () => removeManualItem(item.name) : () => deleteItem(item.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowAddItem(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 shadow-2xl flex items-center justify-center text-4xl text-white hover:scale-110 transition-all active:scale-95 z-40"
        title="הוסף פריט ידני לרשימה"
      >
        +
      </button>

      <AddItemModal
        show={showAddItem}
        onClose={() => setShowAddItem(false)}
        onAdd={addManualItem}
      />

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