"use client";

import { useState, useMemo } from "react";
import type { Recipe } from "../utils/types";

interface RecipePickerProps {
  allRecipes: Recipe[];
  currentIds: string[];
  onAddMultiple: (ids: string[]) => Promise<void>;
  onClose: () => void;
}

export function RecipePicker({ 
  allRecipes, 
  currentIds, 
  onAddMultiple, 
  onClose 
}: RecipePickerProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const available = useMemo(() => {
    const filtered = allRecipes.filter(r => !currentIds.includes(r.id));
    if (!search.trim()) return filtered;
    const term = search.toLowerCase();
    return filtered.filter(r => 
      r.title?.toLowerCase().includes(term) || 
      r.category?.toLowerCase().includes(term)
    );
  }, [allRecipes, currentIds, search]);

  const toggleRecipe = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    await onAddMultiple(Array.from(selectedIds));
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-3 sm:p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold">הוסף מתכונים</h2>
            <button 
              onClick={onClose} 
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש מתכון..."
            className="w-full h-9 sm:h-10 px-3 text-sm sm:text-base rounded-lg border mb-2"
            autoFocus
          />
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={addSelected}
                className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-pink-500 text-white font-bold hover:bg-pink-600"
              >
                הוסף {selectedIds.size} מתכונים
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border hover:bg-neutral-50"
              >
                נקה
              </button>
            </div>
          )}
        </div>
        
        <div className="p-3 sm:p-4 space-y-2">
          {available.length === 0 ? (
            <div className="text-center text-neutral-400 py-8 text-sm sm:text-base">
              לא נמצאו מתכונים זמינים
            </div>
          ) : (
            available.map(r => {
              const isSelected = selectedIds.has(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'bg-pink-50 border-pink-300' : 'bg-white hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecipe(r.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-bold text-sm sm:text-base truncate">{r.title}</div>
                    {r.category && (
                      <div className="text-xs sm:text-sm text-neutral-500 truncate">{r.category}</div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}