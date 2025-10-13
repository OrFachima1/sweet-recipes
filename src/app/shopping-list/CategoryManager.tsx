import React, { useState, useRef, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface CategoryManagerProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  itemCounts: Record<string, number>;
}

export default function CategoryManager({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  itemCounts
}: CategoryManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📦');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowScrollHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: newCatName,
      emoji: selectedEmoji,
      color: 'from-indigo-100 to-purple-100'
    };
    
    onAddCategory(newCat);
    setNewCatName('');
    setSelectedEmoji('📦');
    setShowAddModal(false);
  };

  const emojiList = ['🥗', '🍖', '🥛', '🍞', '🧀', '🥕', '🍎', '🥫', '🧴', '🧻', '🍕', '🍰', '🥤', '🍺', '🌶️', '🥒', '🍅', '🥦', '🐟', '🐔', '🥩', '🧂', '🍯', '🥜', '📦'];

  return (
    <div className="relative">
      {/* רמז גלילה */}
      {showScrollHint && categories.length > 3 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-white/50 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
              <span>→</span>
              <span>החלק</span>
              <span>←</span>
            </div>
          </div>
        </div>
      )}

      {/* קטגוריות */}
      <div 
        ref={scrollRef}
        className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {categories.map(cat => {
          const count = itemCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`
                flex-shrink-0 px-4 py-1.5 rounded-xl font-bold text-sm transition-all duration-200
                flex items-center gap-1.5 whitespace-nowrap
                ${isSelected
                  ? 'bg-white text-indigo-600 shadow-md scale-105'
                  : 'bg-white/30 text-white hover:bg-white/50 active:scale-95'
                }
              `}
            >
              <span className="text-base">{cat.emoji}</span>
              <span>{cat.name}</span>
              {count > 0 && (
                <span className={`
                  px-1.5 py-0.5 rounded-md text-xs font-bold
                  ${isSelected 
                    ? 'bg-indigo-100 text-indigo-600' 
                    : 'bg-white/40 text-white'
                  }
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* כפתור הוספה */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/30 hover:bg-white/50 flex items-center justify-center text-white text-lg transition-all active:scale-90"
        >
          +
        </button>
      </div>

      {/* מודל הוספת קטגוריה */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">קטגוריה חדשה</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקטגוריה</label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="לדוגמה: מוצרי חלב"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">בחר אייקון</label>
                <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-xl">
                  {emojiList.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`
                        aspect-square rounded-lg text-2xl flex items-center justify-center
                        transition-all active:scale-90
                        ${selectedEmoji === emoji 
                          ? 'bg-indigo-100 ring-2 ring-indigo-400 scale-110' 
                          : 'bg-white hover:bg-gray-100'
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddCategory}
                  disabled={!newCatName.trim()}
                  className={`
                    flex-1 px-6 py-3 rounded-xl font-bold text-base transition-all
                    ${newCatName.trim()
                      ? 'bg-gradient-to-l from-indigo-500 to-purple-500 text-white hover:shadow-lg active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  הוסף
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-base transition-all active:scale-95"
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
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}