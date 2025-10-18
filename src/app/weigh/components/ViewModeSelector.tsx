"use client";

import type { ViewMode } from "../utils/types";

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeSelector({ viewMode, onChange }: ViewModeSelectorProps) {
  return (
    <div className="inline-flex rounded-xl border bg-white p-1">
      <button
        onClick={() => onChange('per-recipe')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'per-recipe' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        פר מתכון
      </button>
      <button
        onClick={() => onChange('summary')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'summary' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        סיכום כללי
      </button>
    </div>
  );
}