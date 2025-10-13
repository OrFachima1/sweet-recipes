"use client";
import React, { useState } from 'react';

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
  onUpdateCategory: (id: string, name: string, emoji: string) => void;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const handleDoubleClick = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditEmoji(cat.emoji);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdateCategory(editingId, editName, editEmoji);
      setEditingId(null);
    }
  };

  const handleAddCategory = () => {
    const name = prompt('שם קטגוריה חדשה:');
    const emoji = prompt('אימוג׳י (אופציונלי):') || '📌';
    
    if (name?.trim()) {
      const newCat: Category = {
        id: `custom_${Date.now()}`,
        name: name.trim(),
        emoji: emoji,
        color: 'from-purple-100 to-pink-100'
      };
      onAddCategory(newCat);
    }
  };

  return (
    <div className="relative">
      {/* אינדיקטור סוויפ במובייל */}
      <div className="sm:hidden text-center py-2 text-xs text-gray-400 flex items-center justify-center gap-2">
        <span>←</span>
        <span>החלק לניווט בין קטגוריות</span>
        <span>→</span>
      </div>
      
      <div className="overflow-x-auto pb-2 px-4 scrollbar-hide" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div 
          className="flex gap-2 min-w-max"
          style={{ 
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {categories.map(cat => {
            const count = itemCounts[cat.id] || 0;
            const isEditing = editingId === cat.id;
            const isActive = selectedCategory === cat.id;
            
            if (isEditing) {
              return (
                <div key={cat.id} className="flex gap-1 bg-white px-2 py-1 rounded-full shadow-lg" style={{ scrollSnapAlign: 'start' }}>
                  <input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="w-8 text-center text-sm border rounded"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-24 text-sm border rounded px-2"
                    autoFocus
                  />
                  <button onClick={saveEdit} className="text-green-600 font-bold px-2">✓</button>
                  <button onClick={() => setEditingId(null)} className="text-red-600 font-bold px-2">✗</button>
                </div>
              );
            }

            return (
              <div key={cat.id} className="relative group" style={{ scrollSnapAlign: 'start' }}>
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  onDoubleClick={() => handleDoubleClick(cat)}
                  className={`
                    relative px-3 sm:px-6 py-2 sm:py-3 rounded-t-2xl font-bold transition-all duration-300 flex flex-col sm:flex-row items-center gap-1 sm:gap-2 min-w-[100px] sm:min-w-[140px]
                    ${isActive 
                      ? 'bg-white shadow-lg -mb-px z-10 scale-105' 
                      : 'bg-blue-100/50 hover:bg-blue-100 shadow-sm'
                    }
                  `}
                  style={{
                    transform: isActive ? 'translateY(2px)' : 'none'
                  }}
                >
                  <span className="text-xl sm:text-2xl">{cat.emoji}</span>
                  <div className="flex flex-col sm:flex-row items-center gap-1">
                    <span 
                      className={`text-lg sm:text-2xl text-center leading-tight ${isActive ? 'text-gray-800' : 'text-gray-600'}`}
                      style={{ 
                        fontFamily: 'MyHandwriting, Arial',
                        WebkitFontSmoothing: 'antialiased'
                      }}
                    >
                      {cat.name}
                    </span>
                    {count > 0 && (
                      <span className={`
                        px-1.5 sm:px-2 py-0.5 rounded-full text-xs sm:text-sm font-bold
                        ${isActive ? 'bg-blue-500 text-white' : 'bg-blue-200 text-blue-700'}
                      `}>
                        {count}
                      </span>
                    )}
                  </div>
                </button>
                
                {cat.id !== 'all' && cat.id !== 'other' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`למחוק את הקטגוריה "${cat.name}"?`)) {
                        onDeleteCategory(cat.id);
                      }
                    }}
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity z-20"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleAddCategory}
            className="px-3 sm:px-6 py-2 sm:py-3 rounded-t-2xl bg-gradient-to-l from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 shadow-sm flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all min-w-[100px] sm:min-w-[140px]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <span className="text-xl sm:text-2xl">➕</span>
            <span className="text-lg sm:text-2xl text-gray-700 font-bold text-center leading-tight" style={{ 
              fontFamily: 'MyHandwriting, Arial',
              WebkitFontSmoothing: 'antialiased'
            }}>
              הוסף
            </span>
          </button>
        </div>
      </div>

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