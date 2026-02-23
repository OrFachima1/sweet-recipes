"use client";
import React, { useState, useRef, useEffect } from "react";
import type { DeliveryMethod } from "@/types/orders";

interface ReviewModalProps {
  show: boolean;
  orders: any[];
  files: File[];
  onClose: () => void;
  onSave: (editedOrders: any[]) => void;
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
  const [editingItem, setEditingItem] = useState<string | null>(null); // "orderIndex-itemIndex"

  // PDF URL
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfIframeRef = useRef<HTMLIFrameElement | null>(null);
  const baseBlobRef = useRef<string | null>(null);

  const currentOrder = editedOrders[currentOrderIndex];

  // יצירת/ניקוי blob URL רק כשמתחלף קובץ
  useEffect(() => {
    if (baseBlobRef.current) {
      try { URL.revokeObjectURL(baseBlobRef.current); } catch {}
      baseBlobRef.current = null;
    }

    const f = files[currentOrderIndex];
    if (!f) return;

    const blobUrl = URL.createObjectURL(f);
    baseBlobRef.current = blobUrl;

    const viewer = `/pdfjs/custom-viewer.html?v=9&file=${encodeURIComponent(blobUrl)}#zoom=page-width`;
    setPdfUrl(viewer);
  }, [files, currentOrderIndex]);

  // שלח חיפוש ל-PDF.js
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

    const t = setTimeout(sendFind, 120);
    return () => clearTimeout(t);
  }, [searchTerm, pdfUrl]);

  // ניקוי URL כשסוגרים
  useEffect(() => {
    return () => {
      if (baseBlobRef.current) {
        try { URL.revokeObjectURL(baseBlobRef.current); } catch {}
      }
    };
  }, []);

  if (!show) return null;

  const goNext = () => {
    if (currentOrderIndex < editedOrders.length - 1) {
      setCurrentOrderIndex(prev => prev + 1);
      setEditingItem(null); // סגור עריכה
    }
  };

  const goPrev = () => {
    if (currentOrderIndex > 0) {
      setCurrentOrderIndex(prev => prev - 1);
      setEditingItem(null); // סגור עריכה
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
    const items = [...updated[currentOrderIndex].items, { title: "", qty: 1, notes: "" }];
    updated[currentOrderIndex] = { ...updated[currentOrderIndex], items };
    setEditedOrders(updated);
    // פתח עריכה אוטומטית על הפריט החדש
    setEditingItem(`${currentOrderIndex}-${items.length - 1}`);
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
                src={pdfUrl}
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
                        value={currentOrder.eventDate ? currentOrder.eventDate.split('T')[0] : ""}
                        onChange={(e) => updateOrder("eventDate", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* פרטי אספקה */}
                <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                  <div className="text-sm font-semibold text-gray-700 mb-3">🚚 פרטי אספקה</div>

                  <div className="space-y-3">
                    {/* שיטת אספקה */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateOrder("deliveryMethod", "pickup")}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                          currentOrder.deliveryMethod === "pickup" || !currentOrder.deliveryMethod
                            ? "border-rose-400 bg-rose-50 text-rose-700 font-semibold"
                            : "border-gray-300 hover:border-gray-400 text-gray-600"
                        }`}
                      >
                        <span>🏪</span>
                        <span>איסוף</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateOrder("deliveryMethod", "delivery")}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                          currentOrder.deliveryMethod === "delivery"
                            ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                            : "border-gray-300 hover:border-gray-400 text-gray-600"
                        }`}
                      >
                        <span>🚚</span>
                        <span>משלוח</span>
                      </button>
                    </div>

                    {/* שעה משוערת */}
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">שעה משוערת</label>
                      <input
                        type="time"
                        value={currentOrder.estimatedTime || ""}
                        onChange={(e) => updateOrder("estimatedTime", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* טלפונים */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">טלפון 1</label>
                        <input
                          type="tel"
                          value={currentOrder.phone1 || ""}
                          onChange={(e) => updateOrder("phone1", e.target.value)}
                          placeholder="050-0000000"
                          className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">טלפון 2</label>
                        <input
                          type="tel"
                          value={currentOrder.phone2 || ""}
                          onChange={(e) => updateOrder("phone2", e.target.value)}
                          placeholder="050-0000000"
                          className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* כתובת */}
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">כתובת למשלוח</label>
                      <input
                        type="text"
                        value={currentOrder.address || ""}
                        onChange={(e) => updateOrder("address", e.target.value)}
                        placeholder="רחוב, עיר..."
                        className="w-full px-3 py-2 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none"
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
                      const isEditing = editingItem === key;

                      return (
                        <div
                          key={idx}
                          className={`border-2 rounded-xl p-3 transition-all ${
                            isChecked 
                              ? "bg-green-50 border-green-300" 
                              : "bg-white border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {isEditing ? (
                            // מצב עריכה
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked || false}
                                onChange={() => toggleCheck(idx)}
                                className="mt-1 w-5 h-5 rounded border-2 border-gray-300"
                              />

                              <div className="flex-1 space-y-2">
                                {/* שם מנה + כמות באותה שורה */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={item.title || ""}
                                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                                    onFocus={(e) => setSearchTerm(e.target.value)}
                                    placeholder="שם המנה"
                                    className="flex-1 px-3 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-sm font-medium"
                                    autoFocus
                                  />
                                  <input
                                    type="number"
                                    value={item.qty || 1}
                                    onChange={(e) => updateItem(idx, "qty", parseInt(e.target.value))}
                                    className="w-20 px-3 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-sm text-center font-medium"
                                  />
                                </div>

                                {/* הערות - תמיד מוצג */}
                                <input
                                  type="text"
                                  value={item.notes || ""}
                                  onChange={(e) => updateItem(idx, "notes", e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:border-blue-400 focus:outline-none text-xs"
                                  placeholder="הערות (אופציונלי)"
                                />

                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="text-xs px-3 py-1 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium"
                                >
                                  ✓ סיים עריכה
                                </button>
                              </div>

                              <button
                                onClick={() => removeItem(idx)}
                                className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all flex-shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            // מצב תצוגה (לא נפתחת מקלדת!)
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked || false}
                            onChange={() => toggleCheck(idx)}
                            className="mt-1 w-5 h-5 rounded border-2 border-gray-300"
                          />

                          <div 
                            className="flex-1 cursor-pointer select-none"
                            onClick={(e) => {
                              // Single click - רק חיפוש
                              setSearchTerm(item.title || "");
                            }}
                            onDoubleClick={(e) => {
                              // Double click - מצב עריכה
                              e.preventDefault();
                              setEditingItem(key);
                              setSearchTerm(item.title || "");
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-gray-800">
                                {item.title || "ללא שם"} <span className="text-gray-500">({item.qty || 1})</span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(key);
                                  setSearchTerm(item.title || "");
                                }}
                                className="text-xs px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1"
                              >
                                <span>✏️</span>
                                <span>ערוך</span>
                              </button>
                            </div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 mt-1">💬 {item.notes}</div>
                            )}
                          </div>

                          <button
                            onClick={() => removeItem(idx)}
                            className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all flex-shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* הערות להזמנה */}
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">הערות להזמנה</label>
                  <textarea
                    value={currentOrder.orderNotes || ""}
                    onChange={(e) => updateOrder("orderNotes", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                    placeholder="הערות כלליות להזמנה..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm text-gray-600">
            ✓ {Object.values(checkedItems).filter(Boolean).length} מתוך {currentOrder?.items?.length || 0} מנות נבדקו
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
              <span>סיים ושמור ({editedOrders.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}