import React, { useState, useRef, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order?: number;
}

interface CategoryManagerProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
  itemCounts: Record<string, number>;
}

export default function CategoryManager({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  itemCounts
}: CategoryManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
  const [customEmoji, setCustomEmoji] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapCat = useRef<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('recentEmojis');
    if (saved) {
      try {
        setRecentEmojis(JSON.parse(saved));
      } catch {
        setRecentEmojis([]);
      }
    }
  }, []);

  const saveRecentEmoji = (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 10);
    setRecentEmojis(updated);
    localStorage.setItem('recentEmojis', JSON.stringify(updated));
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    
    const finalEmoji = customEmoji.trim() || newCatEmoji;
    
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: newCatName,
      emoji: finalEmoji,
      color: 'from-rose-50 to-pink-50',
      order: categories.length
    };
    
    onAddCategory(newCat);
    saveRecentEmoji(finalEmoji);
    setNewCatName('');
    setNewCatEmoji('📦');
    setCustomEmoji('');
    setShowAddModal(false);
  };

  const handleEditCategory = (catId: string) => {
    if (editName.trim() && catId !== 'all') {
      onUpdateCategory(catId, editName);
    }
    setEditingCat(null);
    setEditName('');
  };

  const handleDeleteCategory = (catId: string) => {
    if (confirm(`האם למחוק את הקטגוריה?`)) {
      onDeleteCategory(catId);
      setShowOptionsFor(null);
    }
  };

  const handleCategoryClick = (catId: string) => {
    if (isReorderMode) return;
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    
    if (lastTapCat.current === catId && timeSinceLastTap < 300 && catId !== 'all') {
      setShowOptionsFor(catId);
      lastTapTime.current = 0;
      lastTapCat.current = null;
    } else {
      onSelectCategory(catId);
      lastTapTime.current = now;
      lastTapCat.current = catId;
    }
  };

  const moveCategory = (catId: string, direction: 'left' | 'right') => {
    const allCats = categories.filter(c => c.id !== 'all');
    const visibleCats = allCats.filter(c => (itemCounts[c.id] || 0) > 0);
    const currentIndex = visibleCats.findIndex(c => c.id === catId);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= visibleCats.length) return;
    
    const newOrder = [...allCats];
    const fromIdx = allCats.findIndex(c => c.id === catId);
    const toIdx = allCats.findIndex(c => c.id === visibleCats[newIndex].id);
    
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    
    const reordered = newOrder.map((cat, idx) => ({
      ...cat,
      order: idx
    }));
    
    if (onReorderCategories) {
      onReorderCategories(reordered);
    }
    
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  const commonEmojis = ['🥬', '🥩', '🧀', '🍞', '🧂', '🥫', '🧴', '🧻', '🧊', '🍎', '🥕', '🐟', '🍗', '🥛', '🍳', '🌶️'];

  const filteredCategories = categories.filter(c => {
    if (c.id === 'all') return false;
    const count = itemCounts[c.id] || 0;
    return count > 0;
  });
  
  const allCategory = { id: 'all', name: 'הכל', emoji: '🛒', color: '' };

  return (
    <div className="relative">
      {filteredCategories.length > 1 && (
        <div className="flex justify-end mb-2 px-2">
          <button
            onClick={() => setIsReorderMode(!isReorderMode)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              isReorderMode 
                ? 'bg-rose-500 text-white shadow-lg' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isReorderMode ? '✓ סיים סידור' : '↕️ שנה סדר'}
          </button>
        </div>
      )}

      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-4 px-2 scrollbar-hide justify-center"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => handleCategoryClick(allCategory.id)}
          className={`flex-shrink-0 w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${
            selectedCategory === allCategory.id
              ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg scale-105'
              : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
          }`}
        >
          <div className="w-14 h-14 flex items-center justify-center mb-1" style={{ fontSize: '40px', lineHeight: '1' }}>
            {allCategory.emoji}
          </div>
          <div className="text-sm font-medium text-center leading-tight min-h-8 flex items-center px-1">
            {allCategory.name}
          </div>
          <div className="text-xs opacity-75 h-4 flex items-center justify-center">
            {Object.values(itemCounts).reduce((sum, count) => sum + count, 0)}
          </div>
        </button>

        {filteredCategories.map((cat, index) => (
          <div key={cat.id} className="relative flex-shrink-0">
            <button
              onClick={() => handleCategoryClick(cat.id)}
              disabled={isReorderMode}
              className={`w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${
                selectedCategory === cat.id && !isReorderMode
                  ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
              } ${isReorderMode ? 'opacity-50' : ''}`}
            >
              <div className="w-14 h-14 flex items-center justify-center mb-1" style={{ fontSize: '40px', lineHeight: '1' }}>
                {cat.emoji}
              </div>
              <div className="text-sm font-medium text-center leading-tight min-h-8 flex items-center px-1">
                {cat.name}
              </div>
              <div className="text-xs opacity-75 h-4 flex items-center justify-center">
                {itemCounts[cat.id] || 0}
              </div>
            </button>

            {isReorderMode && (
              <div className="absolute -top-2 -left-2 -right-2 flex justify-between">
                <button
                  onClick={() => moveCategory(cat.id, 'left')}
                  disabled={index === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                    index === 0 
                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                  }`}
                >
                  →
                </button>
                <button
                  onClick={() => moveCategory(cat.id, 'right')}
                  disabled={index === filteredCategories.length - 1}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                    index === filteredCategories.length - 1
                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                  }`}
                >
                  ←
                </button>
              </div>
            )}
          </div>
        ))}

        {!isReorderMode && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-shrink-0 w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-green-600 shadow-sm transition-all active:scale-95 border-2 border-dashed border-green-300"
          >
            <div className="w-14 h-14 flex items-center justify-center mb-1" style={{ fontSize: '40px', lineHeight: '1' }}>
              +
            </div>
            <div className="text-sm font-medium text-center leading-tight min-h-8 flex items-center">
              הוסף
            </div>
            <div className="h-4"></div>
          </button>
        )}
      </div>

      {showOptionsFor && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowOptionsFor(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 text-gray-800">אפשרויות</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setEditingCat(showOptionsFor);
                  const cat = categories.find(c => c.id === showOptionsFor);
                  setEditName(cat?.name || '');
                  setShowOptionsFor(null);
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium transition-all active:scale-95"
              >
                ✏️ ערוך שם
              </button>
              <button
                onClick={() => handleDeleteCategory(showOptionsFor)}
                className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-all active:scale-95"
              >
                🗑️ מחק קטגוריה
              </button>
              <button
                onClick={() => setShowOptionsFor(null)}
                className="w-full py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-all active:scale-95"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCat && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditingCat(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-4 text-gray-800">ערוך קטגוריה</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEditCategory(editingCat)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleEditCategory(editingCat)}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium transition-all active:scale-95"
              >
                שמור
              </button>
              <button
                onClick={() => setEditingCat(null)}
                className="flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all active:scale-95"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-4 text-gray-800">קטגוריה חדשה</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקטגוריה</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !customEmoji && handleAddCategory()}
                  placeholder="לדוגמא: מוצרי חלב"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">אימוג'י מותאם אישית (אופציונלי)</label>
                <input
                  type="text"
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="הדבק או הקלד אימוג'י כאן... 😊"
                  className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 focus:border-blue-400 focus:outline-none text-base"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 העתק אימוג'י מכל מקום והדבק כאן
                </p>
              </div>

              {!customEmoji && recentEmojis.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">אימוג'ים אחרונים</label>
                  <div className="grid grid-cols-10 gap-2">
                    {recentEmojis.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewCatEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          newCatEmoji === emoji 
                            ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' 
                            : 'bg-gray-100 hover:bg-gray-200 active:scale-95'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!customEmoji && (
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">אימוג'ים פופולריים</label>
                  <div className="grid grid-cols-8 gap-2">
                    {commonEmojis.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewCatEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          newCatEmoji === emoji 
                            ? 'bg-rose-100 ring-2 ring-rose-400 scale-110' 
                            : 'bg-gray-100 hover:bg-gray-200 active:scale-95'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✓ צור קטגוריה
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewCatName('');
                    setNewCatEmoji('📦');
                    setCustomEmoji('');
                  }}
                  className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all active:scale-95"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}