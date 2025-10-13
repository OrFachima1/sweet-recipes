import React, { useState, useRef } from 'react';
import type { Category } from './CategoryManager';

interface ShoppingItemProps {
  name: string;
  qty: number;
  unit: string;
  isManual: boolean;
  isChecked: boolean;
  categories: Category[];
  onToggleCheck: () => void;
  onChangeCategory: (catId: string) => void;
  onDelete?: () => void;
}

export default function ShoppingItem({
  name,
  qty,
  unit,
  isManual,
  isChecked,
  categories,
  onToggleCheck,
  onChangeCategory,
  onDelete
}: ShoppingItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // רק גלילה לימין (ערכים חיוביים)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    
    if (swipeOffset > 80 && onDelete) {
      // שאלת אישור
      if (confirm(`האם למחוק את "${name}"?`)) {
        onDelete();
      }
    }
    
    setSwipeOffset(0);
  };

  const handleDeleteClick = () => {
    if (onDelete && confirm(`האם למחוק את "${name}"?`)) {
      onDelete();
      setShowMenu(false);
    }
  };

  const deleteProgress = Math.min(swipeOffset / 120, 1);

  return (
    <div className="relative group overflow-hidden">
      {/* רקע אדום למחיקה - רק במובייל */}
      {swipeOffset > 0 && (
        <div 
          className="absolute inset-0 bg-gradient-to-l from-red-500 to-red-400 flex items-center justify-start px-6"
          style={{
            opacity: deleteProgress,
          }}
        >
          <div className="flex items-center gap-2 text-white font-bold">
            <span className="text-2xl">🗑️</span>
            <span className="text-lg">
              {swipeOffset > 80 ? 'שחרר למחיקה' : 'החלק למחיקה'}
            </span>
          </div>
        </div>
      )}

      {/* התוכן */}
      <div 
        className={`
          relative flex items-center gap-3 px-4 py-2.5 transition-all duration-200 bg-white
          ${isChecked ? 'bg-emerald-50' : 'hover:bg-rose-50/30'}
          cursor-pointer
        `}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // קליק על השורה בדסקטופ = toggle checkbox
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'SPAN') {
            onToggleCheck();
          }
        }}
      >
        {/* צ'קבוקס */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          className={`
            flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center 
            transition-all duration-200 hover:scale-110 active:scale-90
            ${isChecked 
              ? 'bg-emerald-500 border-emerald-600' 
              : 'border-gray-300 bg-white hover:border-rose-400 active:border-rose-300'
            }
          `}
        >
          {isChecked && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן - שם בימין כמות בשמאל */}
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          {/* שם המוצר */}
          <span className={`
            text-base font-semibold truncate transition-all duration-200
            ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}
          `}>
            {name}
          </span>
          
          {/* כמות */}
          <span className={`
            text-base font-bold whitespace-nowrap flex-shrink-0
            ${isChecked ? 'text-gray-400' : 'text-rose-500'}
          `}>
            {qty} {unit}
          </span>
        </div>

        {/* תגית ידני */}
        {isManual && (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-md bg-pink-100 text-pink-600 font-semibold">
            ידני
          </span>
        )}

        {/* תפריט 3 נקודות */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-90"
            title="אפשרויות"
          >
            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>

          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute left-0 top-10 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 py-2 z-50 min-w-[200px]">
                {/* קטגוריות */}
                <div className="text-xs font-bold text-gray-500 px-3 py-1.5">העבר לקטגוריה</div>
                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeCategory(cat.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-rose-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    </button>
                  ))}
                </div>
                
                {/* מחיקה */}
                {onDelete && (
                  <>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick();
                      }}
                      className="w-full text-right px-3 py-2.5 hover:bg-red-50 transition-colors flex items-center gap-2 text-red-600 font-semibold text-sm"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>מחק פריט</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}