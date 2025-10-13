import React, { useState } from 'react';
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

  return (
    <div className="relative group">
      <div 
        className={`
          flex items-center gap-3 px-4 py-2.5 transition-all duration-200
          ${isChecked 
            ? 'bg-green-50' 
            : 'bg-white hover:bg-indigo-50/50'
          }
        `}
      >
        {/* צ'קבוקס */}
        <button
          onClick={onToggleCheck}
          className={`
            flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center 
            transition-all duration-200 active:scale-90
            ${isChecked 
              ? 'bg-green-500 border-green-600' 
              : 'border-gray-300 bg-white active:border-indigo-400'
            }
          `}
        >
          {isChecked && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן - שורה אחת */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className={`
            text-base font-semibold truncate transition-all duration-200
            ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}
          `}>
            {name}
          </span>
          <span className={`
            text-sm font-medium whitespace-nowrap flex-shrink-0
            ${isChecked ? 'text-gray-400' : 'text-indigo-600'}
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

        {/* תפריט */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-90"
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
              <div className="absolute left-0 top-10 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 py-2 z-50 min-w-[180px]">
                <div className="text-xs font-bold text-gray-500 px-3 py-1.5">העבר לקטגוריה</div>
                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onChangeCategory(cat.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-lg">{cat.emoji}</span>
                      <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                    </button>
                  ))}
                </div>
                
                {onDelete && (
                  <>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-red-50 transition-colors flex items-center gap-2 text-red-600 font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>מחק</span>
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