"use client";

import { useRouter } from "next/navigation";

type WeighingBarProps = {
  selectedRecipes: Record<string, { title: string }>;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export default function WeighingBar({
  selectedRecipes,
  onRemove,
  onClear,
}: WeighingBarProps) {
  const router = useRouter();

  const ids = Object.keys(selectedRecipes);
  
  if (ids.length === 0) return null;

  function openWeigh() {
    router.push(`/weigh?ids=${ids.join(",")}`);
  }

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 animate-fadeIn">
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4">
          {/* רשימת מתכונים נבחרים */}
          <div className="flex flex-wrap gap-2 flex-1">
            {Object.entries(selectedRecipes).map(([id, v]) => (
              <span
                key={id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-100 text-pink-800 text-sm font-medium"
              >
                {v.title}
                <button
                  onClick={() => onRemove(id)}
                  className="text-pink-600 hover:text-pink-800 font-bold"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>

          {/* כפתורי פעולה */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClear}
              className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-medium transition-all"
            >
              נקה
            </button>
            <button
              onClick={openWeigh}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold shadow-lg hover:shadow-xl hover:from-pink-600 hover:to-rose-600 transition-all"
            >
              פתח מצב שקילה
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}