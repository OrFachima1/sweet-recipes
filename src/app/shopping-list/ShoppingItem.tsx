"use client";
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
  onChangeCategory: (categoryId: string) => void;
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
      {/* רקע של שורה */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full border-b border-blue-200/40" style={{ 
          backgroundImage: 'linear-gradient(transparent 95%, #bfdbfe 95%)',
          backgroundSize: '100% 3.5rem'
        }} />
      </div>

      {/* תוכן הפריט */}
      <div 
        className="relative flex items-center gap-2 sm:gap-4 py-2 sm:py-3 px-3 sm:px-6 hover:bg-blue-50/30 transition-colors"
        style={{ minHeight: '3.5rem' }}
      >
        {/* צ'קבוקס */}
        <button
          onClick={onToggleCheck}
          className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-md border-3 flex items-center justify-center transition-all hover:scale-110 ${
            isChecked 
              ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-600 shadow-lg' 
              : 'border-gray-400 bg-white hover:border-blue-500'
          }`}
        >
          {isChecked && (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* טקסט וכמות */}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 min-h-[2.8rem]">
          <span 
            className={`text-3xl sm:text-4xl leading-relaxed ${
              isChecked ? 'line-through opacity-40' : 'text-gray-800'
            }`}
            style={{ 
              fontFamily: 'MyHandwriting, Arial',
              paddingTop: '0.3rem'
            }}
          >
            {name}
          </span>
          
          {qty > 0 && (
            <span 
              className={`text-2xl sm:text-3xl text-blue-600 font-medium leading-relaxed ${
                isChecked ? 'opacity-40' : ''
              }`}
              style={{ 
                fontFamily: 'MyHandwriting, Arial',
                paddingTop: '0.3rem'
              }}
            >
              {Math.round(qty * 100) / 100} {unit}
            </span>
          )}
        </div>

        {/* תפריט שלוש נקודות */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-md hover:shadow-lg flex items-center justify-center transition-all hover:scale-105 border border-gray-200"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>

          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute left-0 top-12 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-20 min-w-[220px]">
                <div className="px-4 py-2 bg-gradient-to-l from-blue-50 to-cyan-50 border-b border-blue-200">
                  <div className="text-sm font-semibold text-gray-700">העבר לקטגוריה:</div>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {categories.filter(c => c.id !== 'all').map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onChangeCategory(cat.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-3 text-right hover:bg-blue-50 transition-colors flex items-center gap-2 text-base"
                    >
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-gray-700">{cat.name}</span>
                    </button>
                  ))}
                </div>

                {isManual && onDelete && (
                  <>
                    <div className="border-t border-gray-200" />
                    <button
                      onClick={() => {
                        onDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-3 text-right hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2 text-base"
                    >
                      <span>🗑️</span>
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