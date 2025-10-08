"use client";
import React, { useState } from "react";

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  
  // תפריט
  menuOptions: string[];
  onUpdateMenu: (newMenu: string[]) => void;
  
  // מיפויים
  mapping: Record<string, string>;
  onUpdateMapping: (newMapping: Record<string, string>) => void;
  
  // התעלמויות
  ignored: string[];
  onUpdateIgnored: (newIgnored: string[]) => void;
}

type TabType = "menu" | "mapping" | "ignored";

export default function SettingsModal({
  show,
  onClose,
  menuOptions,
  onUpdateMenu,
  mapping,
  onUpdateMapping,
  ignored,
  onUpdateIgnored,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("menu");
  const [newItemInput, setNewItemInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  if (!show) return null;

  // ===== תפריט =====
  const addMenuItem = () => {
    if (!newItemInput.trim()) return;
    if (menuOptions.includes(newItemInput.trim())) {
      alert("הפריט כבר קיים בתפריט");
      return;
    }
    onUpdateMenu([...menuOptions, newItemInput.trim()]);
    setNewItemInput("");
  };

  const removeMenuItem = (item: string) => {
    if (!confirm(`למחוק את "${item}" מהתפריט?`)) return;
    onUpdateMenu(menuOptions.filter(m => m !== item));
  };

  // ===== מיפויים =====
  const removeMappingItem = (key: string) => {
    if (!confirm(`למחוק את המיפוי "${key}" ← "${mapping[key]}"?`)) return;
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
    onUpdateIgnored([...ignored, newItemInput.trim()]);
    setNewItemInput("");
  };

  // פילטור לפי חיפוש
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

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-500 to-pink-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <div>
              <div className="font-bold text-white text-xl">הגדרות מערכת</div>
              <div className="text-white/80 text-sm">ניהול תפריט, מיפויים והתעלמויות</div>
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
        <div className="flex border-b border-gray-200 px-6 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => setActiveTab("menu")}
            className={`px-4 py-3 font-medium transition-all ${
              activeTab === "menu"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📋 תפריט ({menuOptions.length})
          </button>
          <button
            onClick={() => setActiveTab("mapping")}
            className={`px-4 py-3 font-medium transition-all ${
              activeTab === "mapping"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🔗 מיפויים ({Object.keys(mapping).length})
          </button>
          <button
            onClick={() => setActiveTab("ignored")}
            className={`px-4 py-3 font-medium transition-all ${
              activeTab === "ignored"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            🚫 התעלמויות ({ignored.length})
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