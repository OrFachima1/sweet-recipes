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
  const menuRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = startX.current - currentX;
    
    // גלילה לשמאל (ערכים חיוביים)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    
    if (swipeOffset > 80 && onDelete) {
      // מחיקה אוטומטית עם אישור
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

  // סגירת תפריט בלחיצה מחוץ
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="relative">
      {/* רקע אדום למחיקה */}
      {swipeOffset > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-end px-6"
          style={{
            background: `linear-gradient(90deg, 
              rgba(239, 68, 68, ${Math.min(swipeOffset / 120, 1) * 0.3}) 0%, 
              rgba(239, 68, 68, ${Math.min(swipeOffset / 120, 1)}) 100%)`
          }}
        >
          <div 
            className="flex items-center gap-2 text-white font-bold transition-all"
            style={{
              opacity: Math.min(swipeOffset / 80, 1),
              transform: `scale(${Math.min(swipeOffset / 80, 1)})`
            }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
            </svg>
            <span>{swipeOffset > 80 ? 'שחרר למחיקה' : 'החלק למחיקה'}</span>
          </div>
        </div>
      )}

      {/* התוכן */}
      <div 
        className={`
          relative flex items-center gap-3 px-4 py-3 transition-all bg-white
          ${isChecked ? 'bg-emerald-50/80' : 'hover:bg-rose-50/30'}
        `}
        style={{
          transform: `translateX(-${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* צ'קבוקס */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          className={`
            flex-shrink-0 w-7 h-7 rounded-lg border-2 transition-all flex items-center justify-center
            ${isChecked 
              ? 'bg-emerald-500 border-emerald-500' 
              : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50'
            }
          `}
        >
          {isChecked && (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* פרטי המוצר */}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-gray-800 text-base transition-all ${isChecked ? 'line-through opacity-60' : ''}`}>
            {name}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {qty > 0 && (
              <span className="font-medium">
                {qty.toFixed(2).replace(/\.?0+$/, '')} {unit}
              </span>
            )}
            {isManual && (
              <span className="mr-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                ידני
              </span>
            )}
          </div>
        </div>

        {/* תפריט שלוש נקודות */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-9 h-9 rounded-xl hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="אפשרויות"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>

          {/* תפריט נפתח */}
          {showMenu && (
            <div className="absolute left-0 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 min-w-[220px] max-h-[70vh] overflow-y-auto">
              <div className="text-xs font-bold text-gray-500 px-4 py-2 border-b border-gray-100">
                העבר לקטגוריה
              </div>
              <div className="py-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeCategory(cat.id);
                      setShowMenu(false);
                    }}
                    className="w-full text-right px-4 py-2.5 hover:bg-rose-50 active:bg-rose-100 transition-colors flex items-center gap-3 group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">{cat.emoji}</span>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-rose-700">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
              
              {onDelete && (
                <>
                  <div className="h-px bg-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick();
                    }}
                    className="w-full text-right px-4 py-2.5 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3 text-red-600 font-semibold text-sm group"
                  >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
                    </svg>
                    <span>מחק פריט</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}