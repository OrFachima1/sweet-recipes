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
}

type TabType = 'menu' | 'mapping' | 'ignored' | 'categories' | 'itemMapping' | 'recipes';

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
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('menu');
  const [newItemInput, setNewItemInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<{ id: string; title: string }[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  useEffect(() => {
    if (show && activeTab === 'recipes') {
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

  // ===== Menu handlers =====
  const addMenuItem = () => {
    const v = newItemInput.trim();
    if (!v) return;
    if (menuOptions.includes(v)) {
      alert('הפריט כבר קיים בתפריט');
      return;
    }
    onUpdateMenu([...menuOptions, v].sort());
    setNewItemInput('');
  };

  const removeMenuItem = (item: string) => {
    if (!confirm(`למחוק את "${item}" מהתפריט?`)) return;
    onUpdateMenu(menuOptions.filter((m) => m !== item));
  };

  // ===== Mapping handlers =====
  const removeMappingItem = (key: string) => {
    if (!confirm(`למחוק את המיפוי "${key}" → "${mapping[key]}"?`)) return;
    const newMapping = { ...mapping };
    delete newMapping[key];
    onUpdateMapping(newMapping);
  };

  // ===== Ignored handlers =====
  const addIgnoredItem = () => {
    const v = newItemInput.trim();
    if (!v) return;
    if (ignored.includes(v)) {
      alert('הפריט כבר ברשימת ההתעלמויות');
      return;
    }
    onUpdateIgnored([...ignored, v].sort());
    setNewItemInput('');
  };

  const removeIgnoredItem = (item: string) => {
    if (!confirm(`להסיר את "${item}" מרשימת ההתעלמויות?`)) return;
    onUpdateIgnored(ignored.filter((i) => i !== item));
  };

  // ===== Recipes links =====
  const addRecipeLink = (itemName: string, recipeId: string) => {
    if (!itemName.trim() || !recipeId.trim()) return;
    onUpdateRecipeLinks({
      ...recipeLinks,
      [itemName]: recipeId,
    });
  };

  const removeRecipeLink = (itemName: string) => {
    if (!confirm(`למחוק את הקישור למתכון של "${itemName}"?`)) return;
    const newLinks = { ...recipeLinks };
    delete newLinks[itemName];
    onUpdateRecipeLinks(newLinks);
  };

  // ===== Categories =====
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

  const moveCategoryUp = (name: string, currentIndex: number) => {
    if (!categories || currentIndex === 0) return;

    const entries = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const [prevName] = entries[currentIndex - 1];

    onUpdateCategories({
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], order: categories.items[name].order - 1 },
        [prevName]: { ...categories.items[prevName], order: categories.items[prevName].order + 1 },
      },
    });
  };

  const moveCategoryDown = (name: string, currentIndex: number, totalLength: number) => {
    if (!categories || currentIndex === totalLength - 1) return;

    const entries = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const [nextName] = entries[currentIndex + 1];

    onUpdateCategories({
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], order: categories.items[name].order + 1 },
        [nextName]: { ...categories.items[nextName], order: categories.items[nextName].order - 1 },
      },
    });
  };

  const addItemMapping = (itemName: string, categoryName: string) => {
    if (!categories) return;
    onUpdateCategories({
      ...categories,
      itemMapping: {
        ...categories.itemMapping,
        [itemName]: categoryName,
      },
    });
  };

  const removeItemMapping = (itemName: string) => {
    if (!categories) return;
    if (!confirm(`למחוק את המיפוי "${itemName}"?`)) return;

    const newMap = { ...categories.itemMapping };
    delete newMap[itemName];
    onUpdateCategories({ ...categories, itemMapping: newMap });
  };

  // ===== Filters =====
  const filteredMenu = menuOptions.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMapping = Object.entries(mapping).filter(
    ([key, value]) =>
      key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIgnored = ignored.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredItemMapping = categories
    ? Object.entries(categories.itemMapping).filter(
        ([item, cat]) =>
          item.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

const filteredRecipeLinks = Object.entries(recipeLinks || {}).filter(([item]) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <div className="text-white/80 text-sm">ניהול תפריט, מיפויים, קטגוריות והתעלמויות</div>
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
        <div className="flex border-b border-gray-200 px-6 bg-gray-50 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'menu' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 תפריט ({menuOptions.length})
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'mapping'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔗 מיפויים ({Object.keys(mapping).length})
          </button>
          <button
            onClick={() => setActiveTab('ignored')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'ignored'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🚫 התעלמויות ({ignored.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🎨 קטגוריות ({categories ? Object.keys(categories.items).length : 0})
          </button>
          <button
            onClick={() => setActiveTab('itemMapping')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'itemMapping'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🏷️ מיפוי מנות ({categories ? Object.keys(categories.itemMapping).length : 0})
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === 'recipes'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📖 מתכונים ({Object.keys(recipeLinks).length})
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

          {/* Menu tab */}
          {activeTab === 'menu' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף פריט חדש</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMenuItem()}
                    placeholder="שם הפריט..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={addMenuItem}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredMenu.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">לא נמצאו פריטים</div>
                ) : (
                  filteredMenu.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{item}</span>
                        {recipeLinks[item] && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            📖 מקושר למתכון
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeMenuItem(item)}
                        className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-all"
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mapping tab */}
          {activeTab === 'mapping' && (
            <div className="space-y-2">
              {filteredMapping.length === 0 ? (
                <div className="text-center text-gray-500 py-8">אין מיפויים</div>
              ) : (
                filteredMapping.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-medium text-gray-800">{key}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-purple-600">{value}</span>
                    </div>
                    <button
                      onClick={() => removeMappingItem(key)}
                      className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-all"
                    >
                      🗑️ מחק
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Ignored tab */}
          {activeTab === 'ignored' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף להתעלמות</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addIgnoredItem()}
                    placeholder="שם פריט להתעלם..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={addIgnoredItem}
                    className="px-4 py-2 rounded-lg bg-gray-500 text-white font-medium hover:bg-gray-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredIgnored.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">אין פריטים בהתעלמות</div>
                ) : (
                  filteredIgnored.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border-2 border-gray-200 hover:border-gray-300 transition-all"
                    >
                      <span className="font-medium text-gray-600 line-through">{item}</span>
                      <button
                        onClick={() => removeIgnoredItem(item)}
                        className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 text-sm font-medium transition-all"
                      >
                        ↩️ שחזר
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Categories tab */}
          {activeTab === 'categories' && categories && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף קטגוריה חדשה</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    placeholder="שם קטגוריה..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="color"
                    defaultValue="#DAF2D0"
                    className="w-16 h-10 rounded-lg border-2 border-purple-300 cursor-pointer"
                    id="newCategoryColor"
                  />
                  <button
                    onClick={() => {
                      if (!newItemInput.trim()) return;
                      const color = (document.getElementById('newCategoryColor') as HTMLInputElement).value;
                      addCategory(newItemInput.trim(), color);
                      setNewItemInput('');
                    }}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(categories.items)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([name, data], index, arr) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveCategoryUp(name, index)}
                          disabled={index === 0}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveCategoryDown(name, index, arr.length)}
                          disabled={index === arr.length - 1}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
                        >
                          ▼
                        </button>
                      </div>

                      <div
                        className="w-12 h-12 rounded-lg flex-shrink-0 border-2 border-gray-300"
                        style={{ backgroundColor: data.color }}
                      />

                      <div className="flex-1">
                        <div className="font-bold text-gray-800">{name}</div>
                        <div className="text-xs text-gray-500">סדר: {data.order}</div>
                      </div>

                      <input
                        type="color"
                        value={data.color}
                        onChange={(e) => updateCategoryColor(name, e.target.value)}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                        title="שנה צבע"
                      />

                      <button
                        onClick={() => removeCategory(name)}
                        className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-all"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Item mapping tab */}
          {activeTab === 'itemMapping' && categories && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף מיפוי מנה לקטגוריה</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    placeholder="שם מנה..."
                    className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                  />
                  <select
                    className="px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none min-w-[150px]"
                    id="newItemCategory"
                  >
                    <option value="">בחר קטגוריה...</option>
                    {Object.keys(categories.items).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!newItemInput.trim()) return;
                      const category = (document.getElementById('newItemCategory') as HTMLSelectElement).value;
                      if (!category) {
                        alert('יש לבחור קטגוריה');
                        return;
                      }
                      addItemMapping(newItemInput.trim(), category);
                      setNewItemInput('');
                    }}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredItemMapping.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">אין מיפויים</div>
                ) : (
                  filteredItemMapping.map(([item, category]) => {
                    const categoryColor = categories.items[category]?.color || '#E5E7EB';

                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                          <span className="font-medium text-gray-800">{item}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-purple-600">{category}</span>
                        </div>
                        <button
                          onClick={() => removeItemMapping(item)}
                          className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-all"
                        >
                          🗑️ מחק
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Recipes tab */}
          {activeTab === 'recipes' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">קשר מוצר למתכון</div>

                {loadingRecipes ? (
                  <div className="text-center py-4 text-gray-600">טוען מתכונים...</div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                      id="recipeItemSelect"
                    >
                      <option value="">בחר מוצר מהתפריט...</option>
                      {menuOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <select
                      className="flex-1 px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                      id="recipeSelect"
                    >
                      <option value="">בחר מתכון...</option>
                      {recipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.title}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const itemName = (document.getElementById('recipeItemSelect') as HTMLSelectElement).value;
                        const recipeId = (document.getElementById('recipeSelect') as HTMLSelectElement).value;
                        if (!itemName || !recipeId) {
                          alert('יש לבחור גם מוצר וגם מתכון');
                          return;
                        }
                        addRecipeLink(itemName, recipeId);
                        (document.getElementById('recipeItemSelect') as HTMLSelectElement).value = '';
                        (document.getElementById('recipeSelect') as HTMLSelectElement).value = '';
                      }}
                      className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all whitespace-nowrap"
                    >
                      + קשר
                    </button>
                  </div>
                )}

                <div className="text-xs text-gray-600 mt-2">💡 בחר מוצר מהתפריט ומתכון מהרשימה כדי לקשר ביניהם</div>
              </div>

              <div className="space-y-2">
                {filteredRecipeLinks.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">אין קישורים למתכונים</div>
                ) : (
                  filteredRecipeLinks.map(([item, recipeId]: [string, string]) => {
                    const recipe = recipes.find((r) => r.id === recipeId);
                    const recipeName = recipe?.title ?? recipeId;

                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-2xl">📖</span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{item}</div>
                            <div className="text-sm text-gray-500">→ {recipeName}</div>
                          </div>

                          <a
                            href={`/recipes/${recipeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 text-sm font-medium transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            פתח מתכון
                          </a>
                        </div>

                        <button
                          onClick={() => removeRecipeLink(item)}
                          className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium transition-all"
                        >
                          🗑️ מחק
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
        {/* /Content */}
      </div>
      {/* /Modal card */}
    </div>
  );
}
