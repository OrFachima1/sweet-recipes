"use client";
import React, { useState } from "react";

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  
  menuOptions: string[];
  onUpdateMenu: (newMenu: string[]) => void;
  
  mapping: Record<string, string>;
  onUpdateMapping: (newMapping: Record<string, string>) => void;
  
  ignored: string[];
  onUpdateIgnored: (newIgnored: string[]) => void;
  
  // ✅ קטגוריות כ-prop!
  categories: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  };
  
  onUpdateCategories: (config: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  }) => void;
}

type TabType = "menu" | "mapping" | "ignored" | "categories" | "itemMapping";

export default function SettingsModal({
  show,
  onClose,
  menuOptions,
  onUpdateMenu,
  mapping,
  onUpdateMapping,
  ignored,
  onUpdateIgnored,
  categories, // ✅ מגיע כ-prop
  onUpdateCategories,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [newItemInput, setNewItemInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // קטגוריות - נטען מה-global state
  
  if (!show) return null;

  // ===== תפריט =====
  const addMenuItem = () => {
    if (!newItemInput.trim()) return;
    if (menuOptions.includes(newItemInput.trim())) {
      alert("הפריט כבר קיים בתפריט");
      return;
    }
    onUpdateMenu([...menuOptions, newItemInput.trim()].sort());
    setNewItemInput("");
  };

  const removeMenuItem = (item: string) => {
    if (!confirm(`למחוק את "${item}" מהתפריט?`)) return;
    onUpdateMenu(menuOptions.filter(m => m !== item));
  };

  // ===== מיפויים =====
  const removeMappingItem = (key: string) => {
    if (!confirm(`למחוק את המיפוי "${key}" → "${mapping[key]}"?`)) return;
    const newMapping = { ...mapping };
    delete newMapping[key];
    onUpdateMapping(newMapping);
  };

  // ===== התעלמויות =====
  const removeIgnoredItem = (item: string) => {
    if (!confirm(`להסיר את "${item}" מרשימת ההתעלמויות?`)) return;
    onUpdateIgnored(ignored.filter(i => i !== item));
  };

  const addIgnoredItem = () => {
    if (!newItemInput.trim()) return;
    if (ignored.includes(newItemInput.trim())) {
      alert("הפריט כבר ברשימת ההתעלמויות");
      return;
    }
    onUpdateIgnored([...ignored, newItemInput.trim()].sort());
    setNewItemInput("");
  };

  // ===== קטגוריות =====
  const addCategory = (name: string, color: string) => {
    if (!categories) return;
    if (categories.items[name]) {
      alert("הקטגוריה כבר קיימת");
      return;
    }
    
    const maxOrder = Math.max(...Object.values(categories.items).map(c => c.order), -1);
    const newCategories = {
      ...categories,
      items: {
        ...categories.items,
        [name]: { color, order: maxOrder + 1 }
      }
    };
    
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  const removeCategory = (name: string) => {
    if (!categories) return;
    if (!confirm(`למחוק את הקטגוריה "${name}"?`)) return;
    
    const newItems = { ...categories.items };
    delete newItems[name];
    
    // מחק גם מיפויים
    const newMapping = { ...categories.itemMapping };
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === name) delete newMapping[key];
    });
    
    const newCategories = { items: newItems, itemMapping: newMapping };
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  const updateCategoryColor = (name: string, color: string) => {
    if (!categories) return;
    const newCategories = {
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], color }
      }
    };
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  const moveCategoryUp = (name: string, currentIndex: number) => {
    if (!categories || currentIndex === 0) return;
    
    const entries = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const [prevName] = entries[currentIndex - 1];
    
    const newCategories = {
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], order: categories.items[name].order - 1 },
        [prevName]: { ...categories.items[prevName], order: categories.items[prevName].order + 1 }
      }
    };
    
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  const moveCategoryDown = (name: string, currentIndex: number, totalLength: number) => {
    if (!categories || currentIndex === totalLength - 1) return;
    
    const entries = Object.entries(categories.items).sort((a, b) => a[1].order - b[1].order);
    const [nextName] = entries[currentIndex + 1];
    
    const newCategories = {
      ...categories,
      items: {
        ...categories.items,
        [name]: { ...categories.items[name], order: categories.items[name].order + 1 },
        [nextName]: { ...categories.items[nextName], order: categories.items[nextName].order - 1 }
      }
    };
    
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  // ===== מיפוי מנות לקטגוריות =====
  const addItemMapping = (itemName: string, categoryName: string) => {
    if (!categories) return;
    const newCategories = {
      ...categories,
      itemMapping: {
        ...categories.itemMapping,
        [itemName]: categoryName
      }
    };
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  const removeItemMapping = (itemName: string) => {
    if (!categories) return;
    if (!confirm(`למחוק את המיפוי "${itemName}"?`)) return;
    
    const newMapping = { ...categories.itemMapping };
    delete newMapping[itemName];
    
    const newCategories = { ...categories, itemMapping: newMapping };
    onUpdateCategories(newCategories);
    onUpdateCategories(newCategories);
  };

  // פילטור
  const filteredMenu = menuOptions.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMapping = Object.entries(mapping).filter(([key, value]) => 
    key.toLowerCase().includes(searchQuery.toLowerCase()) || 
    value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIgnored = ignored.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredItemMapping = categories 
    ? Object.entries(categories.itemMapping).filter(([item, cat]) => 
        item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

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
            onClick={() => setActiveTab("menu")}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === "menu"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📋 תפריט ({menuOptions.length})
          </button>
          <button
            onClick={() => setActiveTab("mapping")}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === "mapping"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🔗 מיפויים ({Object.keys(mapping).length})
          </button>
          <button
            onClick={() => setActiveTab("ignored")}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === "ignored"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🚫 התעלמויות ({ignored.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === "categories"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📁 קטגוריות ({categories ? Object.keys(categories.items).length : 0})
          </button>
          <button
            onClick={() => setActiveTab("itemMapping")}
            className={`px-4 py-3 font-medium transition-all whitespace-nowrap ${
              activeTab === "itemMapping"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🏷️ מיפוי מנות ({categories ? Object.keys(categories.itemMapping).length : 0})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* חיפוש */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 חיפוש..."
              className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* תפריט */}
          {activeTab === "menu" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף פריט חדש</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMenuItem()}
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
                      <span className="font-medium text-gray-800">{item}</span>
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

          {/* מיפויים */}
          {activeTab === "mapping" && (
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
                      <span className="text-gray-400">←</span>
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

          {/* התעלמויות */}
          {activeTab === "ignored" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="text-sm font-semibold text-gray-700 mb-2">הוסף להתעלמות</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addIgnoredItem()}
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

          {/* קטגוריות */}
          {activeTab === "categories" && categories && (
            <div className="space-y-4">
              {/* הוסף קטגוריה */}
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
                      setNewItemInput("");
                    }}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              {/* רשימת קטגוריות */}
              <div className="space-y-2">
                {Object.entries(categories.items)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([name, data], index, arr) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                    >
                      {/* חצים */}
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
                      
                      {/* צבע */}
                      <div
                        className="w-12 h-12 rounded-lg flex-shrink-0 border-2 border-gray-300"
                        style={{ backgroundColor: data.color }}
                      />
                      
                      {/* שם */}
                      <div className="flex-1">
                        <div className="font-bold text-gray-800">{name}</div>
                        <div className="text-xs text-gray-500">סדר: {data.order}</div>
                      </div>
                      
                      {/* עריכת צבע */}
                      <input
                        type="color"
                        value={data.color}
                        onChange={(e) => updateCategoryColor(name, e.target.value)}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                        title="שנה צבע"
                      />
                      
                      {/* מחק */}
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

          {/* מיפוי מנות לקטגוריות */}
          {activeTab === "itemMapping" && categories && (
            <div className="space-y-4">
              {/* הוסף מיפוי */}
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
                    {Object.keys(categories.items).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!newItemInput.trim()) return;
                      const category = (document.getElementById('newItemCategory') as HTMLSelectElement).value;
                      if (!category) {
                        alert("יש לבחור קטגוריה");
                        return;
                      }
                      addItemMapping(newItemInput.trim(), category);
                      setNewItemInput("");
                    }}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
                  >
                    + הוסף
                  </button>
                </div>
              </div>

              {/* רשימת מיפויים */}
              <div className="space-y-2">
                {filteredItemMapping.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">אין מיפויים</div>
                ) : (
                  filteredItemMapping.map(([item, category]) => {
                    const categoryColor = categories.items[category]?.color || "#E5E7EB";
                    
                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-purple-300 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-8 h-8 rounded-lg flex-shrink-0"
                            style={{ backgroundColor: categoryColor }}
                          />
                          <span className="font-medium text-gray-800">{item}</span>
                          <span className="text-gray-400">←</span>
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-purple-500 to-pink-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            ✓ סגור
          </button>
        </div>
      </div>
    </div>
  );
}