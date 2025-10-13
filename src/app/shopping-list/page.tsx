"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import ShoppingListSettings from '@/components/shopping/ShoppingListSettings';
import CategoryManager from '@/components/shopping/CategoryManager';
import ShoppingItem from '@/components/shopping/ShoppingItem';
import ShoppingHeader from '@/components/shopping/ShoppingHeader';
import { ShoppingToolbar } from '@/components/shopping/ShoppingToolbar';
import { AddItemModal } from '@/components/shopping/AddItemModal';
import { useShoppingList, ShoppingListItem } from '@/hooks/useShoppingList';

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
      counts[cat.id] = groupedList[cat.id]?.length || 0;
    });
    return counts;
  }, [shoppingList, categories, groupedList]);

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

  const addManualItem = (name: string, qty: string, unit: string) => {
    const newItem: ShoppingListItem = {
      name,
      qty: parseFloat(qty) || 1,
      unit,
      sources: ['הוספה ידנית'],
      category: selectedCategory === 'all' ? 'other' : selectedCategory
    };
    
    const updated = [...manualItems, newItem];
    setManualItems(updated);
    saveManualItems(updated);
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
      alert('לא ניתן למחוק את הקטגוריה "כללי"');
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

  const clearCheckedItems = () => {
    if (confirm('למחוק את כל הפריטים המסומנים?')) {
      const checkedNames = Object.keys(checkedItems).filter(name => checkedItems[name]);
      const updatedManual = manualItems.filter(item => !checkedNames.includes(item.name));
      setManualItems(updatedManual);
      saveManualItems(updatedManual);
      setCheckedItems({});
      saveCheckedItems({});
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
      await setDoc(doc(db, 'orderSettings', 'shoppingListSettings'), {
        settings,
        updatedAt: new Date().toISOString()
      });
      setRecipeSettings(settings);
    } catch (error) {
      console.error('שגיאה בשמירת הגדרות:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-100 via-pink-100 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-rose-300 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-rose-500 text-2xl font-bold">טוען...</div>
        </div>
      </div>
    );
  }

  const totalItems = filteredAndSortedItems.length;
  const checkedCount = filteredAndSortedItems.filter(i => checkedItems[i.name]).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

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
          onUpdateCategory={updateCategoryName}
          onDeleteCategory={deleteCategory}
          itemCounts={itemCounts}
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
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                  key={idx}
                  name={item.name}
                  qty={item.qty}
                  unit={item.unit}
                  isManual={item.sources[0] === 'הוספה ידנית'}
                  isChecked={checkedItems[item.name] || false}
                  categories={categories}
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