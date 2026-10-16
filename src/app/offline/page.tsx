"use client";

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 flex flex-col items-center justify-center gap-6 px-6"
      dir="rtl"
      lang="he"
    >
      <div className="text-7xl select-none">📶</div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">אין חיבור לאינטרנט</h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs">
          לא ניתן לטעון את הדף המבוקש.<br />
          הדפים שביקרת בהם לאחרונה עדיין זמינים.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-8 py-3 rounded-full bg-pink-500 text-white font-semibold shadow-lg hover:bg-pink-600 active:scale-95 transition-all"
        style={{ touchAction: "manipulation" }}
      >
        נסה שוב
      </button>
    </div>
  );
}
