"use client";
import React, { useMemo } from "react";

interface AddItemModalProps {
  showFor: string | null;
  onClose: () => void;
  menuOptions: string[];
  addSearch: string;
  setAddSearch: React.Dispatch<React.SetStateAction<string>>;
  onConfirm: (title: string) => void;
}

/**
 * מודאל הוספת מנה להזמנה קיימת מתוך התפריט
 */
export default function AddItemModal({
  showFor,
  onClose,
  menuOptions,
  addSearch,
  setAddSearch,
  onConfirm,
}: AddItemModalProps) {
  const filteredMenu = useMemo(() => {
    const s = addSearch.trim().toLowerCase();
    const base = menuOptions || [];
    const arr = s ? base.filter(x => x.toLowerCase().includes(s)) : base;
    return Array.from(new Set(arr)).slice(0, 20);
  }, [menuOptions, addSearch]);

  if (!showFor) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-2xl overflow-hidden border border-sky-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sky-200 flex items-center justify-between">
          <div className="font-semibold text-sky-800">בחר מנה מהתפריט</div>
          <button onClick={onClose} className="text-sky-600 hover:text-sky-800">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <input
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="חיפוש…"
            className="w-full px-3 py-2 rounded-xl bg-white border border-sky-200 text-sm"
          />

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredMenu.slice(0, 6).map((m, i) => (
              <button
                key={i}
                onClick={() => onConfirm(m)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 border border-sky-100"
              >
                {m}
              </button>
            ))}
            {filteredMenu.length === 0 && (
              <div className="text-xs text-sky-500">לא נמצאו תוצאות</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
