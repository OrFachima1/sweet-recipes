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

// ShoppingToolbar.tsx
export function ShoppingToolbar({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  checkedCount,
  clearCheckedItems
}: {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: 'name' | 'checked';
  setSortBy: (sort: 'name' | 'checked') => void;
  checkedCount: number;
  clearCheckedItems: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-3 mb-3 flex gap-2 items-center flex-wrap">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="🔍 חיפוש..."
        className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
      />
      <button
        onClick={() => setSortBy(sortBy === 'name' ? 'checked' : 'name')}
        className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100 transition-colors whitespace-nowrap"
        title={sortBy === 'name' ? 'לחץ כדי להעביר מסומנים למטה' : 'לחץ כדי למיין לפי שם'}
      >
        {sortBy === 'name' ? '🔤 לפי שם' : '✓ מסומנים למטה'}
      </button>
      {checkedCount > 0 && (
        <button
          onClick={clearCheckedItems}
          className="px-4 py-2 rounded-xl bg-orange-50 text-orange-600 font-semibold text-sm hover:bg-orange-100 transition-colors whitespace-nowrap"
          title="מוחק את הפריטים הידניים המסומנים"
        >
          🗑️ נקה סומנו
        </button>
      )}
    </div>
  );
}

// AddItemModal.tsx
export function AddItemModal({
  show,
  onClose,
  onAdd
}: {
  show: boolean;
  onClose: () => void;
  onAdd: (name: string, qty: string, unit: string) => void;
}) {
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemQty, setNewItemQty] = React.useState('');
  const [newItemUnit, setNewItemUnit] = React.useState('');

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    onAdd(newItemName, newItemQty, newItemUnit);
    setNewItemName('');
    setNewItemQty('');
    setNewItemUnit('');
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-5 text-gray-800">הוסף פריט</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="שם המוצר"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="כמות"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            />
            <input
              type="text"
              placeholder="יחידה (גרם, ק״ג...)"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-rose-300 focus:outline-none text-base"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAdd}
              disabled={!newItemName.trim()}
              className={`flex-1 px-6 py-3 rounded-xl font-bold text-base transition-all ${
                newItemName.trim()
                  ? 'bg-gradient-to-l from-rose-400 to-pink-400 text-white hover:shadow-lg active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              הוסף
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-base transition-all active:scale-95"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}