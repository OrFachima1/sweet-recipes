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
          flex items-center gap-4 p-4 rounded-2xl transition-all duration-300
          ${isChecked 
            ? 'bg-gradient-to-l from-green-50 to-emerald-50 border-2 border-green-200' 
            : 'bg-white border-2 border-gray-100 hover:border-purple-200 hover:shadow-lg'
          }
        `}
      >
        {/* צ'קבוקס */}
        <button
          onClick={onToggleCheck}
          className={`
            flex-shrink-0 w-8 h-8 rounded-xl border-3 flex items-center justify-center 
            transition-all duration-300 hover:scale-110 active:scale-95
            ${isChecked 
              ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-600 shadow-lg' 
              : 'border-gray-300 bg-white hover:border-purple-400'
            }
          `}
        >
          {isChecked && (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          <div className={`
            text-lg font-bold transition-all duration-300
            ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}
          `}>
            {name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`
              text-sm font-semibold px-3 py-1 rounded-full
              ${isChecked 
                ? 'bg-green-100 text-green-600' 
                : 'bg-purple-100 text-purple-600'
              }
            `}>
              {qty} {unit}
            </span>
            {isManual && (
              <span className="text-xs px-2 py-1 rounded-full bg-pink-100 text-pink-600 font-semibold">
                ידני
              </span>
            )}
          </div>
        </div>

        {/* תפריט */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
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
              <div className="absolute left-0 top-12 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 p-2 z-50 min-w-[200px]">
                <div className="text-xs font-bold text-gray-500 px-3 py-2">העבר לקטגוריה</div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onChangeCategory(cat.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl hover:bg-purple-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                    </button>
                  ))}
                </div>
                
                {onDelete && (
                  <>
                    <div className="h-px bg-gray-200 my-2" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl hover:bg-red-50 transition-colors flex items-center gap-2 text-red-600 font-semibold"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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