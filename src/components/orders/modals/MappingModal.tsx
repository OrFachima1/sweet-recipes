"use client";
import React, { useMemo, useState, useEffect } from "react";
import { buildCleanMapping, applyMappingGlobally } from "@/utils/orders";

interface MappingModalProps {
  unknowns: string[];
  mapping: Record<string, string>;
  setMapping: (mapping: Record<string, string>) => void; // 👈 עודכן לקבל פונקציה ישירה
  menuOptions: string[];
  ignored: string[]; // 👈 הוספנו - צריך לדעת מה כבר ignored
  setIgnored: (ignored: string[]) => void; // 👈 עודכן לקבל פונקציה ישירה
  onClose: () => void;
  onIngest: (mappingObj: Record<string, string>) => Promise<void>;
  hasPendingFiles: () => boolean;
  ingestBufferRef: React.MutableRefObject<any>;
  orders: any[];
  persist: (next: any[]) => Promise<void>; // 👈 עודכן ל-async
}

/**
 * מיפוי פריטים לא מוכרים למנות מתוך תפריט
 */
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

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-2xl border border-sky-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sky-200 flex items-center justify-between">
          <div className="font-semibold text-sky-800">מיפוי פריטים לא מוכרים</div>
          <button onClick={onClose} className="text-sky-600 hover:text-sky-800">✕</button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {unknowns.map((u) => (
            <UnknownMapperRow
              key={u}
              unknown={u}
              menu={menuOptions}
              value={mapping[u] || ""}
              onPick={(to) => {
                // עדכון מיפוי - ישמר ל-Firestore דרך setMapping
                const newMapping = { ...mapping, [u]: to };
                setMapping(newMapping);
              }}
              onIgnore={(name) => {
                // הוספה ל-ignored - ישמר ל-Firestore דרך setIgnored
                const newIgnored = Array.from(new Set([...ignored, name]));
                setIgnored(newIgnored);
              }}
            />
          ))}

          <div className="flex justify-end gap-2 pt-2">
            {/* כפתור ביטול */}
            <button
              className="px-3 py-2 rounded-xl bg-white border border-sky-200 hover:bg-sky-50"
              onClick={() => {
                onClose();
                // מנקים את המאגר הזמני
                ingestBufferRef.current = null;
              }}
            >
              ביטול
            </button>

            {/* כפתור שמירה והמשך */}
            <button
              className="px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              onClick={async () => {
                console.log("🔹 1️⃣ התחלת שמירה והמשך");
                
                // 1) כל מה שלא נמפה --> ignored
                const notMapped = unknowns.filter(u => !mapping[u]);
                console.log("🔹 2️⃣ לא נמפו:", notMapped);
                
                if (notMapped.length) {
                  // מוסיף ל-ignored (ישמר ל-Firestore)
                  const newIgnored = Array.from(new Set([...ignored, ...notMapped]));
                  setIgnored(newIgnored);
                }

                // 2) מפורש "אל תשאל שוב" --> ignored
                const explicitIgnored = Object.keys(mapping).filter(k => mapping[k] === '');
                console.log("🔹 3️⃣ הוסיפו באופן מפורש:", explicitIgnored);
                
                if (explicitIgnored.length) {
                  const newIgnored = Array.from(new Set([...ignored, ...explicitIgnored]));
                  setIgnored(newIgnored);
                }

                // 3) ניקוי המיפוי
                const clean = buildCleanMapping(mapping, menuOptions);
                console.log("🔹 4️⃣ מיפוי מנוקה:", clean);

                // 4) שמירה (יישמר ל-Firestore דרך setMapping)
                if (Object.keys(clean).length > 0) {
                  const mergedMap = { ...mapping, ...clean };
                  setMapping(mergedMap);
                  console.log("🔹 5️⃣ מיפוי משולב נשמר:", mergedMap);
                }

                onClose();

                // 5) החלת המיפוי
                console.log("🔹 6️⃣ מתחיל להחיל מיפוי...");
                if (hasPendingFiles()) {
                  // יש קבצים חדשים - נריץ ingest מחדש עם המיפוי
                  console.log("🔹 7️⃣ יש קבצים - מריץ ingest מחדש");
                  await onIngest(clean);
                } else {
                  // אין קבצים - נעדכן את המאגר הזמני
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
              שמור מיפוי והמשך
            </button>
          </div>
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
  onPick,
  onIgnore
}: {
  unknown: string;
  menu: string[];
  value: string;
  onPick: (name: string) => void;
  onIgnore: (name: string) => void;
}) {
  const [q, setQ] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return menu.slice(0, 50);
    return menu.filter(m => m.toLowerCase().includes(s)).slice(0, 50);
  }, [menu, q]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  const handlePick = (name: string) => {
    onPick(name);
    setQ('');
    setSelectedIndex(0);
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
        break;
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="text-xs text-gray-500 mb-1">לא מזוהה</div>
      <div className="font-medium mb-2 break-words text-sky-900">{unknown}</div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="חיפוש בתפריט…"
        className="w-full border border-sky-200 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />

      {q.trim() && (
        <div className="space-y-1 max-h-40 overflow-y-auto border border-sky-200 rounded-md p-2 mb-2">
          {filtered.length > 0 ? (
            filtered.map((name, idx) => (
              <button
                key={name}
                onClick={() => handlePick(name)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left text-sm px-2 py-1 rounded transition ${
                  idx === selectedIndex 
                    ? 'bg-sky-500 text-white' 
                    : value === name 
                    ? 'bg-sky-100 font-medium hover:bg-sky-200' 
                    : 'hover:bg-sky-50'
                }`}
              >
                {name}
              </button>
            ))
          ) : (
            <div className="text-xs text-sky-500 py-2">לא נמצאו תוצאות</div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-sky-700">
          {value ? (
            <>נבחר: <span className="font-semibold">{value}</span></>
          ) : (
            'טרם נבחר מיפוי'
          )}
        </div>
        <button 
          className="text-xs underline text-gray-500 hover:text-gray-700" 
          onClick={() => onIgnore(unknown)}
        >
          אל תשאל שוב
        </button>
      </div>
    </div>
  );
}