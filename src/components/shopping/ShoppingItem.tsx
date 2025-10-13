import React, { useState, useRef } from 'react';
import type { Category } from './CategoryManager';

interface ShoppingItemProps {
  name: string;
  qty: number;
  unit: string;
  isManual: boolean;
  isChecked: boolean;
  categories: Category[];
  sources: string[];
  currentCategory?: string;
  selectedCategory: string;
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
  sources,
  currentCategory,
  selectedCategory,
  onToggleCheck,
  onChangeCategory,
  onDelete
}: ShoppingItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleting) return;
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || isDeleting) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current; // חיובי = ימינה
    
    if (diff > 0) {
      if (Math.abs(diff) > 10) {
        e.preventDefault();
      }
      setSwipeOffset(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    if (isDeleting) return;
    setIsSwiping(false);
    
    if (swipeOffset > 80 && onDelete) {
      if (confirm(`האם למחוק את "${name}"?`)) {
        setIsDeleting(true);
        setSwipeOffset(window.innerWidth);
        setTimeout(() => {
          onDelete();
        }, 300);
      } else {
        setSwipeOffset(0);
      }
    } else {
      setSwipeOffset(0);
    }
  };

  const handleDeleteClick = () => {
    if (onDelete && confirm(`האם למחוק את "${name}"?`)) {
      setIsDeleting(true);
      setTimeout(() => {
        onDelete();
      }, 200);
      setShowMenu(false);
    }
  };

  const handleCategoryChange = (catId: string) => {
    onChangeCategory(catId);
    setShowMenu(false);
  };

  const filteredCategories = categories.filter(c => c.id !== 'all');
  
  const categoryEmoji = categories.find(c => c.id === currentCategory)?.emoji;
  const showCategoryEmoji = selectedCategory === 'all' && categoryEmoji;

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

  if (isDeleting) {
    return null;
  }

  return (
    <div 
      className="relative" 
      ref={containerRef} 
      style={{ zIndex: showMenu ? 50 : 'auto' }}
    >
      {/* רקע אדום מאחורי הכרטיס */}
      {swipeOffset > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-start px-6 rounded-2xl transition-colors duration-200"
          style={{ 
            background: swipeOffset > 80 ? '#ef4444' : '#fca5a5'
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🗑️</span>
            <span className="text-white font-bold text-lg">
              {swipeOffset > 80 ? 'שחרר למחיקה' : 'החלק ימינה'}
            </span>
          </div>
        </div>
      )}

      {/* הכרטיס עצמו */}
      <div
        className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
          isChecked ? 'opacity-60' : ''
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onToggleCheck}
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              isChecked
                ? 'bg-gradient-to-br from-rose-500 to-pink-500 border-rose-500'
                : 'border-gray-300 hover:border-rose-400'
            }`}
          >
            {isChecked && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1">
              <div className={`font-medium ${isChecked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {name}
              </div>
              <div className="text-sm text-gray-500">
                {qty} {unit}
                {isManual && <span className="text-xs text-rose-500 mr-2">(ידני)</span>}
              </div>
            </div>
            
            {showCategoryEmoji && (
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-xl bg-gray-50 rounded-lg">
                {categoryEmoji}
              </div>
            )}
          </div>

          {sources && sources.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSources(!showSources);
              }}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                showSources 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
              }`}
              title="הצג מקורות"
            >
              <span className="text-sm font-bold">?</span>
            </button>
          )}

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

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[90]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                
                <div 
                  className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[100] min-w-[200px] max-h-[400px] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-bold text-gray-500 px-4 py-2 border-b border-gray-100">
                    העבר לקטגוריה
                  </div>
                  
                  <div className="py-1">
                    {filteredCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={(e) => {
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteClick();
                        }}
                        className="w-full text-right px-4 py-2.5 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3 text-red-600 group"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🗑️</span>
                        <span className="text-sm font-medium">מחק פריט</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showSources && sources && sources.length > 0 && (
        <div className="mt-2 bg-blue-50 rounded-xl p-3 text-sm">
          <div className="font-semibold text-blue-900 mb-1">מקורות:</div>
          <ul className="text-blue-700 space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}