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

  // Track click timers for double-click detection
  const clickTimers = useRef<Map<string, number>>(new Map());
  const longPressTimers = useRef<Map<string, number>>(new Map());
  const longPressTriggered = useRef<Map<string, boolean>>(new Map());
  
  // Track specific item IDs that were double-clicked
  const [specificWeighed, setSpecificWeighed] = useState<Set<string>>(new Set());

  const handleIngredientClick = (itemId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If long press was triggered, ignore this click
    if (longPressTriggered.current.get(itemId)) {
      longPressTriggered.current.delete(itemId);
      return;
    }
    
    const key = itemId;
    const now = Date.now();
    const lastClick = clickTimers.current.get(key);
    
    // Double click detection (within 300ms)
    if (lastClick && now - lastClick < 300) {
      // Double click - toggle specific item
      clickTimers.current.delete(key);
      setSpecificWeighed(prev => {
        const next = new Set(prev);
        next.has(itemId) ? next.delete(itemId) : next.add(itemId);
        return next;
      });
    } else {
      // Single click - toggle all instances of this ingredient
      clickTimers.current.set(key, now);
      setTimeout(() => {
        if (clickTimers.current.get(key) === now) {
          onToggleWeighed(name);
          clickTimers.current.delete(key);
        }
      }, 300);
    }
  };

  const handleLongPressStart = (itemId: string, name: string) => {
    const key = itemId;
    const timer = window.setTimeout(() => {
      // Long press - highlight all instances
      onHighlight(name);
      longPressTimers.current.delete(key);
      // Mark that long press was triggered to prevent click
      longPressTriggered.current.set(itemId, true);
      // Clear the flag after a short delay
      setTimeout(() => {
        longPressTriggered.current.delete(itemId);
      }, 500);
    }, 800); // 800ms
    longPressTimers.current.set(key, timer);
  };

  const handleLongPressEnd = (itemId: string) => {
    const key = itemId;
    const timer = longPressTimers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete(key);
    }
  };

  return (
    <div>
      {/* Clear Highlight Button */}
      {highlightedIngredient && (
        <div className="mb-4 flex gap-2 items-center justify-between bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3">
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

      {/* Instructions */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm">
        <div className="font-bold text-blue-900 mb-1">💡 טיפים:</div>
        <div className="text-blue-700 space-y-0.5">
          <div>• <strong>לחיצה אחת</strong> - סימון כשקול בכל המתכונים (✓✓)</div>
          <div>• <strong>לחיצה כפולה</strong> - סימון מופע ספציפי (✓)</div>
          <div>• <strong>לחיצה ארוכה </strong> - הדגשת כל המופעים</div>
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
                        
                        // Check if this specific item or all instances are weighed
                        const isSpecificWeighed = specificWeighed.has(it.id);
                        const isAllWeighed = weighed.has(it.name);
                        const isWeighed = isSpecificWeighed || isAllWeighed;
                        
                        const isHighlighted = highlightedIngredient && norm(highlightedIngredient) === k;

                        return (
                          <li
                            key={it.id}
                            onClick={(e) => handleIngredientClick(it.id, it.name, e)}
                            onMouseDown={() => handleLongPressStart(it.id, it.name)}
                            onMouseUp={() => handleLongPressEnd(it.id)}
                            onMouseLeave={() => handleLongPressEnd(it.id)}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              handleLongPressStart(it.id, it.name);
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              handleLongPressEnd(it.id);
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            className={`
                              text-sm cursor-pointer px-2 py-2 rounded transition-all relative select-none
                              ${isWeighed
                                ? 'line-through text-gray-400 bg-green-50'
                                : isHighlighted
                                  ? 'bg-yellow-100 border-2 border-yellow-400 font-bold shadow-lg animate-pulse'
                                  : 'hover:bg-gray-50'
                              }
                            `}
                            style={{ 
                              userSelect: 'none', 
                              WebkitUserSelect: 'none',
                              WebkitTouchCallout: 'none',
                              touchAction: 'manipulation'
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium flex-1">{it.name}</span>
                              <span className="text-gray-600 text-xs">
                                {[showQty, it.unit].filter(Boolean).join(" ")}
                              </span>
                              {isWeighed && (
                                <span className="text-green-600 text-lg">
                                  {isSpecificWeighed ? '✓' : '✓✓'}
                                </span>
                              )}
                            </div>
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