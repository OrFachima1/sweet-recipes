// ShoppingHeader.tsx
import React from 'react';

interface ShoppingHeaderProps {
  router: any;
  totalItems: number;
  checkedCount: number;
  progress: number;
  selectedPeriod: { start: string; end: string };
  setSelectedPeriod: (period: { start: string; end: string }) => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  resetAll: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export default function ShoppingHeader({
  router,
  totalItems,
  checkedCount,
  progress,
  selectedPeriod,
  setSelectedPeriod,
  showDatePicker,
  setShowDatePicker,
  resetAll,
  setSettingsOpen
}: ShoppingHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-rose-400 to-pink-400 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push('/')}
            className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
            title="חזרה לדף הבית"
          >
            ←
          </button>
          
          <div className="text-center flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">
              🛒 רשימת קניות
            </h1>
            {totalItems > 0 && (
              <div className="mt-1 text-white/95 font-bold text-lg">
                {checkedCount} / {totalItems}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
                title="בחירת תקופה ואיפוס"
              >
                📅
              </button>

              {showDatePicker && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDatePicker(false)}
                  />
                  <div 
                    className="absolute left-0 top-14 bg-white rounded-3xl shadow-2xl p-5 z-50 min-w-[280px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-lg font-bold text-gray-800">בחר תקופה</div>
                      <button
                        onClick={resetAll}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-600 text-sm font-semibold hover:bg-rose-200 transition-colors flex items-center gap-1"
                        title="מאפס סימונים ומחיקות"
                      >
                        <span>🔄</span>
                        <span>אפס הכל</span>
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">מתאריך:</label>
                        <input
                          type="date"
                          value={selectedPeriod.start}
                          onChange={(e) => setSelectedPeriod({ ...selectedPeriod, start: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">עד תאריך:</label>
                        <input
                          type="date"
                          value={selectedPeriod.end}
                          onChange={(e) => setSelectedPeriod({ ...selectedPeriod, end: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setSettingsOpen(true)}
              className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
              title="הגדרות מתכונים"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* פס התקדמות */}
        {totalItems > 0 && (
          <div className="relative h-2.5 bg-white/25 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-emerald-400 to-green-400 transition-all duration-500 ease-out rounded-full shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}


