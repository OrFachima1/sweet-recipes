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
