"use client";
import React, { useState, useRef, useEffect, useMemo } from "react";

interface ReviewModalProps {
  show: boolean;
  orders: any[];  // ההזמנות שחולצו
  files: File[];  // קבצי ה-PDF
  onClose: () => void;
  onSave: (editedOrders: any[]) => void;  // שמירה אחרי עריכה
}

export default function ReviewModal({
  show,
  orders,
  files,
  onClose,
  onSave,
}: ReviewModalProps) {
  const [editedOrders, setEditedOrders] = useState<any[]>(orders || []);
  const [currentOrderIndex, setCurrentOrderIndex] = useState<number>(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // ==== PDF.js integration (cross-browser highlight) ====
  const pdfIframeRef = useRef<HTMLIFrameElement | null>(null);
  const baseBlobRef = useRef<string | null>(null);

  const currentOrder = editedOrders[currentOrderIndex];

  // יצירת/עדכון כתובת הקובץ (blob/string) רק כשמחליפים קובץ
  useEffect(() => {
    // נקה blob קודם
    if (baseBlobRef.current && !String(baseBlobRef.current).startsWith('http')) {
      try { URL.revokeObjectURL(baseBlobRef.current!); } catch {}
    }
    baseBlobRef.current = null;
    if (files[currentOrderIndex]) {
      const f: any = files[currentOrderIndex];
      if (typeof f === 'string') {
        baseBlobRef.current = f;
      } else {
        baseBlobRef.current = URL.createObjectURL(f);
      }
    }
  }, [files, currentOrderIndex]);

  // כתובת ה-viewer של PDF.js (לא שולחים פה חיפוש, זה נעשה עם postMessage)
  const viewerSrc = useMemo(() => {
    const fileParam = baseBlobRef.current ? encodeURIComponent(baseBlobRef.current) : '';
    return `/pdfjs/web/viewer.html?file=${fileParam}#zoom=page-width`;
  }, [baseBlobRef.current, files, currentOrderIndex]);

  // שליחת חיפוש ל-PDF.js בכל שינוי searchTerm וגם אחרי טעינה
  useEffect(() => {
    const term = (searchTerm || '').trim();
    if (!term || !pdfIframeRef.current) return;
    const t = setTimeout(() => {
      pdfIframeRef.current?.contentWindow?.postMessage({
        type: 'find',
        query: term,
        caseSensitive: false,
        highlightAll: true,
        entireWord: false,
        findPrevious: false,
      }, '*');
    }, 120);
    return () => clearTimeout(t);
  }, [searchTerm, viewerSrc]);

  // ניקוי blob כשסוגרים/מחליפים
  useEffect(() => {
    return () => {
      if (baseBlobRef.current && !String(baseBlobRef.current).startsWith('http')) {
        try { URL.revokeObjectURL(baseBlobRef.current); } catch {}
        baseBlobRef.current = null;
      }
    };
  }, [currentOrderIndex]);

  if (!show) return null;

  const goNext = () => {
    if (currentOrderIndex < editedOrders.length - 1) {
      setCurrentOrderIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentOrderIndex > 0) {
      setCurrentOrderIndex(prev => prev - 1);
    }
  };

  const toggleItemChecked = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    onSave(editedOrders);
  };

  const updateOrder = (field: string, value: any) => {
    const updated = [...editedOrders];
    updated[currentOrderIndex] = {
      ...updated[currentOrderIndex],
      [field]: value
    };
    setEditedOrders(updated);
  };

  const updateItem = (itemIndex: number, field: string, value: any) => {
    const updated = [...editedOrders];
    const items = [...updated[currentOrderIndex].items];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    updated[currentOrderIndex] = { ...updated[currentOrderIndex], items };
    setEditedOrders(updated);
  };

  // ======= UI =======
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-[1400px] h-[92vh] rounded-3xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-l from-gray-50 to-gray-100">
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">הזמנה</div>
            <div className="text-sm font-semibold">{currentOrderIndex + 1} / {editedOrders.length}</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={currentOrderIndex === 0} className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-40">הקודם</button>
            <button onClick={goNext} disabled={currentOrderIndex >= editedOrders.length - 1} className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-40">הבא</button>
            <button onClick={onClose} className="ml-2 px-3 py-1.5 rounded-lg border bg-white">סגור</button>
          </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Viewer - Left Side */}
          <div className="w-1/2 border-l border-gray-200 bg-gray-100 p-4 overflow-auto">
            {viewerSrc ? (
              <iframe
                ref={pdfIframeRef}
                key={viewerSrc}
                src={viewerSrc}
                className="w-full h-full rounded-xl border-2 border-gray-300 bg-white"
                title="PDF Preview"
                onLoad={() => {
                  const term = (searchTerm || '').trim();
                  if (!term) return;
                  pdfIframeRef.current?.contentWindow?.postMessage({
                    type: 'find',
                    query: term,
                    caseSensitive: false,
                    highlightAll: true,
                    entireWord: false,
                    findPrevious: false,
                  }, '*');
                }}
                allow="fullscreen"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <div className="text-sm">אין תצוגת PDF</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Order Editing */}
          <div className="w-1/2 p-4 overflow-auto">
            {/* Client + Date */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">לקוח</label>
                <input
                  type="text"
                  value={currentOrder?.client || ''}
                  onChange={(e) => updateOrder('client', e.target.value)}
                  onFocus={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="שם הלקוח"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">תאריך</label>
                <input
                  type="date"
                  value={currentOrder?.date || ''}
                  onChange={(e) => updateOrder('date', e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-4">
              {currentOrder?.items?.map((item: any, idx: number) => {
                const key = `${currentOrderIndex}-${idx}`;
                return (
                  <div key={key} className="rounded-2xl border p-3 bg-white">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[key]}
                        onChange={() => toggleItemChecked(key)}
                        className="mt-1"
                        title="סומן לבדיקה"
                      />
                      <div className="flex-1 grid grid-cols-12 gap-2 items-start">
                        {/* Name */}
                        <div className="col-span-5">
                          <label className="block text-[11px] text-gray-500 mb-1">שם המנה</label>
                          <input
                            type="text"
                            value={item.title || ""}
                            onChange={(e) => { updateItem(idx, 'title', e.target.value); setSearchTerm(e.target.value); }}
                            onFocus={(e) => setSearchTerm(e.target.value)}
                            onBlur={() => { /* לא מנקים כאן כדי שההדגשה תישאר עד שמנה אחרת בפוקוס */ }}
                            placeholder="שם המנה"
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                          />
                        </div>

                        {/* Qty */}
                        <div className="col-span-2">
                          <label className="block text-[11px] text-gray-500 mb-1">כמות</label>
                          <input
                            type="number"
                            value={item.quantity ?? ''}
                            onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                            min={0}
                          />
                        </div>

                        {/* Notes */}
                        <div className="col-span-5">
                          <label className="block text-[11px] text-gray-500 mb-1">הערות</label>
                          <textarea
                            value={item.notes || ''}
                            onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                            placeholder="ללא"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {Object.values(checkedItems).filter(Boolean).length} מתוך {currentOrder?.items?.length || 0} מנות נבדקו
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border bg-white hover:bg-gray-50">ביטול</button>
            <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-blue-500 to-cyan-500 text-white hover:shadow active:scale-95">
              סיים ושמור ({editedOrders.length} הזמנות)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
