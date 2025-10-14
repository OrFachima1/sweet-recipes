import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SortableCategoryProps {
  cat: Category;
  isSelected: boolean;
  isReorderMode: boolean;
  itemCount: number;
  onTap: () => void;
  onLongPress: () => void;
  onOptions: () => void;
}

function SortableCategory({ cat, isSelected, isReorderMode, itemCount, onTap, onLongPress, onOptions }: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled: !isReorderMode });

  const longPressTimer = useRef<number | null>(null);
  const [isPressing, setIsPressing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isReorderMode) return;
    setIsPressing(true);
    longPressTimer.current = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      onLongPress();
      setIsPressing(false);
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isPressing && !isReorderMode) {
      onTap();
    }
    setIsPressing(false);
  };

  const handlePointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
      className="relative flex-shrink-0"
    >
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isReorderMode) onOptions();
        }}
        className={`w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none touch-none ${
          isSelected && !isReorderMode
            ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg scale-105'
            : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
        } ${isReorderMode ? 'wobble-active cursor-grab active:cursor-grabbing' : ''} ${
          isDragging ? 'scale-110 shadow-2xl' : ''
        } ${isPressing ? 'scale-95' : ''}`}
      >
        <div className="w-14 h-14 flex items-center justify-center mb-1" style={{ fontSize: '40px', lineHeight: '1' }}>
          {cat.emoji}
        </div>
        <div className="text-sm font-medium text-center leading-tight min-h-8 flex items-center px-1">
          {cat.name}
        </div>
        <div className="text-xs opacity-75 h-4 flex items-center justify-center">
          {itemCount}
        </div>
      </button>

      {isReorderMode && (
        <button
          onClick={onOptions}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 z-10"
        >
          ×
        </button>
      )}
    </div>
  );
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [previousOrder, setPreviousOrder] = useState<Category[]>([]);
  const undoTimer = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

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

  const handleLongPress = () => {
    setIsReorderMode(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const allCats = filteredCategories;
      const oldIndex = allCats.findIndex((c) => c.id === active.id);
      const newIndex = allCats.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Save for undo
        setPreviousOrder([...categories]);
        
        const reordered = arrayMove(allCats, oldIndex, newIndex).map((cat, idx) => ({
          ...cat,
          order: idx
        }));

        // Add back the 'all' category
        const allCategory = categories.find(c => c.id === 'all');
        const finalOrder = allCategory ? [allCategory, ...reordered] : reordered;

        if (onReorderCategories) {
          onReorderCategories(finalOrder);
        }

        // Show undo
        setShowUndo(true);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        undoTimer.current = window.setTimeout(() => {
          setShowUndo(false);
          setPreviousOrder([]);
        }, 8000);

        if (navigator.vibrate) navigator.vibrate(20);
      }
    }

    setActiveId(null);
  };

  const handleUndo = () => {
    if (previousOrder.length > 0 && onReorderCategories) {
      onReorderCategories(previousOrder);
      setShowUndo(false);
      setPreviousOrder([]);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (navigator.vibrate) navigator.vibrate(30);
    }
  };

  const handleFinishReorder = () => {
    setIsReorderMode(false);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const commonEmojis = ['🥬', '🥩', '🧀', '🍞', '🧂', '🥫', '🧴', '🧻', '🧊', '🍎', '🥕', '🍟', '🗒', '🥛', '🍳', '🌶️'];

  const filteredCategories = categories.filter(c => {
    if (c.id === 'all') return false;
    const count = itemCounts[c.id] || 0;
    return count > 0;
  });
  
  const allCategory = { id: 'all', name: 'הכל', emoji: '🛒', color: '' };
  const activeCat = activeId ? filteredCategories.find(c => c.id === activeId) : null;

  return (
    <div className="relative">
      {isReorderMode && (
        <div className="flex justify-center mb-3 px-2">
          <button
            onClick={handleFinishReorder}
            className="px-6 py-2 rounded-full bg-rose-500 text-white shadow-lg font-bold hover:bg-rose-600 active:scale-95 transition-all animate-pulse"
          >
            ✓ סיום
          </button>
        </div>
      )}

      <style>{`
        @keyframes wobble {
          0% { transform: rotate(-2deg); }
          25% { transform: rotate(2deg); }
          50% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }

        .wobble-active {
          animation: wobble 0.35s ease-in-out infinite !important;
          transform-origin: center center !important;
        }

        .wobble-active:nth-of-type(1) { animation-delay: 0s !important; }
        .wobble-active:nth-of-type(2) { animation-delay: 0.05s !important; }
        .wobble-active:nth-of-type(3) { animation-delay: 0.1s !important; }
        .wobble-active:nth-of-type(4) { animation-delay: 0.15s !important; }
        .wobble-active:nth-of-type(5) { animation-delay: 0.2s !important; }
        .wobble-active:nth-of-type(6) { animation-delay: 0.25s !important; }
        .wobble-active:nth-of-type(7) { animation-delay: 0.3s !important; }
      `}</style>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2 overflow-x-auto pb-4 px-2 scrollbar-hide justify-center select-none">
          <button
            onPointerDown={(e) => {
              if (!isReorderMode) {
                e.currentTarget.classList.add('scale-95');
              }
            }}
            onPointerUp={(e) => {
              if (!isReorderMode) {
                e.currentTarget.classList.remove('scale-95');
                onSelectCategory(allCategory.id);
              }
            }}
            onPointerCancel={(e) => e.currentTarget.classList.remove('scale-95')}
            disabled={isReorderMode}
            className={`flex-shrink-0 w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl transition-all select-none ${
              selectedCategory === allCategory.id && !isReorderMode
                ? 'bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg scale-105'
                : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm'
            } ${isReorderMode ? 'opacity-50 cursor-not-allowed' : ''}`}
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

          <SortableContext items={filteredCategories.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {filteredCategories.map((cat) => (
              <SortableCategory
                key={cat.id}
                cat={cat}
                isSelected={selectedCategory === cat.id}
                isReorderMode={isReorderMode}
                itemCount={itemCounts[cat.id] || 0}
                onTap={() => onSelectCategory(cat.id)}
                onLongPress={handleLongPress}
                onOptions={() => setShowOptionsFor(cat.id)}
              />
            ))}
          </SortableContext>

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

        <DragOverlay>
          {activeCat ? (
            <div className="w-24 h-28 flex flex-col items-center justify-center p-2 rounded-2xl bg-white shadow-2xl scale-110 opacity-90">
              <div className="w-14 h-14 flex items-center justify-center mb-1" style={{ fontSize: '40px', lineHeight: '1' }}>
                {activeCat.emoji}
              </div>
              <div className="text-sm font-medium text-center leading-tight min-h-8 flex items-center px-1">
                {activeCat.name}
              </div>
              <div className="text-xs opacity-75 h-4 flex items-center justify-center">
                {itemCounts[activeCat.id] || 0}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showUndo && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-slide-up">
          <span className="text-sm font-medium">סידור בוצע</span>
          <button
            onClick={handleUndo}
            className="px-4 py-1 bg-rose-500 hover:bg-rose-600 rounded-full text-sm font-bold active:scale-95 transition-all"
          >
            ביטול
          </button>
        </div>
      )}

      {showOptionsFor && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowOptionsFor(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-slide-up"
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
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-scale-in"
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
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in"
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

        .select-none {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-touch-callout: none;
        }

        .touch-none {
          touch-action: none;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}