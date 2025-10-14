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
  onUpdateCategory: (id: string, name: string, emoji?: string) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
  itemCounts: Record<string, number>;
  totalItems: number;
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
  const lastTapTime = useRef<number>(0);
  const tapCount = useRef<number>(0);
  const tapTimer = useRef<number | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isReorderMode) return;
    setIsPressing(true);
    
    // Long press only for touch
    if (e.pointerType === 'touch') {
      longPressTimer.current = window.setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        onLongPress();
        setIsPressing(false);
        tapCount.current = 0; // Reset tap count
      }, 600);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (!isPressing || isReorderMode) {
      setIsPressing(false);
      return;
    }
    
    // Handle taps/clicks for both touch and mouse
    tapCount.current += 1;
    
    if (tapCount.current === 1) {
      // First tap - wait to see if there's a second one
      tapTimer.current = window.setTimeout(() => {
        // Single tap
        onTap();
        tapCount.current = 0;
      }, 300);
    } else if (tapCount.current === 2) {
      // Double tap detected
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      onOptions();
      tapCount.current = 0;
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

  const gradients = [
    { border: '#667eea', bg: 'rgba(102, 126, 234, 0.1)' },
    { border: '#f093fb', bg: 'rgba(240, 147, 251, 0.1)' },
    { border: '#4facfe', bg: 'rgba(79, 172, 254, 0.1)' },
    { border: '#43e97b', bg: 'rgba(67, 233, 123, 0.1)' },
    { border: '#fa709a', bg: 'rgba(250, 112, 154, 0.1)' },
    { border: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.1)' },
    { border: '#a29bfe', bg: 'rgba(162, 155, 254, 0.1)' },
    { border: '#fd79a8', bg: 'rgba(253, 121, 168, 0.1)' },
  ];

  const gradientIndex = parseInt(cat.id.replace(/\D/g, '')) % gradients.length;
  const colors = gradients[gradientIndex];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex-shrink-0 select-none"
    >
      <div
        {...(isReorderMode ? attributes : {})}
        {...(isReorderMode ? listeners : {})}
        onPointerDown={!isReorderMode ? handlePointerDown : undefined}
        onPointerUp={!isReorderMode ? handlePointerUp : undefined}
        onPointerCancel={!isReorderMode ? handlePointerCancel : undefined}
        onPointerLeave={!isReorderMode ? handlePointerCancel : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isReorderMode) onOptions();
        }}
        className={`relative ${
          isReorderMode ? 'wobble-active cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${isDragging ? 'scale-105' : ''} ${isPressing ? 'scale-95' : ''} 
        transition-transform duration-200 hover:scale-105`}
        style={{ 
          transition: isDragging ? 'none' : 'transform 0.2s ease',
          touchAction: isReorderMode ? 'none' : 'auto'
        }}
      >
        <div className="relative">
          {/* Border ring with gradient */}
          <div 
            className="w-[88px] h-[88px] rounded-full p-[3px] relative"
            style={{
              background: isSelected && !isReorderMode 
                ? `linear-gradient(45deg, ${colors.border}, ${colors.border})` 
                : colors.bg,
              border: isSelected && !isReorderMode 
                ? 'none' 
                : `3px solid ${colors.border}`,
              boxShadow: isSelected && !isReorderMode 
                ? `0 4px 20px ${colors.border}40, 0 0 0 4px ${colors.bg}` 
                : 'none',
            }}
          >
            {/* Inner white circle */}
            <div 
              className="w-full h-full rounded-full bg-white flex items-center justify-center relative overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ fontSize: '42px', lineHeight: '1' }}>
                {cat.emoji}
              </div>
            </div>
          </div>

          {/* Item count badge */}
          <div 
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white font-bold shadow-lg"
            style={{
              background: colors.border,
              fontSize: '13px',
              minWidth: '32px',
              textAlign: 'center',
            }}
          >
            {itemCount}
          </div>
        </div>
      </div>
      
      <div className="text-center mt-3">
        <div className="text-sm font-bold text-gray-800 px-1 max-w-[96px] truncate">
          {cat.name}
        </div>
      </div>

      {isReorderMode && (
        <button
          onClick={onOptions}
          className="absolute top-0 right-0 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 z-20 border-2 border-white"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
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
  itemCounts,
  totalItems  
}: CategoryManagerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📦');
  const [customEmoji, setCustomEmoji] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [showOptionsFor, setShowOptionsFor] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [previousOrder, setPreviousOrder] = useState<Category[]>([]);
  const undoTimer = useRef<number | null>(null);

  const gradients = [
    { border: '#667eea', bg: 'rgba(102, 126, 234, 0.1)' },
    { border: '#f093fb', bg: 'rgba(240, 147, 251, 0.1)' },
    { border: '#4facfe', bg: 'rgba(79, 172, 254, 0.1)' },
    { border: '#43e97b', bg: 'rgba(67, 233, 123, 0.1)' },
    { border: '#fa709a', bg: 'rgba(250, 112, 154, 0.1)' },
    { border: '#ff6b6b', bg: 'rgba(255, 107, 107, 0.1)' },
    { border: '#a29bfe', bg: 'rgba(162, 155, 254, 0.1)' },
    { border: '#fd79a8', bg: 'rgba(253, 121, 168, 0.1)' },
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 50,
        tolerance: 8,
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
      onUpdateCategory(catId, editName, editEmoji || undefined);
      if (editEmoji) {
        saveRecentEmoji(editEmoji);
      }
    }
    setEditingCat(null);
    setEditName('');
    setEditEmoji('');
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
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredCategories.findIndex((c) => c.id === active.id);
      const newIndex = filteredCategories.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setPreviousOrder([...categories]);
        
        const reordered = arrayMove(filteredCategories, oldIndex, newIndex).map((cat, idx) => ({
          ...cat,
          order: idx
        }));

        const allCategory = categories.find(c => c.id === 'all');
        const finalOrder = allCategory ? [allCategory, ...reordered] : reordered;

        if (onReorderCategories) {
          onReorderCategories(finalOrder);
        }

        setShowUndo(true);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        undoTimer.current = window.setTimeout(() => {
          setShowUndo(false);
          setPreviousOrder([]);
        }, 8000);

        if (navigator.vibrate) navigator.vibrate(30);
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
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const commonEmojis = ['🥬', '🥩', '🧀', '🍞', '🧂', '🥫', '🧴', '🧻', '🧊', '🎀', '🥕', '🍟', '🗑️', '🥛', '🍳', '🌶️'];

  const safeItemCounts = itemCounts || {};

  const filteredCategories = categories.filter(c => {
    if (c.id === 'all') return false;
    const count = safeItemCounts[c.id] || 0;
    return count > 0;
  });
  
  const allCategory = { id: 'all', name: 'הכל', emoji: '🛒', color: '' };
  const activeCat = activeId ? filteredCategories.find(c => c.id === activeId) : null;

  const getColorForCategory = (catId: string) => {
    const gradientIndex = parseInt(catId.replace(/\D/g, '')) % gradients.length;
    return gradients[gradientIndex];
  };

  return (
    <div className="relative">
      <style>{`
        @keyframes wobble {
          0% { transform: rotate(-2deg); }
          25% { transform: rotate(2deg); }
          50% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }

        .wobble-active {
          animation: wobble 0.25s ease-in-out infinite !important;
          transform-origin: center center !important;
        }

        .wobble-active:nth-of-type(1) { animation-delay: 0s !important; }
        .wobble-active:nth-of-type(2) { animation-delay: 0.03s !important; }
        .wobble-active:nth-of-type(3) { animation-delay: 0.06s !important; }
        .wobble-active:nth-of-type(4) { animation-delay: 0.09s !important; }
        .wobble-active:nth-of-type(5) { animation-delay: 0.12s !important; }
        .wobble-active:nth-of-type(6) { animation-delay: 0.15s !important; }
        .wobble-active:nth-of-type(7) { animation-delay: 0.18s !important; }
      `}</style>

      {isReorderMode && (
        <div className="flex justify-center mb-4 px-2">
          <button
            onClick={handleFinishReorder}
            className="px-8 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xl font-bold hover:shadow-2xl active:scale-95 transition-all"
            style={{
              boxShadow: '0 10px 25px rgba(244, 63, 94, 0.4)',
            }}
          >
            ✓ סיום
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide justify-center">
          <div className="flex-shrink-0 select-none">
            <div
              onClick={(e) => {
                if (isReorderMode) return;
                onSelectCategory(allCategory.id);
              }}
              className={`relative ${isReorderMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'} transition-transform duration-200`}
              style={{ transition: 'transform 0.2s ease' }}
            >
              <div className="relative">
                <div 
                  className="w-[88px] h-[88px] rounded-full p-[3px] relative"
                  style={{
                    background: selectedCategory === allCategory.id && !isReorderMode
                      ? 'linear-gradient(45deg, #667eea, #764ba2)'
                      : 'rgba(102, 126, 234, 0.1)',
                    border: selectedCategory === allCategory.id && !isReorderMode
                      ? 'none'
                      : '3px solid #667eea',
                    boxShadow: selectedCategory === allCategory.id && !isReorderMode
                      ? '0 4px 20px rgba(102, 126, 234, 0.4), 0 0 0 4px rgba(102, 126, 234, 0.1)'
                      : 'none',
                  }}
                >
                  <div 
                    className="w-full h-full rounded-full bg-white flex items-center justify-center relative overflow-hidden"
                    style={{
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <div style={{ fontSize: '42px', lineHeight: '1' }}>
                      {allCategory.emoji}
                    </div>
                  </div>
                </div>

                <div 
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white font-bold shadow-lg"
                  style={{
                    background: '#667eea',
                    fontSize: '13px',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}
                >
                  {totalItems}  {/* 👈 שנה מהחישוב הישן */}
                </div>
              </div>
            </div>
            <div className="text-center mt-3">
              <div className="text-sm font-bold text-gray-800">
                {allCategory.name}
              </div>
            </div>
          </div>

          <SortableContext items={filteredCategories.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {filteredCategories.map((cat) => (
              <SortableCategory
                key={cat.id}
                cat={cat}
                isSelected={selectedCategory === cat.id}
                isReorderMode={isReorderMode}
                itemCount={safeItemCounts[cat.id] || 0}
                onTap={() => onSelectCategory(cat.id)}
                onLongPress={handleLongPress}
                onOptions={() => setShowOptionsFor(cat.id)}
              />
            ))}
          </SortableContext>

          {!isReorderMode && (
            <div className="flex-shrink-0 select-none">
              <div
                onClick={() => setShowAddModal(true)}
                className="cursor-pointer active:scale-95 hover:scale-105 transition-transform duration-200"
                style={{ transition: 'transform 0.2s ease' }}
              >
                <div className="relative">
                  <div 
                    className="w-[88px] h-[88px] rounded-full p-[3px]"
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '3px dashed #10b981',
                    }}
                  >
                    <div 
                      className="w-full h-full rounded-full bg-white flex items-center justify-center"
                      style={{
                        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ fontSize: '42px', lineHeight: '1', color: '#10b981', fontWeight: 'bold' }}>
                        +
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-3">
                <div className="text-sm font-bold text-gray-800">
                  הוסף
                </div>
              </div>
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCat ? (
            <div className="flex-shrink-0 select-none" style={{ cursor: 'grabbing' }}>
              <div className="relative">
                <div 
                  className="w-[88px] h-[88px] rounded-full p-[3px] shadow-2xl"
                  style={{
                    background: `linear-gradient(45deg, ${getColorForCategory(activeCat.id).border}, ${getColorForCategory(activeCat.id).border})`,
                    transform: 'scale(1.1) rotate(5deg)',
                  }}
                >
                  <div 
                    className="w-full h-full rounded-full bg-white flex items-center justify-center"
                    style={{
                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <div style={{ fontSize: '42px', lineHeight: '1' }}>
                      {activeCat.emoji}
                    </div>
                  </div>
                </div>

                <div 
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white font-bold shadow-lg"
                  style={{
                    background: getColorForCategory(activeCat.id).border,
                    fontSize: '13px',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}
                >
                  {safeItemCounts[activeCat.id] || 0}
                </div>
              </div>
              <div className="text-center mt-3">
                <div className="text-sm font-bold text-gray-800">
                  {activeCat.name}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showUndo && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-slide-up">
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
            <h3 className="text-xl font-bold mb-4 text-gray-800">אפשרויות קטגוריה</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const cat = categories.find(c => c.id === showOptionsFor);
                  if (cat) {
                    setEditingCat(showOptionsFor);
                    setEditName(cat.name);
                    setEditEmoji(cat.emoji);
                  }
                  setShowOptionsFor(null);
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span style={{ fontSize: '20px' }}>✏️</span>
                <span>ערוך קטגוריה</span>
              </button>
              <button
                onClick={() => handleDeleteCategory(showOptionsFor)}
                className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span style={{ fontSize: '20px' }}>🗑️</span>
                <span>מחק קטגוריה</span>
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
          onClick={() => {
            setEditingCat(null);
            setEditName('');
            setEditEmoji('');
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-6 text-gray-800">ערוך קטגוריה</h3>
            
            <div className="space-y-5">
              {/* Category Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקטגוריה</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEditCategory(editingCat)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
                  autoFocus
                />
              </div>

              {/* Emoji Picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">בחר אימוג'י</label>
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                    style={{
                      background: getColorForCategory(editingCat).bg,
                      border: `2px solid ${getColorForCategory(editingCat).border}`,
                    }}
                  >
                    {editEmoji}
                  </div>
                  <input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    placeholder="הדבק אימוג'י..."
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50 focus:border-blue-400 focus:outline-none text-base"
                    maxLength={10}
                  />
                </div>
                
                {/* Recent Emojis */}
                {recentEmojis.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">אימוג'ים אחרונים</p>
                    <div className="grid grid-cols-10 gap-2">
                      {recentEmojis.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditEmoji(emoji)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                            editEmoji === emoji 
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

                {/* Common Emojis */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">אימוג'ים פופולריים</p>
                  <div className="grid grid-cols-8 gap-2">
                    {commonEmojis.map((emoji, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          editEmoji === emoji 
                            ? 'bg-rose-100 ring-2 ring-rose-400 scale-110' 
                            : 'bg-gray-100 hover:bg-gray-200 active:scale-95'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => {
                  setEditingCat(null);
                  handleDeleteCategory(editingCat);
                }}
                className="w-full py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span style={{ fontSize: '18px' }}>🗑️</span>
                <span>מחק קטגוריה</span>
              </button>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleEditCategory(editingCat)}
                  disabled={!editName.trim()}
                  className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 שמור שינויים
                </button>
                <button
                  onClick={() => {
                    setEditingCat(null);
                    setEditName('');
                    setEditEmoji('');
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