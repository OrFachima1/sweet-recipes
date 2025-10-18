"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ScaleControl from "@/components/ScaleControl";
import { formatQty } from "../utils/qtyParser";
import { norm } from "../utils/colorUtils";
import { PALETTE } from "../constants";
import type { Recipe, RecipeProgress } from "../utils/types";

interface PerRecipeViewProps {
  recipes: Recipe[];
  weighed: Set<string>;
  scales: Record<string, number>;
  baseQty: Map<string, number | null>;
  recipeProgress: Record<string, RecipeProgress>;
  onToggleWeighed: (name: string) => void;
  onSetScale: (id: string, scale: number) => void;
  onRemoveRecipe: (id: string) => void;
  highlightedIngredient: string | null;
  onHighlight: (name: string | null) => void;
  onClearHighlight: () => void;
}

export function PerRecipeView({
  recipes,
  weighed,
  scales,
  baseQty,
  recipeProgress,
  onToggleWeighed,
  onSetScale,
  onRemoveRecipe,
  highlightedIngredient,
  onHighlight,
  onClearHighlight,
}: PerRecipeViewProps) {
  const router = useRouter();
  const getScale = (id: string) => scales[id] ?? 1;

  // Track long press with pointer events
  const longPressTimers = useRef<Map<string, number>>(new Map());
  const longPressActive = useRef<Set<string>>(new Set());

  const handlePointerDown = (itemId: string, name: string) => {
    // Start long press timer
    const timer = window.setTimeout(() => {
      // Long press triggered
      longPressActive.current.add(itemId);
      onHighlight(name);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 600);
    longPressTimers.current.set(itemId, timer);
  };

  const handlePointerUp = (itemId: string, name: string) => {
    // Cancel timer if still running
    const timer = longPressTimers.current.get(itemId);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete(itemId);
    }

    // Check if long press was triggered
    if (longPressActive.current.has(itemId)) {
      // Was long press - don't toggle, just clear flag
      longPressActive.current.delete(itemId);
    } else {
      // Was regular click - toggle weighed
      onToggleWeighed(name);
    }
  };

  const handlePointerCancel = (itemId: string) => {
    // Cancel everything if pointer is cancelled/leaves
    const timer = longPressTimers.current.get(itemId);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete(itemId);
    }
    longPressActive.current.delete(itemId);
  };

  return (
    <div>
      {/* Clear Highlight Button and Reset All */}
      <div className="mb-4 flex gap-2">
        {highlightedIngredient && (
          <div className="flex-1 flex gap-2 items-center justify-between bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3">
            <div className="flex-1">
              <span className="text-sm font-bold text-yellow-900">
                🔍 ממוקד: {highlightedIngredient}
              </span>
            </div>
            <button
              onClick={onClearHighlight}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-bold hover:bg-yellow-600"
            >
              נקה הדגשה
            </button>
          </div>
        )}
        
        {/* Reset All Button */}
        <button
          onClick={() => {
            if (confirm('האם אתה בטוח שברצונך לאפס את כל הסימונים?')) {
              weighed.forEach(name => onToggleWeighed(name));
              onClearHighlight();
            }
          }}
          className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 whitespace-nowrap"
        >
          🔄 אפס הכל
        </button>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm">
        <div className="font-bold text-blue-900 mb-1">💡 טיפים:</div>
        <div className="text-blue-700 space-y-0.5">
          <div>• <strong>לחיצה</strong> - סימון ששקלת בכל המתכונים (✓)</div>
          <div>• <strong>לחיצה ארוכה</strong> - הדגשת כל המופעים</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => {
          const recipeColorIdx = Math.abs(
            r.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
          ) % PALETTE.length;
          const recipeColor = PALETTE[recipeColorIdx];
          const { completed, total } = recipeProgress[r.id] || { completed: 0, total: 0 };
          const recipeProgressPercent = total > 0 ? (completed / total) * 100 : 0;

          return (
            <div
              key={r.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
              style={{ borderTop: `6px solid ${recipeColor}` }}
            >
              <div className="p-4 relative">
                <button
                  onClick={() => onRemoveRecipe(r.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-red-500 text-white hover:bg-red-600 text-xs font-bold flex items-center justify-center z-10"
                  title="הסר מתכון"
                >
                  ✕
                </button>

                <div className="flex items-center justify-between gap-3 mb-2 mt-2">
                  <button
                    onClick={() => router.push(`/recipes/${r.id}`)}
                    className="text-xl font-bold truncate hover:underline cursor-pointer text-right flex-1"
                    title="עבור למתכון"
                  >
                    {r.title}
                  </button>
                  <ScaleControl value={getScale(r.id)} onChange={(v: number) => onSetScale(r.id, v)} />
                </div>

                {/* Progress bar for recipe */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>התקדמות</span>
                    <span className="font-bold">{completed} / {total}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${recipeProgressPercent}%`,
                        backgroundColor: recipeColor
                      }}
                    />
                  </div>
                </div>

                {(r.ingredients || []).map((g: any, gi: number) => (
                  <div key={gi} className="mb-3">
                    {g.groupName && (
                      <div className="font-semibold mb-1 text-gray-600 text-sm">{g.groupName}</div>
                    )}
                    <ul className="space-y-2">
                      {(g.items || []).map((it: any) => {
                        const k = norm(it.name);
                        const raw = baseQty.get(it.id);
                        const showQty = raw == null
                          ? (it.qty || "")
                          : formatQty(raw * getScale(r.id));
                        
                        const isWeighed = weighed.has(it.name);
                        const isHighlighted = highlightedIngredient && norm(highlightedIngredient) === k;

                        return (
                          <li key={it.id} className="list-none">
                            <button
                              type="button"
                              onPointerDown={() => handlePointerDown(it.id, it.name)}
                              onPointerUp={() => handlePointerUp(it.id, it.name)}
                              onPointerCancel={() => handlePointerCancel(it.id)}
                              onPointerLeave={() => handlePointerCancel(it.id)}
                              onContextMenu={(e) => e.preventDefault()}
                              className={`
                                w-full text-right text-base cursor-pointer px-4 py-4 rounded-lg transition-all select-none
                                ${isWeighed
                                  ? 'line-through text-gray-400 bg-green-50'
                                  : isHighlighted
                                    ? 'bg-yellow-100 border-2 border-yellow-400 font-bold shadow-lg animate-pulse'
                                    : 'bg-white hover:bg-gray-50 active:bg-gray-200'
                                }
                              `}
                              style={{ 
                                minHeight: '56px',
                                touchAction: 'manipulation',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none'
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold flex-1 text-base">{it.name}</span>
                                <span className="text-gray-600 text-sm font-medium">
                                  {[showQty, it.unit].filter(Boolean).join(" ")}
                                </span>
                                {isWeighed && (
                                  <span className="text-green-600 text-2xl leading-none">✓</span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}