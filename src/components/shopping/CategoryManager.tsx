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
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const [tempOrder, setTempOrder] = useState<Category[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTapTime = useRef<number>(0);
  const lastTapCat = useRef<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedCat, setDraggedCat] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

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

  const handleCategoryClick = (catId: string) => {
    if (isEditMode) return;
    
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

  const enterEditMode = () => {
    setIsEditMode(true);
    setTempOrder(filteredCategories);
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
  };

  const exitEditMode = (save: boolean) => {
    if (save && onReorderCategories && tempOrder.length > 0) {
      const reordered = tempOrder.map((cat, idx) => ({
        ...cat,
        order: idx
      }));
      onReorderCategories(reordered);
    }
    setIsEditMode(false);
    setDraggedCat(null);
    setDragOverCat(null);
    setTempOrder([]);
  };

  const handleTouchStart = (catId: string, e: React.TouchEvent) => {
    if (!isEditMode && catId !== 'all') {
      e.preventDefault();
      
      longPressTimer.current = setTimeout(() => {
        enterEditMode();
      }, 400);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
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
    if (!draggedCat || catId === 'all') return;
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
    
    const fromIndex = filteredCategories.findIndex(c => c.id === fromId);
    const toIndex = filteredCategories.findIndex(c => c.id === toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const newCategories = [...filteredCategories];
    const [movedCat] = newCategories.splice(fromIndex, 1);
    newCategories.splice(toIndex, 0, movedCat);
    
    const reordered = newCategories.map((cat, idx) => ({
      ...cat,
      order: idx
    }));
    
    onReorderCategories(reordered);
  };

  // הזזה שמאלה (החלפה עם הקטגוריה הימנית)
  const moveLeft = (catId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    const currentIndex = tempOrder.findIndex(c => c.id === catId);
    if (currentIndex < tempOrder.length - 1) {
      const newOrder = [...tempOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setTempOrder(newOrder);
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  // הזזה ימינה (החלפה עם הקטגוריה השמאלית)
  const moveRight = (catId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    const currentIndex = tempOrder.findIndex(c => c.id === catId);
    if (currentIndex > 0) {
      const newOrder = [...tempOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setTempOrder(newOrder);
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  const commonEmojis = ['🥬', '🥩', '🧀', '🍞', '🧂', '🥫', '🬬', '🧴', '🧻', '🧊'];

  const filteredCategories = categories.filter(c => c.id !== 'all');
  const workingCategories = isEditMode && tempOrder.length > 0 ? tempOrder : filteredCategories;
  
  const allCategories = [
    ...workingCategories,
    { id: 'all', name: 'הכל', emoji: '🛒', color: '' }
  ];

  return (
    <div className="relative">
      {/* סרגל מצב עריכה */}
      {isEditMode && (
        <div className="absolute top-full left-0 right-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 z-50 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔀</span>
            <span className="text-sm font-bold">לחץ על החצים לשינוי סדר</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exitEditMode(false)}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 font-bold text-sm transition-all active:scale-95"
            >
              ביטול
            </button>
            <button
              onClick={() => exitEditMode(true)}
              className="px-4 py-2 rounded-lg bg-white text-blue-600 hover:bg-blue-50 font-bold text-sm transition-all active:scale-95"
            >
              ✓ סיום
            </button>
          </div>
        </div>
      )}

      {/* קטגוריות */}
      <div 
        ref={scrollRef}
        className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide scroll-smooth"
      >
        {allCategories.map((cat, index) => {
          const count = itemCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          const isEditing = editingCat === cat.id;
          const isFirstInOrder = isEditMode && index === 0;
          const isLastInOrder = isEditMode && index === workingCategories.length - 1;
          
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
              {/* חצים לשינוי סדר - רק במצב עריכה */}
              {isEditMode && cat.id !== 'all' && (
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none z-20">
                  {/* חץ שמאלה */}
                  <button
                    onClick={(e) => moveLeft(cat.id, e)}
                    onTouchEnd={(e) => moveLeft(cat.id, e)}
                    disabled={isLastInOrder}
                    className={`
                      pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center
                      transition-all shadow-md -translate-x-3 text-xs
                      ${isLastInOrder 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                      }
                    `}
                  >
                    ◀
                  </button>
                  
                  {/* חץ ימינה */}
                  <button
                    onClick={(e) => moveRight(cat.id, e)}
                    onTouchEnd={(e) => moveRight(cat.id, e)}
                    disabled={isFirstInOrder}
                    className={`
                      pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center
                      transition-all shadow-md translate-x-3 text-xs
                      ${isFirstInOrder 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                      }
                    `}
                  >
                    ▶
                  </button>
                </div>
              )}
              
              <button
                onClick={() => !isEditMode && handleCategoryClick(cat.id)}
                onTouchStart={(e) => handleTouchStart(cat.id, e)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                style={{ 
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                  animation: isEditMode && cat.id !== 'all' ? 'wiggle 0.3s ease-in-out infinite' : 'none',
                  transform: (draggedCat === cat.id) 
                    ? 'scale(1.15) rotate(3deg)' 
                    : (dragOverCat === cat.id && draggedCat !== cat.id)
                    ? 'translateX(30px)' 
                    : 'none',
                  opacity: (draggedCat === cat.id) ? 0.7 : 1,
                  transition: 'all 0.2s ease-out'
                }}
                className={`
                  px-4 py-1.5 rounded-xl font-bold text-sm transition-all duration-200
                  flex items-center gap-1.5 whitespace-nowrap relative
                  ${isSelected
                    ? 'bg-white text-rose-500 shadow-md scale-105'
                    : 'bg-white/30 text-white hover:bg-white/50 active:scale-95'
                  }
                  ${(draggedCat === cat.id) ? 'opacity-50 scale-95' : ''}
                  ${(dragOverCat === cat.id && draggedCat !== cat.id) ? 'ring-2 ring-blue-400' : ''}
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
              {cat.id !== 'all' && !isEditMode && (
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

      {/* כל שאר המודלים - אותו דבר */}
      
      {/* אנימציות CSS */}
      <style jsx>{`
        @keyframes wiggle {
          0%, 100% { 
            transform: rotate(-1deg); 
          }
          50% { 
            transform: rotate(1deg); 
          }
        }
        
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