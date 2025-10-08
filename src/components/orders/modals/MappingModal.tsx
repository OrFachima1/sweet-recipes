"use client";
import React, { useMemo, useState, useEffect } from "react";
import { buildCleanMapping, applyMappingGlobally } from "@/utils/orders";

interface MappingModalProps {
  unknowns: string[];
  mapping: Record<string, string>;
  setMapping: (mapping: Record<string, string>) => void;
  menuOptions: string[];
  ignored: string[];
  setIgnored: (ignored: string[]) => void;
  onClose: () => void;
  onIngest: (mappingObj: Record<string, string>) => Promise<void>;
  hasPendingFiles: () => boolean;
  ingestBufferRef: React.MutableRefObject<any>;
  orders: any[];
  persist: (next: any[]) => Promise<void>;
}

/**
 * חישוב דמיון בין שני strings (Levenshtein distance)
 */
function similarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  
  if (str1 === str2) return 1;
  
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8;
  }
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[str2.length][str1.length];
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - (distance / maxLen);
}

/**
 * מציאת top N suggestions
 */
function getTopSuggestions(unknown: string, menu: string[], n: number = 3): string[] {
  const scored = menu.map(item => ({
    item,
    score: similarity(unknown, item)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored
    .filter(s => s.score > 0.4)
    .slice(0, n)
    .map(s => s.item);
}

export default function MappingModal({
  unknowns,
  mapping,
  setMapping,
  menuOptions,
  ignored,
  setIgnored,
  onClose,
  onIngest,
  hasPendingFiles,
  ingestBufferRef,
  orders,
  persist
}: MappingModalProps) {
  // ✅ State לעקוב אחרי פריטים שהמשתמש לחץ "התעלם" (רק ויזואלי, לא נשמר עד לחיצה על "שמור")
  const [visuallyIgnored, setVisuallyIgnored] = useState<Set<string>>(new Set());

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-purple-500 to-pink-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔍</span>
            <div>
              <div className="font-bold text-white text-xl">מיפוי פריטים לא מוכרים</div>
              <div className="text-white/80 text-sm">נמצאו {unknowns.length} פריטים שדורשים התאמה</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {unknowns.map((u) => (
            <UnknownMapperRow
              key={u}
              unknown={u}
              menu={menuOptions}
              value={mapping[u] || ""}
              isVisuallyIgnored={visuallyIgnored.has(u)}
              onPick={(to) => {
                const newMapping = { ...mapping, [u]: to };
                setMapping(newMapping);
              }}
              onIgnore={(name) => {
                // ✅ רק עדכון ויזואלי - לא שומרים עדיין!
                setVisuallyIgnored(prev => new Set(prev).add(name));
              }}
              onClearMapping={(name) => {
                const newMapping = { ...mapping };
                delete newMapping[name];
                setMapping(newMapping);
              }}
              onUndoIgnore={(name) => {
                setVisuallyIgnored(prev => {
                  const next = new Set(prev);
                  next.delete(name);
                  return next;
                });
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            onClick={() => {
              onClose();
              ingestBufferRef.current = null;
            }}
          >
            ביטול
          </button>
          <button
            className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-purple-500 to-pink-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            onClick={async () => {
              console.log("🔹 1️⃣ התחלת שמירה והמשך");
              
              // ✅ כאן נוסיף את כל הפריטים שבהתעלמות ויזואלית
              const itemsToIgnore = Array.from(visuallyIgnored);
              console.log("🔹 פריטים להתעלם:", itemsToIgnore);
              
              // פריטים שלא נמפו ולא בהתעלמות ויזואלית
              const notMapped = unknowns.filter(u => !mapping[u] && !visuallyIgnored.has(u));
              console.log("🔹 2️⃣ לא נמפו:", notMapped);
              
              // שמירת כל הפריטים להתעלמות
              const allToIgnore = [...itemsToIgnore, ...notMapped];
              if (allToIgnore.length) {
                const newIgnored = Array.from(new Set([...ignored, ...allToIgnore]));
                setIgnored(newIgnored);
              }

              const explicitIgnored = Object.keys(mapping).filter(k => mapping[k] === '');
              console.log("🔹 3️⃣ הוסיפו באופן מפורש:", explicitIgnored);
              
              if (explicitIgnored.length) {
                const newIgnored = Array.from(new Set([...ignored, ...explicitIgnored]));
                setIgnored(newIgnored);
              }

              const clean = buildCleanMapping(mapping, menuOptions);
              console.log("🔹 4️⃣ מיפוי מנוקה:", clean);

              if (Object.keys(clean).length > 0) {
                const mergedMap = { ...mapping, ...clean };
                setMapping(mergedMap);
                console.log("🔹 5️⃣ מיפוי משולב נשמר:", mergedMap);
              }

              onClose();

              console.log("🔹 6️⃣ מתחיל להחיל מיפוי...");
              if (hasPendingFiles()) {
                console.log("🔹 7️⃣ יש קבצים - מריץ ingest מחדש");
                await onIngest(clean);
              } else {
                console.log("🔹 7️⃣ אין קבצים - מעדכן מאגר זמני");
                const buf = ingestBufferRef.current || [];
                const mappedBuf = applyMappingGlobally(buf, clean);
                const mappedOrders = applyMappingGlobally(orders, clean);
                await persist([...mappedOrders, ...mappedBuf]);
                ingestBufferRef.current = null;
                console.log("🔹 8️⃣ הזמנות עודכנו ונשמרו");
              }
            }}
          >
            <span>🚀</span>
            <span>שמור והמשך</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * שורת מיפוי בודדת
 */
function UnknownMapperRow({
  unknown,
  menu,
  value,
  isVisuallyIgnored,
  onPick,
  onIgnore,
  onClearMapping,
  onUndoIgnore
}: {
  unknown: string;
  menu: string[];
  value: string;
  isVisuallyIgnored: boolean;
  onPick: (name: string) => void;
  onIgnore: (name: string) => void;
  onClearMapping: (name: string) => void;
  onUndoIgnore: (name: string) => void;
}) {
  const [q, setQ] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(!value);

  const suggestions = useMemo(() => {
    return getTopSuggestions(unknown, menu, 3);
  }, [unknown, menu]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return menu.filter(m => m.toLowerCase().includes(s)).slice(0, 50);
  }, [menu, q]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  const handlePick = (name: string) => {
    onPick(name);
    setQ('');
    setSelectedIndex(0);
    setIsEditing(false);
  };

  const handleIgnore = () => {
    onIgnore(unknown); // ✅ רק מוסיף ל-visuallyIgnored, לא שומר
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!q.trim() || filtered.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handlePick(filtered[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQ('');
        setSelectedIndex(0);
        if (value) setIsEditing(false);
        break;
    }
  };

  // ✅ אם בהתעלם - הצג מצב מיוחד
  if (isVisuallyIgnored) {
    return (
      <div className="border-2 border-gray-300 rounded-2xl p-4 bg-gray-50 hover:shadow-md transition-all animate-in fade-in duration-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🚫</span>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">פריט בהתעלמות:</div>
            <div className="font-bold text-gray-600 text-lg break-words line-through">{unknown}</div>
            <div className="mt-2 text-sm text-gray-500">
              הפריט לא יופיע בהזמנות הסופיות (ישמר רק לאחר לחיצה על "שמור והמשך")
            </div>
          </div>
          <button
            onClick={() => onUndoIgnore(unknown)}
            className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium transition-all flex items-center gap-1 text-sm"
          >
            <span>↩️</span>
            <span>בטל</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-purple-200 rounded-2xl p-4 bg-gradient-to-l from-purple-50 to-pink-50 hover:shadow-md transition-all">
      {/* פריט לא מזוהה */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl flex-shrink-0">❓</span>
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">פריט לא מזוהה:</div>
          <div className="font-bold text-gray-800 text-lg break-words">{unknown}</div>
        </div>
      </div>

      {/* אם יש ערך נבחר - הצג אותו */}
      {value && !isEditing ? (
        <div className="bg-white rounded-xl p-4 border-2 border-green-300 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <div>
                <div className="text-xs text-gray-500">מופה ל:</div>
                <div className="font-bold text-green-700">{value}</div>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium transition-all flex items-center gap-1 text-sm"
            >
              <span>✏️</span>
              <span>ערוך</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* המלצות אוטומטיות */}
          {suggestions.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span>💡</span>
                <span>האם התכוונת ל:</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handlePick(suggestion)}
                    className="text-right px-4 py-3 rounded-xl bg-white border-2 border-purple-300 hover:border-purple-500 hover:bg-purple-50 transition-all font-medium text-gray-800 hover:shadow-md"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* חיפוש ידני */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <span>🔎</span>
              <span>או חפש בתפריט:</span>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="הקלד לחיפוש..."
              className="w-full border-2 border-purple-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />

            {q.trim() && (
              <div className="space-y-1 max-h-48 overflow-y-auto border-2 border-purple-200 rounded-xl p-2 bg-white">
                {filtered.length > 0 ? (
                  filtered.map((name, idx) => (
                    <button
                      key={name}
                      onClick={() => handlePick(name)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-right text-sm px-3 py-2 rounded-lg transition ${
                        idx === selectedIndex 
                          ? 'bg-purple-500 text-white font-medium' 
                          : 'hover:bg-purple-50'
                      }`}
                    >
                      {name}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 py-3 text-center">לא נמצאו תוצאות</div>
                )}
              </div>
            )}
          </div>

          {/* כפתור התעלם */}
          <button 
            className="mt-3 w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all flex items-center justify-center gap-2" 
            onClick={handleIgnore}
          >
            <span>🚫</span>
            <span>התעלם מפריט זה (לא יופיע בהזמנות)</span>
          </button>
        </>
      )}
    </div>
  );
}