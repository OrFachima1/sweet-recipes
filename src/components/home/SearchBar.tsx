"use client";

import { useRouter } from "next/navigation";

type Recipe = {
  id: string;
  title: string;
  category: string;
};

type SearchBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  suggestions: Recipe[];
  onAddToWeigh: (id: string, title: string) => void;
  isManager: boolean;
  canAddRecipes?: boolean;
  onToggleForm?: () => void;
};

export default function SearchBar({
  query,
  onQueryChange,
  suggestions,
  onAddToWeigh,
  isManager,
  canAddRecipes,
  onToggleForm,
}: SearchBarProps) {
  const router = useRouter();

  function openRecipe(id: string) {
    router.push(`/recipes/${id}`);
  }

  return (
    <div className="px-4">
      <div className="max-w-2xl mx-auto">
        {/* שורת חיפוש */}
        <div className="relative">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) {
                  openRecipe(suggestions[0].id);
                }
              }}
              placeholder="חפש מתכון..."
              className="w-full h-14 rounded-2xl bg-white border border-gray-200 px-6 text-lg text-right shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all placeholder:text-gray-400"
            />
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
              🔍
            </div>
          </div>

          {/* תוצאות חיפוש */}
          {query && suggestions.length > 0 && (
            <div className="absolute top-[60px] w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-30 animate-fadeIn">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <button
                    onClick={() => openRecipe(s.id)}
                    className="flex-1 text-right px-5 py-4"
                  >
                    <div className="font-semibold text-gray-800">{s.title}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{s.category}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToWeigh(s.id, s.title);
                    }}
                    className="mx-3 w-9 h-9 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 hover:border-gray-400 transition-all flex items-center justify-center text-gray-600 font-bold"
                    title="הוסף למצב שקילה"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* כפתור הוספת מתכון */}
        {(canAddRecipes ?? isManager) && onToggleForm && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={onToggleForm}
              className="px-8 py-3 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg hover:shadow-xl hover:from-pink-600 hover:to-rose-600 active:scale-[0.98] transition-all"
            >
              + הוסף מתכון חדש
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}