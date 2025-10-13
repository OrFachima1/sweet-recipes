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
  const containerRef = useRef<HTMLDivElement>(null);

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
      // אנימציית מחיקה
      const deleteAnimation = async () => {
        // הזזה מלאה לשמאל
        setSwipeOffset(window.innerWidth);
        
        // המתן לסיום האנימציה
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // מחיקה
        if (confirm(`האם למחוק את "${name}"?`)) {
          onDelete();
        } else {
          setSwipeOffset(0);
        }
      };
      
      deleteAnimation();
    } else {
      setSwipeOffset(0);
    }
  };

  const handleDeleteClick = () => {
    if (onDelete && confirm(`האם למחוק את "${name}"?`)) {
      onDelete();
      setShowMenu(false);
    }
  };

  const handleCategoryChange = (catId: string) => {
    console.log('Changing category to:', catId);
    onChangeCategory(catId);
    setShowMenu(false);
  };

  // סגירת תפריט בלחיצה מחוץ
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  return (
    <div className="relative" ref={containerRef} style={{ zIndex: showMenu ? 100 : 1 }}>
      {/* רקע אדום למחיקה */}
      <div 
        className="absolute inset-0 flex items-center justify-end px-6 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, 
            rgba(220, 38, 38, ${Math.min(swipeOffset / 120, 1) * 0.3}) 0%,
            rgba(239, 68, 68, ${Math.min(swipeOffset / 120, 1)}) 100%)`,
          opacity: swipeOffset > 0 ? 1 : 0,
          transition: isSwiping ? 'none' : 'opacity 0.3s'
        }}
      >
        <div 
          className="flex items-center gap-3 text-white font-bold text-base"
          style={{
            opacity: Math.min(swipeOffset / 60, 1),
            transform: `scale(${Math.min(0.8 + (swipeOffset / 120) * 0.2, 1)})`
          }}
        >
          <span>{swipeOffset > 80 ? 'שחרר למחיקה' : 'החלק למחיקה'}</span>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* התוכן */}
      <div 
        className={`
          relative flex items-center gap-3 px-4 py-3.5 transition-all bg-white
          ${isChecked ? 'bg-emerald-50/80' : 'hover:bg-rose-50/30'}
        `}
        style={{
          transform: `translateX(-${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          opacity: swipeOffset > 120 ? 0 : 1
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
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <div className={`font-semibold text-gray-800 text-base transition-all truncate ${isChecked ? 'line-through opacity-60' : ''}`}>
            {name}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {qty > 0 && (
              <span className={`text-base font-bold whitespace-nowrap ${isChecked ? 'text-gray-400' : 'text-rose-500'}`}>
                {qty.toFixed(2).replace(/\.?0+$/, '')} {unit}
              </span>
            )}
            {isManual && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                ידני
              </span>
            )}
          </div>
        </div>

        {/* כפתור תפריט */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="flex-shrink-0 w-10 h-10 rounded-xl hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="אפשרויות"
          >
            <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2.5"/>
              <circle cx="12" cy="12" r="2.5"/>
              <circle cx="12" cy="19" r="2.5"/>
            </svg>
          </button>

          {/* התפריט */}
          {showMenu && (
            <>
              {/* רקע שקוף */}
              <div 
                className="fixed inset-0 z-[90]"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              
              {/* התפריט עצמו - absolute ביחס לכפתור */}
              <div 
                className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[100] min-w-[200px] max-h-[400px] overflow-y-auto"
                style={{
                  animation: 'slideDown 0.15s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs font-bold text-gray-500 px-4 py-2 border-b border-gray-100">
                  העבר לקטגוריה
                </div>
                
                <div className="py-1">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCategoryChange(cat.id);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCategoryChange(cat.id);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCategoryChange(cat.id);
                      }}
                      className="w-full text-right px-4 py-2.5 hover:bg-rose-50 active:bg-rose-100 transition-colors flex items-center gap-3 group"
                    >
                      <span className="text-lg group-hover:scale-110 transition-transform">{cat.emoji}</span>
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClick();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClick();
                      }}
                      className="w-full text-right px-4 py-3 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3 text-red-600 font-semibold text-sm group"
                    >
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
                      </svg>
                      <span>מחק פריט</span>
                    </button>
                  </>
                )}
              </div>

              <style jsx>{`
                @keyframes slideDown {
                  from {
                    opacity: 0;
                    transform: translateY(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
            </>
          )}
        </div>
      </div>
    </div>
  );
}