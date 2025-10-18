"use client";

interface ProgressHeaderProps {
  weighed: Set<string>;
  total: number;
  onClearProgress: () => void;
  onStartFocus: () => void;
}

export function ProgressHeader({ 
  weighed, 
  total, 
  onClearProgress,
  onStartFocus 
}: ProgressHeaderProps) {
  const progress = total > 0 ? (weighed.size / total) * 100 : 0;
  const isComplete = weighed.size === total && total > 0;

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-5 mb-3 sm:mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold">סיכום שקילה</h2>
        <button
          disabled={total === 0}
          onClick={onStartFocus}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm sm:text-base font-bold hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🎯 התחל מצב פוקוס
        </button>
      </div>
      
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2">
          <span className="font-medium">התקדמות שקילה</span>
          <span className="font-bold text-base sm:text-lg">
            {weighed.size} / {total}
          </span>
        </div>
        <div className="h-2 sm:h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {isComplete && (
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 border-2 border-green-300 rounded-lg sm:rounded-xl text-center">
          <div className="text-xl sm:text-2xl mb-2">🎉 כל הכבוד!</div>
          <div className="text-sm sm:text-base text-green-800 font-bold">סיימת לשקול את כל המרכיבים!</div>
          <button
            onClick={onClearProgress}
            className="mt-2 sm:mt-3 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
          >
            אפס התקדמות
          </button>
        </div>
      )}
    </div>
  );
}