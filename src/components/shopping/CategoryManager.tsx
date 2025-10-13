import React, { useState, useRef, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order?: number; // הוספנו שדה order
}

interface CategoryManagerProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (id: string, name: string) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void; // חדש
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
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const [draggedCat, setDraggedCat] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapCat = useRef<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('recentEmojis');
    if (saved) {
      setRecentEmojis(JSON.parse(saved));
    }
  }, []);

  const saveRecentEmoji = (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 8);
    setRecentEmojis(updated);
    localStorage.setItem('recentEmojis', JSON.stringify(updated));
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: newCatName,
      emoji: newCatEmoji,
      color: 'from-rose-50 to-pink-50',
      order: categories.length
    };
    
    onAddCategory(newCat);
    saveRecentEmoji(newCatEmoji);
    setNewCatName('');
    setNewCatEmoji('📦');
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

  // זיהוי דאבל קליק/טאפ
  const handleCategoryClick = (catId: string) => {
    if (isDragging) return; // אל תבחר אם גוררים
    
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

  // טיפול בלחיצה ארוכה (למובייל)
  const handleTouchStart = (catId: string, e: React.TouchEvent) => {
    if (catId === 'all') return;
    
    longPressTimer.current = setTimeout(() => {
      setIsDragging(true);
      setDraggedCat(catId);
      navigator.vibrate?.(50); // רטט קל
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (isDragging && draggedCat && dragOverCat && draggedCat !== dragOverCat) {
      handleReorder(draggedCat, dragOverCat);
    }
    
    setIsDragging(false);
    setDraggedCat(null);
    setDragOverCat(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !draggedCat) return;
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const catElement = element?.closest('[data-category-id]') as HTMLElement;
    
    if (catElement) {
      const catId = catElement.dataset.categoryId;
      if (catId && catId !== 'all') {
        setDragOverCat(catId);
      }
    }
  };

  // Drag & Drop למחשב
  const handleDragStart = (catId: string, e: React.DragEvent) => {
    if (catId === 'all') {
      e.preventDefault();
      return;
    }
    setDraggedCat(catId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (catId: string, e: React.DragEvent) => {
    if (catId === 'all' || !draggedCat) return;
    e.preventDefault();
    setDragOverCat(catId);
  };

  const handleDrop = (catId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedCat && catId !== 'all' && draggedCat !== catId) {
      handleReorder(draggedCat, catId);
    }
    setDraggedCat(null);
    setDragOverCat(null);
    setIsDragging(false);
  };

  const handleReorder = (fromId: string, toId: string) => {
    if (!onReorderCategories) return;
    
    const fromIndex = categories.findIndex(c => c.id === fromId);
    const toIndex = categories.findIndex(c => c.id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const newCategories = [...categories];
    const [movedCat] = newCategories.splice(fromIndex, 1);
    newCategories.splice(toIndex, 0, movedCat);
    
    // עדכון order
    const reordered = newCategories.map((cat, idx) => ({
      ...cat,
      order: idx
    }));
    
    onReorderCategories(reordered);
  };

  const commonEmojis = ['🥬', '🥩', '🧀', '🍞', '🧂', '🥫', '🍬', '🧴', '🧻', '🧊'];

  // סינון "הכל" מהקטגוריות שמגיעות והוספתו בהתחלה
  const filteredCategories = categories.filter(c => c.id !== 'all');
  const allCategories = [
    { id: 'all', name: 'הכל', emoji: '🛒', color: '' },
    ...filteredCategories
  ];

  return (
    <div className="relative">
      {/* הנחיה לגרירה */}
      {isDragging && (
        <div className="absolute top-full left-0 right-0 bg-blue-500 text-white text-xs font-bold py-2 px-4 text-center z-50">
          📍 גרור לשינוי סדר הקטגוריות
        </div>
      )}

      {/* קטגוריות */}
      <div 
        ref={scrollRef}
        className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide scroll-smooth"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {allCategories.map(cat => {
          const count = itemCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          const isEditing = editingCat === cat.id;
          const isBeingDragged = draggedCat === cat.id;
          const isDragOver = dragOverCat === cat.id;
          
          if (isEditing && cat.id !== 'all') {
            return (
              <div key={cat.id} className="flex-shrink-0 flex items-center gap-1 bg-white rounded-xl px-2 py-1">
                <span className="text-base">{cat.emoji}</span>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEditCategory(cat.id)}
                  onBlur={() => handleEditCategory(cat.id)}
                  className="w-24 px-2 py-1 text-sm border-b border-rose-300 focus:outline-none"
                  autoFocus
                />
              </div>
            );
          }
          
          return (
            <div 
              key={cat.id} 
              className="relative flex-shrink-0 group"
              data-category-id={cat.id}
              draggable={cat.id !== 'all'}
              onDragStart={(e) => handleDragStart(cat.id, e)}
              onDragOver={(e) => handleDragOver(cat.id, e)}
              onDrop={(e) => handleDrop(cat.id, e)}
              onDragEnd={() => {
                setDraggedCat(null);
                setDragOverCat(null);
                setIsDragging(false);
              }}
            >
              <button
                onClick={() => handleCategoryClick(cat.id)}
                onTouchStart={(e) => handleTouchStart(cat.id, e)}
                className={`
                  px-4 py-1.5 rounded-xl font-bold text-sm transition-all duration-200
                  flex items-center gap-1.5 whitespace-nowrap relative
                  ${isSelected
                    ? 'bg-white text-rose-500 shadow-md scale-105'
                    : 'bg-white/30 text-white hover:bg-white/50 active:scale-95'
                  }
                  ${isBeingDragged ? 'opacity-50 scale-95' : ''}
                  ${isDragOver && !isBeingDragged ? 'ring-2 ring-blue-400' : ''}
                `}
              >
                <span className="text-base">{cat.emoji}</span>
                <span>{cat.name}</span>
                {count > 0 && (
                  <span className={`
                    px-1.5 py-0.5 rounded-md text-xs font-bold
                    ${isSelected 
                      ? 'bg-rose-50 text-rose-500' 
                      : 'bg-white/40 text-white'
                    }
                  `}>
                    {count}
                  </span>
                )}
              </button>
              
              {/* אפשרויות עריכה/מחיקה - דסקטופ (hover) */}
              {cat.id !== 'all' && (
                <div className="hidden md:flex absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCat(cat.id);
                      setEditName(cat.name);
                    }}
                    className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs hover:scale-110 transition-all shadow-md"
                    title="ערוך שם"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.id);
                    }}
                    className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:scale-110 transition-all shadow-md"
                    title="מחק קטגוריה"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
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

      {/* מודל אפשרויות קטגוריה - מובייל (דאבל קליק) */}
      {showOptionsFor && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowOptionsFor(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-[scale-in_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">
              {categories.find(c => c.id === showOptionsFor)?.emoji} {categories.find(c => c.id === showOptionsFor)?.name}
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setEditingCat(showOptionsFor);
                  setEditName(categories.find(c => c.id === showOptionsFor)?.name || '');
                  setShowOptionsFor(null);
                }}
                className="w-full px-6 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>✏️</span>
                <span>ערוך שם</span>
              </button>
              
              <button
                onClick={() => handleDeleteCategory(showOptionsFor)}
                className="w-full px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>מחק קטגוריה</span>
              </button>
              
              <button
                onClick={() => setShowOptionsFor(null)}
                className="w-full px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 active:scale-95 transition-all"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">בחר אייקון</label>
                
                {recentEmojis.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-2">לאחרונה:</div>
                    <div className="grid grid-cols-8 gap-2">
                      {recentEmojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewCatEmoji(emoji)}
                          className={`
                            w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all
                            ${newCatEmoji === emoji 
                              ? 'bg-rose-100 ring-2 ring-rose-400 scale-110' 
                              : 'bg-gray-100 hover:bg-gray-200 active:scale-95'
                            }
                          `}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 mb-2">פופולריים:</div>
                <div className="grid grid-cols-8 gap-2">
                  {commonEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewCatEmoji(emoji)}
                      className={`
                        w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all
                        ${newCatEmoji === emoji 
                          ? 'bg-rose-100 ring-2 ring-rose-400 scale-110' 
                          : 'bg-gray-100 hover:bg-gray-200 active:scale-95'
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
                    flex-1 px-6 py-3 rounded-xl font-bold transition-all
                    ${newCatName.trim()
                      ? 'bg-gradient-to-l from-rose-400 to-pink-400 text-white hover:shadow-lg active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  הוסף
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold transition-all active:scale-95"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}