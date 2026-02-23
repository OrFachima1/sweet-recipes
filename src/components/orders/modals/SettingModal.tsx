'use client';
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;

  menuOptions: string[];
  onUpdateMenu: (newMenu: string[]) => void;

  mapping: Record<string, string>;
  onUpdateMapping: (newMapping: Record<string, string>) => void;

  ignored: string[];
  onUpdateIgnored: (newIgnored: string[]) => void;

  categories: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  };

  onUpdateCategories: (config: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  }) => void;

  recipeLinks: Record<string, string>;
  onUpdateRecipeLinks: (links: Record<string, string>) => void;

  prices: Record<string, number>;
  onUpdatePrices: (prices: Record<string, number>) => void;

  dishAccessories: Record<string, string[]>;
  onUpdateDishAccessories: (accessories: Record<string, string[]>) => void;
}

type TabType = 'dishes' | 'categories' | 'mappings';

// ===== Helper Components =====
function StepBox({
  number,
  title,
  required = false,
  optional = false,
  children,
}: {
  number: number;
  title: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center text-sm">
          {number}
        </div>
        <div className="font-semibold text-gray-700">
          {title}
          {required && <span className="text-red-500 mr-1">*</span>}
          {optional && <span className="text-gray-400 text-xs mr-2">(אופציונלי)</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function AutocompleteInput({
  value,
  onChange,
  options,
  renderOption,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  renderOption?: (opt: string) => string;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!value.trim() || !focused) {
      setFilteredOptions([]);
      return;
    }

    const query = value.toLowerCase();
    const matches = options.filter((opt) => opt.toLowerCase().includes(query)).slice(0, 10);

    setFilteredOptions(matches);
  }, [value, options, focused]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
      />

      {filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setFilteredOptions([]);
              }}
              className="w-full text-right px-3 py-2 hover:bg-purple-50 transition-colors border-b last:border-b-0"
            >
              {renderOption ? renderOption(opt) : opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsModal({
  show,
  onClose,
  menuOptions,
  onUpdateMenu,
  mapping,
  onUpdateMapping,
  ignored,
  onUpdateIgnored,
  categories,
  onUpdateCategories,
  recipeLinks,
  onUpdateRecipeLinks,
  prices,
  onUpdatePrices,
  dishAccessories,
  onUpdateDishAccessories,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dishes');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<{ id: string; title: string }[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // State for dishes tab
  const [selectedDishName, setSelectedDishName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<number | ''>('');
  const [isEditMode, setIsEditMode] = useState(false);

  // State for mappings tab
  const [newMappingKey, setNewMappingKey] = useState('');
  const [newMappingValue, setNewMappingValue] = useState('');
  const [newIgnoredItem, setNewIgnoredItem] = useState('');

  // State for categories tab (existing handlers)
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('#ec4899');

  // State for accessories
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [newAccessoryInput, setNewAccessoryInput] = useState('');

  useEffect(() => {
    if (show && activeTab === 'dishes') {
      loadRecipes();
    }
  }, [show, activeTab]);

  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const recipesCol = collection(db, 'recipes');
      const q = query(recipesCol, orderBy('title', 'asc'));
      const snap = await getDocs(q);

      const list = snap.docs.map((doc) => ({
        id: doc.id,
        title: (doc.data() as any).title || 'ללא שם',
      }));

      setRecipes(list);
    } catch (e) {
      console.error('Failed loading recipes', e);
    } finally {
      setLoadingRecipes(false);
    }
  };

  if (!show) return null;

  // ===== Dishes tab handlers =====
  const loadDishData = (dishName: string) => {
    if (!menuOptions.includes(dishName)) {
      // מנה חדשה
      setIsEditMode(false);
      setSelectedCategory('');
      setSelectedRecipe('');
      setSelectedPrice('');
      setSelectedAccessories([]);
      return;
    }

    // מנה קיימת - טען את כל הנתונים
    setIsEditMode(true);

    // טען קטגוריה
    const category = categories?.itemMapping[dishName] || '';
    setSelectedCategory(category);

    // טען מתכון - המר מ-ID לכותרת
    const recipeId = recipeLinks[dishName] || '';
    const recipeTitle = recipes.find((r) => r.id === recipeId)?.title || '';
    setSelectedRecipe(recipeTitle);

    // טען מחיר
    const price = prices[dishName] || '';
    setSelectedPrice(price);

    // טען נלווים
    const accessories = dishAccessories[dishName] || [];
    setSelectedAccessories(accessories);
  };

  const handleSaveDish = () => {
    if (!selectedDishName.trim()) {
      alert('יש להזין שם מנה');
      return;
    }
    if (!selectedCategory) {
      alert('יש לבחור קטגוריה');
      return;
    }

    // עדכון menuOptions אם מנה חדשה
    if (!menuOptions.includes(selectedDishName)) {
      onUpdateMenu([...menuOptions, selectedDishName].sort());
    }

    // עדכון קטגוריה
    const newItemMapping = { ...(categories?.itemMapping || {}) };
    newItemMapping[selectedDishName] = selectedCategory;
    onUpdateCategories({
      ...(categories || { items: {}, itemMapping: {} }),
      itemMapping: newItemMapping,
    });

    // עדכון מתכון אם יש - המר מכותרת ל-ID
    if (selectedRecipe) {
      const recipeId = recipes.find((r) => r.title === selectedRecipe)?.id;
      if (recipeId) {
        onUpdateRecipeLinks({ ...recipeLinks, [selectedDishName]: recipeId });
      }
    } else {
      // הסר מתכון אם רוקן
      const newLinks = { ...recipeLinks };
      delete newLinks[selectedDishName];
      onUpdateRecipeLinks(newLinks);
    }

    // עדכון מחיר אם יש
    if (selectedPrice !== '') {
      onUpdatePrices({ ...prices, [selectedDishName]: Number(selectedPrice) });
    } else {
      // הסר מחיר אם רוקן
      const newPrices = { ...prices };
      delete newPrices[selectedDishName];
      onUpdatePrices(newPrices);
    }

    // עדכון נלווים
    if (selectedAccessories.length > 0) {
      onUpdateDishAccessories({ ...dishAccessories, [selectedDishName]: selectedAccessories });
    } else {
      // הסר נלווים אם ריק
      const newAccessories = { ...dishAccessories };
      delete newAccessories[selectedDishName];
      onUpdateDishAccessories(newAccessories);
    }

    alert('המנה נשמרה בהצלחה!');
    handleClearForm();
  };

  const handleDeleteDish = () => {
    if (!confirm(`האם למחוק את המנה "${selectedDishName}"?`)) return;

    // הסר מהתפריט
    onUpdateMenu(menuOptions.filter((x) => x !== selectedDishName));

    // הסר מקטגוריות
    const newItemMapping = { ...(categories?.itemMapping || {}) };
    delete newItemMapping[selectedDishName];
    onUpdateCategories({
      ...(categories || { items: {}, itemMapping: {} }),
      itemMapping: newItemMapping,
    });

    // הסר מתכון
    const newLinks = { ...recipeLinks };
    delete newLinks[selectedDishName];
    onUpdateRecipeLinks(newLinks);

    // הסר מחיר
    const newPrices = { ...prices };
    delete newPrices[selectedDishName];
    onUpdatePrices(newPrices);

    // הסר נלווים
    const newAccessories = { ...dishAccessories };
    delete newAccessories[selectedDishName];
    onUpdateDishAccessories(newAccessories);

    alert('המנה נמחקה בהצלחה!');
    handleClearForm();
  };

  const handleClearForm = () => {
    setSelectedDishName('');
    setSelectedCategory('');
    setSelectedRecipe('');
    setSelectedPrice('');
    setSelectedAccessories([]);
    setNewAccessoryInput('');
    setIsEditMode(false);
  };

  // ===== Accessories handlers =====
  const addAccessory = () => {
    const accessory = newAccessoryInput.trim();
    if (!accessory) return;
    if (selectedAccessories.includes(accessory)) {
      alert('הנלווה כבר קיים');
      return;
    }
    setSelectedAccessories([...selectedAccessories, accessory]);
    setNewAccessoryInput('');
  };

  const removeAccessory = (accessory: string) => {
    setSelectedAccessories(selectedAccessories.filter(a => a !== accessory));
  };

  // ===== Mappings tab handlers =====
  const addMapping = () => {
    const key = newMappingKey.trim();
    const value = newMappingValue.trim();
    if (!key || !value) return;
    if (mapping[key]) {
      alert('המיפוי כבר קיים');
      return;
    }
    onUpdateMapping({ ...mapping, [key]: value });
    setNewMappingKey('');
    setNewMappingValue('');
  };

  const removeMapping = (key: string) => {
    if (!confirm(`למחוק את המיפוי "${key}" → "${mapping[key]}"?`)) return;
    const newMapping = { ...mapping };
    delete newMapping[key];
    onUpdateMapping(newMapping);
  };

  const addIgnored = () => {
    const v = newIgnoredItem.trim();
    if (!v) return;
    if (ignored.includes(v)) {
      alert('הפריט כבר ברשימת ההתעלמויות');
      return;
    }
    onUpdateIgnored([...ignored, v].sort());
    setNewIgnoredItem('');
  };

  const removeIgnored = (item: string) => {
    if (!confirm(`להסיר את "${item}" מרשימת ההתעלמויות?`)) return;
    onUpdateIgnored(ignored.filter((i) => i !== item));
  };

  // ===== Categories tab handlers (from original code) =====
  const addCategory = (name: string, color: string) => {
    if (!categories) return;
    if (categories.items[name]) {
      alert('הקטגוריה כבר קיימת');
      return;
    }
    const maxOrder = Math.max(...Object.values(categories.items).map((c) => c.order), -1);
    const newCategories = {
      ...categories,
      items: {
        ...categories.items,
        [name]: { color, order: maxOrder + 1 },
      },
    };
    onUpdateCategories(newCategories);
    setNewCategoryInput('');
  };

  const removeCategory = (name: string) => {
    if (!categories) return;
    if (!confirm(`למחוק את הקטגוריה "${name}"?`)) return;

    const newItems = { ...categories.items };
    delete newItems[name];

    const newMap = { ...categories.itemMapping };
    Object.keys(newMap).forEach((key) => {
      if (newMap[key] === name) delete newMap[key];
    });

    onUpdateCategories({ items: newItems, itemMapping: newMap });
  };

  const updateCategoryColor = (name: string, color: string) => {
    if (!categories) return;
    onUpdateCategories({
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], color },
      },
    });
  };

  const moveCategoryUp = (name: string) => {
    if (!categories) return;
    const sorted = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const idx = sorted.findIndex(([n]) => n === name);
    if (idx <= 0) return;

    const newItems = { ...categories.items };
    const temp = newItems[sorted[idx][0]].order;
    newItems[sorted[idx][0]].order = newItems[sorted[idx - 1][0]].order;
    newItems[sorted[idx - 1][0]].order = temp;

    onUpdateCategories({ ...categories, items: newItems });
  };

  const moveCategoryDown = (name: string) => {
    if (!categories) return;
    const sorted = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const idx = sorted.findIndex(([n]) => n === name);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const newItems = { ...categories.items };
    const temp = newItems[sorted[idx][0]].order;
    newItems[sorted[idx][0]].order = newItems[sorted[idx + 1][0]].order;
    newItems[sorted[idx + 1][0]].order = temp;

    onUpdateCategories({ ...categories, items: newItems });
  };

  // ================== RENDER ==================
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-500 to-pink-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <div>
              <div className="font-bold text-white text-xl">הגדרות מערכת</div>
              <div className="text-white/80 text-sm">ניהול מנות, קטגוריות, מיפויים והתעלמויות</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b-2 border-gray-200 px-6 bg-gray-50 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dishes')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'dishes'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🍽️ ניהול מנות
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🎨 ניהול קטגוריות ({categories ? Object.keys(categories.items).length : 0})
          </button>

          <button
            onClick={() => setActiveTab('mappings')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'mappings'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔗 מיפויים והתעלמויות
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 חיפוש..."
              className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* TAB 1: Dishes Management */}
          {activeTab === 'dishes' && (
            <div className="space-y-6">
              {loadingRecipes && (
                <div className="text-center text-gray-500 py-4">טוען מתכונים...</div>
              )}

              {/* 4 Steps */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Step 1: Dish */}
                <StepBox number={1} title="מנה" required>
                  <AutocompleteInput
                    value={selectedDishName}
                    onChange={(val) => {
                      setSelectedDishName(val);
                      loadDishData(val);
                    }}
                    options={menuOptions}
                    placeholder="הקלד שם מנה..."
                  />
                </StepBox>

                {/* Step 2: Category */}
                <StepBox number={2} title="קטגוריה" required>
                  <AutocompleteInput
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    options={categories ? Object.keys(categories.items) : []}
                    placeholder="בחר קטגוריה..."
                  />
                </StepBox>

                {/* Step 3: Recipe */}
                <StepBox number={3} title="מתכון" optional>
                  <AutocompleteInput
                    value={selectedRecipe}
                    onChange={setSelectedRecipe}
                    options={recipes.map((r) => r.title)}
                    placeholder="בחר מתכון (אופציונלי)"
                  />
                </StepBox>

                {/* Step 4: Price */}
                <StepBox number={4} title="מחיר" optional>
                  <input
                    type="number"
                    value={selectedPrice}
                    onChange={(e) => setSelectedPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="מחיר (אופציונלי)"
                    className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                </StepBox>
              </div>

              {/* Step 5: Accessories */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm">
                    5
                  </div>
                  <div className="font-semibold text-gray-700">
                    נלווים למנה
                    <span className="text-gray-400 text-xs mr-2">(אופציונלי)</span>
                  </div>
                </div>

                {/* Add accessory */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newAccessoryInput}
                    onChange={(e) => setNewAccessoryInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAccessory()}
                    placeholder="כף חלוקה, רוטב, מפיות..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    onClick={addAccessory}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>

                {/* Accessories list */}
                {selectedAccessories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedAccessories.map((accessory) => (
                      <div
                        key={accessory}
                        className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full border-2 border-amber-200"
                      >
                        <span className="text-sm font-medium">{accessory}</span>
                        <button
                          onClick={() => removeAccessory(accessory)}
                          className="w-5 h-5 rounded-full bg-red-100 hover:bg-red-200 text-red-600 text-xs flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedAccessories.length === 0 && (
                  <div className="text-gray-400 text-sm text-center py-2">
                    אין נלווים - הוסף פריטים שצריך לצרף למנה (למסך וידוא הזמנה)
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleSaveDish}
                  className="px-6 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all shadow-md"
                >
                  ✅ שמור
                </button>
                {isEditMode && (
                  <button
                    onClick={handleDeleteDish}
                    className="px-6 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all shadow-md"
                  >
                    🗑️ מחק
                  </button>
                )}
                <button
                  onClick={handleClearForm}
                  className="px-6 py-2 rounded-lg bg-gray-300 text-gray-700 font-medium hover:bg-gray-400 transition-all shadow-md"
                >
                  🔄 נקה טופס
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Categories Management */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              {/* Add new category */}
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף קטגוריה חדשה</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && addCategory(newCategoryInput, newColorInput)
                    }
                    placeholder="שם הקטגוריה..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="color"
                    value={newColorInput}
                    onChange={(e) => setNewColorInput(e.target.value)}
                    className="w-16 h-10 rounded-lg border-2 border-purple-300 cursor-pointer"
                  />
                  <button
                    onClick={() => addCategory(newCategoryInput, newColorInput)}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              {/* Category list */}
              <div className="space-y-2">
                {categories &&
                  Object.entries(categories.items)
                    .sort((a, b) => a[1].order - b[1].order)
                    .filter(([name]) => name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(([name, data]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border-2 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded-full border-2 border-gray-300"
                            style={{ backgroundColor: data.color }}
                          />
                          <span className="font-medium">{name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveCategoryUp(name)}
                            className="p-1 hover:bg-gray-100 rounded transition-all"
                            title="הזז למעלה"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveCategoryDown(name)}
                            className="p-1 hover:bg-gray-100 rounded transition-all"
                            title="הזז למטה"
                          >
                            ↓
                          </button>
                          <input
                            type="color"
                            value={data.color}
                            onChange={(e) => updateCategoryColor(name, e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-2 border-gray-300"
                            title="שנה צבע"
                          />
                          <button
                            onClick={() => removeCategory(name)}
                            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-all text-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* TAB 3: Mappings & Ignored */}
          {activeTab === 'mappings' && (
            <div className="space-y-8">
              {/* Section A: Mappings */}
              <section>
                <h3 className="text-xl font-bold mb-4">🔗 מיפויים (שמות חלופיים)</h3>

                {/* Add new mapping */}
                <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200 mb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">הוסף מיפוי חדש</div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newMappingKey}
                      onChange={(e) => setNewMappingKey(e.target.value)}
                      placeholder="שם חלופי..."
                      className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                    />
                    <span className="text-2xl text-gray-400">→</span>
                    <div className="flex-1">
                      <AutocompleteInput
                        value={newMappingValue}
                        onChange={setNewMappingValue}
                        options={menuOptions}
                        placeholder="שם מנה רשמי..."
                      />
                    </div>
                    <button
                      onClick={addMapping}
                      className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                    >
                      + הוסף
                    </button>
                  </div>
                </div>

                {/* Mappings list */}
                <div className="space-y-2">
                  {Object.entries(mapping)
                    .filter(([k]) => k.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(([alias, dish]) => (
                      <div
                        key={alias}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border-2"
                      >
                        <span className="font-medium">{alias}</span>
                        <span className="text-gray-400 text-xl">→</span>
                        <span className="text-purple-600 font-medium flex-1 text-center">{dish}</span>
                        <button
                          onClick={() => removeMapping(alias)}
                          className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-all text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                </div>
              </section>

              <hr className="border-gray-300" />

              {/* Section B: Ignored */}
              <section>
                <h3 className="text-xl font-bold mb-4">🚫 התעלמויות</h3>

                {/* Add ignored item */}
                <div className="bg-gradient-to-l from-red-50 to-orange-50 rounded-2xl p-4 border-2 border-red-200 mb-4">
                  <div className="text-sm font-semibold text-gray-700 mb-2">הוסף מנה להתעלם</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <AutocompleteInput
                        value={newIgnoredItem}
                        onChange={setNewIgnoredItem}
                        options={menuOptions.filter((x) => !ignored.includes(x))}
                        placeholder="בחר מנה..."
                      />
                    </div>
                    <button
                      onClick={addIgnored}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all"
                    >
                      + הוסף
                    </button>
                  </div>
                </div>

                {/* Ignored list */}
                <div className="space-y-2">
                  {ignored
                    .filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border-2"
                      >
                        <span className="font-medium">{item}</span>
                        <button
                          onClick={() => removeIgnored(item)}
                          className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-all text-sm"
                        >
                          ✖ הסר
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
