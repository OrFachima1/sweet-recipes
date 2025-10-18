"use client";

import { useDeferredValue, useState } from "react";
import { formatQty } from "../utils/qtyParser";
import { norm, colorIdxFor, hexToRgba } from "../utils/colorUtils";
import { PALETTE, BG_ALPHA, BAR_ALPHA, OUTL_ALPHA } from "../constants";
import type { AggregatedIngredient } from "../utils/types";

interface SummaryViewProps {
  ingredients: AggregatedIngredient[];
  weighed: Set<string>;
  selected: Set<string>;
  onToggleWeighed: (name: string) => void;
}

export function SummaryView({ 
  ingredients, 
  weighed, 
  selected,
  onToggleWeighed 
}: SummaryViewProps) {
  const deferredSelected = useDeferredValue(selected);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {ingredients.map((item, idx) => {
        const k = norm(item.name);
        const on = deferredSelected.has(k);
        const isWeighed = weighed.has(item.name);
        const isExpanded = expandedItems.has(idx);
        const colorIdx = colorIdxFor(k);
        const col = on ? {
          bg: hexToRgba(PALETTE[colorIdx], BG_ALPHA),
          bar: hexToRgba(PALETTE[colorIdx], BAR_ALPHA),
          outline: `rgba(0,0,0,${OUTL_ALPHA})`,
        } : null;

        return (
          <div
            key={idx}
            className={`bg-white rounded-xl sm:rounded-2xl shadow-md transition-all duration-200 ${
              isWeighed ? 'ring-2 ring-green-400 bg-green-50' : 'hover:shadow-lg'
            }`}
            style={on && !isWeighed ? {
              backgroundColor: col!.bg,
              outline: `2px solid ${col!.outline}`,
            } : undefined}
          >
            {/* Main Content - Clickable */}
            <div
              onClick={() => onToggleWeighed(item.name)}
              className="p-3 sm:p-5 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 text-right min-w-0">
                  <div className={`text-base sm:text-xl font-bold mb-1 truncate ${isWeighed ? 'line-through text-gray-500' : ''}`}>
                    {item.name}
                  </div>
                  
                  {/* Mobile: Show only count, Desktop: Show names */}
                  <div className="text-xs sm:text-sm text-gray-500 mb-2">
                    <span className="sm:hidden">{item.sources.length} מתכונים</span>
                    <span className="hidden sm:inline truncate">{item.sources.join(", ")}</span>
                  </div>
                  
                  {/* Visual bar */}
                  {on && !isWeighed && (
                    <div className="h-1 rounded-full mt-2" style={{ backgroundColor: col!.bar }} />
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="text-left">
                    <div className={`text-xl sm:text-2xl font-black ${isWeighed ? 'text-gray-400' : 'text-pink-600'}`}>
                      {formatQty(item.totalQty)}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">{item.unit}</div>
                  </div>

                  {isWeighed && (
                    <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500 text-white text-lg sm:text-xl">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recipe Breakdown Toggle - Show if has items and (multiple recipes OR has group name) */}
            {item.items && item.items.length > 0 && (
              item.items.length > 1 || item.items.some((i: any) => i.groupName)
            ) && (
              <div className="border-t border-gray-200">
                <button
                  onClick={(e) => toggleExpanded(idx, e)}
                  className="w-full px-3 py-2 sm:px-5 sm:py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    {isExpanded ? 'הסתר פירוט' : 'הצג פירוט'}
                  </span>
                  <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 sm:px-5 sm:pb-4 space-y-1 sm:space-y-2">
                    {item.items.map((recipeItem: any, itemIdx: number) => {
                      const itemColorIdx = colorIdxFor(recipeItem.recipeTitle);
                      const bgColor = hexToRgba(PALETTE[itemColorIdx], 0.2);
                      return (
                        <div
                          key={itemIdx}
                          className="px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-base font-medium"
                          style={{ backgroundColor: bgColor }}
                        >
                          <div>
                            <span className="font-bold">{recipeItem.recipeTitle}</span>
                            {recipeItem.groupName && (
                              <span className="text-xs text-gray-500"> ({recipeItem.groupName})</span>
                            )}
                          </div>
                          <div className="text-sm">
                            {formatQty(recipeItem.qty)} {recipeItem.unit}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}