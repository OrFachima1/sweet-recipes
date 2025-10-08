"use client";
import React, { useState, useRef, useEffect, useMemo} from "react";

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
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [editedOrders, setEditedOrders] = useState(orders);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // PDF URL
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // PDF.js integration
  const pdfIframeRef = useRef<HTMLIFrameElement | null>(null);
  const baseBlobRef = useRef<string | null>(null);


  const currentOrder = editedOrders[currentOrderIndex];

// יצירת/ניקוי blob URL רק כשמתחלף קובץ (לא על כל שינוי חיפוש)
useEffect(() => {
  // נקה blob קודם אם היה
  if (baseBlobRef.current) {
    try { URL.revokeObjectURL(baseBlobRef.current); } catch {}
    baseBlobRef.current = null;
  }

  const f = files[currentOrderIndex];
  if (!f) return;

  // צור כתובת לקובץ
  const blobUrl = URL.createObjectURL(f);
  baseBlobRef.current = blobUrl;

  // נטען את viewer של PDF.js (בלי #search כאן)
 const viewer = `/pdfjs/custom-viewer.html?file=${encodeURIComponent(blobUrl)}#zoom=page-width`;
  setPdfUrl(viewer);
}, [files, currentOrderIndex]);

// שלח חיפוש ל-PDF.js בכל שינוי שם מגש וגם אחרי טעינת ה-iframe
useEffect(() => {
  const term = (searchTerm || "").trim();
  if (!term || !pdfIframeRef.current) return;

  const sendFind = () => {
    pdfIframeRef.current?.contentWindow?.postMessage({
      type: "find",
      query: term,
      caseSensitive: false,
      highlightAll: true,
      entireWord: false,
      findPrevious: false,
    }, "*");
  };

  // דיליי קטן עוזר כשמחליפים קובץ
  const t = setTimeout(sendFind, 120);
  return () => clearTimeout(t);
}, [searchTerm, pdfUrl]);

// ניקוי URL כשסוגרים
useEffect(() => {
  return () => {
    if (pdfUrl) {
      const baseUrl = pdfUrl.split('#')[0];
      URL.revokeObjectURL(baseUrl);
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

  const removeItem = (itemIndex: number) => {
    const updated = [...editedOrders];
    const items = updated[currentOrderIndex].items.filter((_: any, i: number) => i !== itemIndex);
    updated[currentOrderIndex] = { ...updated[currentOrderIndex], items };
    setEditedOrders(updated);
  };

  const addItem = () => {
    const updated = [...editedOrders];
    const items = [...updated[currentOrderIndex].items, { title: "", qty: 1, unit: "יח'", notes: "" }];
    updated[currentOrderIndex] = { ...updated[currentOrderIndex], items };
    setEditedOrders(updated);
  };

  const toggleCheck = (itemIndex: number) => {
    const key = `${currentOrderIndex}-${itemIndex}`;
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    onSave(editedOrders);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-7xl h-[90vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-blue-500 to-cyan-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📋</span>
            <div>
              <div className="font-bold text-white text-xl">בדיקת הזמנות</div>
              <div className="text-white/80 text-sm">
                הזמנה {currentOrderIndex + 1} מתוך {editedOrders.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ניווט */}
            <button
              onClick={goPrev}
              disabled={currentOrderIndex === 0}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-white text-xl font-bold"
            >
              ←
            </button>
            <button
              onClick={goNext}
              disabled={currentOrderIndex === editedOrders.length - 1}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-white text-xl font-bold"
            >
              →
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Viewer - Left Side */}
          <div className="w-1/2 border-l border-gray-200 bg-gray-100 p-4 overflow-auto">
            {pdfUrl ? (
              <iframe
                ref={pdfIframeRef}
                src={pdfUrl || ""}
                className="w-full h-full rounded-xl border-2 border-gray-300 bg-white"
                title="PDF Preview"
                onLoad={() => {
                  const term = (searchTerm || "").trim();
                  if (!term) return;
                  pdfIframeRef.current?.contentWindow?.postMessage({
                    type: "find",
                    query: term,
                    caseSensitive: false,
                    highlightAll: true,
                    entireWord: false,
                    findPrevious: false,
                  }, "*");
                }}
                allow="fullscreen"
              />

            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <div>אין PDF זמין</div>
                </div>
              </div>
            )}
          </div>

          {/* Order Editor - Right Side */}
          <div className="w-1/2 p-6 overflow-auto">
            {currentOrder && (
              <div className="space-y-6">
                {/* פרטי לקוח */}
                <div className="bg-gradient-to-l from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-200">
                  <div className="text-sm font-semibold text-gray-700 mb-3">פרטי הזמנה</div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">שם לקוח</label>
                      <input
                        type="text"
                        value={currentOrder.clientName || ""}
                        onChange={(e) => updateOrder("clientName", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">תאריך אירוע</label>
                      <input
                        type="date"
                        value={currentOrder.eventDate ? new Date(currentOrder.eventDate).toISOString().split('T')[0] : ""}
                        onChange={(e) => updateOrder("eventDate", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* רשימת מנות */}
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                    <span>מנות ({currentOrder.items?.length || 0})</span>
                    <button
                      onClick={addItem}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700 font-medium transition-all"
                    >
                      + הוסף מנה
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentOrder.items?.map((item: any, idx: number) => {
                      const key = `${currentOrderIndex}-${idx}`;
                      const isChecked = checkedItems[key];

                      return (
                        <div
                          key={idx}
                          className={`border-2 rounded-xl p-3 transition-all ${
                            isChecked 
                              ? "bg-green-50 border-green-300" 
                              : "bg-white border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isChecked || false}
                              onChange={() => toggleCheck(idx)}
                              className="mt-1 w-5 h-5 rounded border-2 border-gray-300"
                            />

                            <div className="flex-1 space-y-2">
                             <input
                              type="text"
                              value={item.title || ""}
                              onChange={(e) => updateItem(idx, "title", e.target.value)}
                              onFocus={(e) => {
                                // כשמתמקדים במנה - מחפשים אותה ב-PDF
                                setSearchTerm(e.target.value);
                              }}
                              
                              placeholder="שם המנה"
                              className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                            />
                              
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={item.qty || 1}
                                  onChange={(e) => updateItem(idx, "qty", parseInt(e.target.value))}
                                  className="w-20 px-2 py-1 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                                />
                                <input
                                  type="text"
                                  value={item.unit || "יח'"}
                                  onChange={(e) => updateItem(idx, "unit", e.target.value)}
                                  className="flex-1 px-2 py-1 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                                  placeholder="יחידה"
                                />
                              </div>

                              {item.notes && (
                                <input
                                  type="text"
                                  value={item.notes || ""}
                                  onChange={(e) => updateItem(idx, "notes", e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-xs"
                                  placeholder="הערות"
                                />
                              )}
                            </div>

                            <button
                              onClick={() => removeItem(idx)}
                              className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all flex-shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* הערות */}
                {currentOrder.orderNotes && (
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">הערות להזמנה</label>
                    <textarea
                      value={currentOrder.orderNotes || ""}
                      onChange={(e) => updateOrder("orderNotes", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none resize-none"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {Object.values(checkedItems).filter(Boolean).length} מתוך {currentOrder?.items?.length || 0} מנות נבדקו
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-blue-500 to-cyan-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>✓</span>
              <span>סיים ושמור ({editedOrders.length} הזמנות)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}