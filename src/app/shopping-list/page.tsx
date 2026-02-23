"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import ShoppingListSettings from '@/components/shopping/ShoppingListSettings';
import CategoryManager, { type Category } from '@/components/shopping/CategoryManager';
import ShoppingItem from '@/components/shopping/ShoppingItem';
import ShoppingHeader from '@/components/shopping/ShoppingHeader';
import { ShoppingToolbar } from '@/components/shopping/ShoppingToolbar';
import { AddItemModal } from '@/components/shopping/AddItemModal';
import { useShoppingList, ShoppingListItem } from '@/hooks/useShoppingList';
import LoadingScreen from "@/components/LoadingScreen";
import { useUser, useRole } from '@/lib/auth';

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
  const { user } = useUser();
  const { role } = useRole(user?.uid);
  const isManager = role === 'manager';
  const isSeniorWorker = role === 'senior_worker';

  // אחמ"ש רואה רק את מצב החוסרים
  const [viewMode, setViewMode] = useState<'shopping' | 'shortages'>('shopping');

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

    const itemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: shoppingList.length };
    categories.forEach(cat => {
        // רק אם זה לא 'all'
        if (cat.id !== 'all') {
        counts[cat.id] = groupedList[cat.id]?.length || 0;
        }
    });
    return counts;
    }, [shoppingList, categories, groupedList]);

  const totalItemsCount = shoppingList.length;


  const filteredAndSortedItems = useMemo(() => {
    let items = selectedCategory === 'all' 
      ? shoppingList 
      : groupedList[selectedCategory] || [];

    if (searchTerm.trim()) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy === 'checked') {
      items = [...items].sort((a, b) => {
        const aChecked = checkedItems[a.name] || false;
        const bChecked = checkedItems[b.name] || false;
        if (aChecked === bChecked) return 0;
        return aChecked ? 1 : -1;
      });
    }

    return items;
  }, [selectedCategory, shoppingList, groupedList, searchTerm, sortBy, checkedItems]);

  const addManualItem = async (name: string, qty: string, unit: string) => {
    const categoryId = selectedCategory === 'all' ? 'other' : selectedCategory;
    const newItem: ShoppingListItem = {
      name,
      qty: parseFloat(qty) || 1,
      unit,
      sources: ['הוספה ידנית'],
      category: categoryId
    };

    const updated = [...manualItems, newItem];
    setManualItems(updated);
    await saveManualItems(updated);

    // תיקון באג: שמירת הקטגוריה גם ב-itemCategories mapping
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

  const updateCategoryName = (catId: string, newName: string, newEmoji?: string) => {
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
    
    setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
        categories: updated,
        itemCategories,
        updatedAt: new Date().toISOString()
    });
    };

  const deleteCategory = (catId: string) => {
    
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
  setCategories(reorderedCategories);
  
  try {
    await setDoc(doc(db, 'orderSettings', 'shoppingCategories'), {
      categories: reorderedCategories,
      itemCategories,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('שגיאה בשמירת סדר קטגוריות:', error);
  }
};

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
              <p className="text-sm opacity-90">{manualItems.length} פריטים</p>
            </div>
            <div className="w-10"></div>
          </div>
        </div>

        {/* רשימת החוסרים */}
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {manualItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-7xl mb-4">📦</div>
                <div className="text-2xl text-gray-400 font-bold">אין חוסרים ברשימה</div>
                <div className="text-gray-400 mt-2 text-sm">לחץ על + כדי להוסיף פריט</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {manualItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        {item.qty} {item.unit}
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
  const totalItems = filteredAndSortedItems.length;
  const checkedCount = filteredAndSortedItems.filter(i => checkedItems[i.name]).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  // הצגת החוסרים למנהל (טאב חוסרים)
  const showShortagesTab = viewMode === 'shortages';

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-100 to-orange-100" dir="rtl">

      {/* טאבים למנהל: רשימת קניות / חוסרים */}
      {isManager && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto flex">
            <button
              onClick={() => setViewMode('shopping')}
              className={`flex-1 py-3 text-center font-semibold transition-all ${
                viewMode === 'shopping'
                  ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              🛒 רשימת קניות
            </button>
            <button
              onClick={() => setViewMode('shortages')}
              className={`flex-1 py-3 text-center font-semibold transition-all ${
                viewMode === 'shortages'
                  ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              📦 חוסרים ({manualItems.length})
            </button>
          </div>
        </div>
      )}

      {/* תצוגת חוסרים למנהל */}
      {showShortagesTab ? (
        <>
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 text-white p-4 shadow-lg">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              >
                <span className="text-xl">➡️</span>
              </button>
              <div className="text-center">
                <h1 className="text-2xl font-bold">חוסרים</h1>
                <p className="text-sm opacity-90">{manualItems.length} פריטים שנוספו ידנית</p>
              </div>
              <div className="w-10"></div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {manualItems.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-7xl mb-4">📦</div>
                  <div className="text-2xl text-gray-400 font-bold">אין חוסרים ברשימה</div>
                  <div className="text-gray-400 mt-2 text-sm">פריטים שנוספו ידנית יופיעו כאן</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {manualItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => {
                            const updated = {
                              ...checkedItems,
                              [item.name]: !checkedItems[item.name]
                            };
                            setCheckedItems(updated);
                            saveCheckedItems(updated);
                          }}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            checkedItems[item.name]
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {checkedItems[item.name] && '✓'}
                        </button>
                        <div className={checkedItems[item.name] ? 'opacity-50 line-through' : ''}>
                          <div className="font-semibold text-gray-800">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            {item.qty} {item.unit}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.category || 'other'}
                          onChange={(e) => {
                            const newCatId = e.target.value;
                            // עדכון הקטגוריה של הפריט
                            const updatedManual = manualItems.map(m =>
                              m.name === item.name ? { ...m, category: newCatId } : m
                            );
                            setManualItems(updatedManual);
                            saveManualItems(updatedManual);
                            moveItemToCategory(item.name, newCatId);
                          }}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeManualItem(item.name)}
                          className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all text-sm"
                          title="מחק פריט"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
        </>
      ) : (
        <>
          {/* תצוגת רשימת קניות רגילה */}
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
              categories={categories}
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
              onUpdateCategory={updateCategoryName}
              onDeleteCategory={deleteCategory}
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
            <div
              className="bg-white rounded-2xl shadow-xl overflow-visible"
                     >
              {filteredAndSortedItems.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-7xl mb-4">
                    {searchTerm ? '🔍' : '🛒'}
                  </div>
                  <div className="text-2xl text-gray-400 font-bold">
                    {searchTerm ? 'לא נמצאו תוצאות' : 'אין פריטים ברשימה'}
                  </div>
                  <div className="text-gray-400 mt-2 text-sm">
                    {searchTerm ? 'נסה חיפוש אחר' : 'הוסף פריטים או שנה הגדרות'}
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
        </>
      )}
    </div>
  );
}