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
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
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
      emoji: newCatEmoji,
      color: 'from-purple-100 to-pink-100'
    };
    
    onAddCategory(newCat);
    setNewCatName('');
    setNewCatEmoji('📦');
    setShowAddModal(false);
  };

  const emojiList = ['🥗', '🍖', '🥛', '🍞', '🧀', '🥕', '🍎', '🥫', '🧴', '🧻', '📦', '🛒'];

  return (
    <div className="relative">
      {/* רמז גלילה */}
      {showScrollHint && categories.length > 3 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border-2 border-purple-200 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-purple-600">←</span>
              <span className="text-sm font-bold text-gray-700">החלק לניווט</span>
              <span className="text-sm font-bold text-purple-600">→</span>
            </div>
          </div>
        </div>
      )}

      {/* קטגוריות */}
      <div 
        ref={scrollRef}
        className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {categories.map(cat => {
          const count = itemCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`
                flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all duration-300
                flex items-center gap-2 whitespace-nowrap border-2
                ${isSelected
                  ? 'bg-white text-purple-600 border-purple-300 shadow-lg scale-105'
                  : 'bg-white/40 text-white border-white/30 hover:bg-white/60 hover:scale-105'
                }
              `}
            >
              <span className="text-lg">{cat.emoji}</span>
              <span>{cat.name}</span>
              {count > 0 && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-bold
                  ${isSelected 
                    ? 'bg-purple-100 text-purple-600' 
                    : 'bg-white/50 text-white'
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
          className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white/40 hover:bg-white/60 border-2 border-white/30 flex items-center justify-center text-white text-xl transition-all hover:scale-110 active:scale-95"
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
                  placeholder="לדוגמה: מוצרי חלב"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none text-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">בחר אייקון</label>
                <div className="grid grid-cols-6 gap-2">
                  {emojiList.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewCatEmoji(emoji)}
                      className={`
                        w-full aspect-square rounded-xl text-2xl flex items-center justify-center
                        transition-all hover:scale-110 active:scale-95
                        ${newCatEmoji === emoji 
                          ? 'bg-purple-100 border-2 border-purple-400 shadow-lg' 
                          : 'bg-gray-100 hover:bg-gray-200'
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
                    flex-1 px-6 py-4 rounded-2xl font-bold text-lg transition-all
                    ${newCatName.trim()
                      ? 'bg-gradient-to-l from-purple-500 to-pink-500 text-white hover:shadow-xl active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  הוסף
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-4 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg transition-all active:scale-95"
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