"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, CATEGORY_ORDER } from "@/utils/categoryMapping";

interface DayOrdersListProps {
  dayKey: string;
  daysMap: Map<string, any[]>;
  deleteOrder?: (orderId: string) => void; // 👈 Optional - רק למנהלים
  editOrderItem?: (orderId: string, idx: number, patch: any) => void; // 👈 Optional
  removeItemFromOrder?: (orderId: string, idx: number) => void; // 👈 Optional
  onAddItem?: (orderId: string) => void; // 👈 Optional
  noteOpen: Record<string, boolean>;
  toggleNote: (orderId: string, idx: number) => void;
}

export default function DayOrdersList({
  dayKey,
  daysMap,
  deleteOrder,
  editOrderItem,
  removeItemFromOrder,
  onAddItem,
  noteOpen,
  toggleNote,
}: DayOrdersListProps) {
  const orders = daysMap.get(dayKey) || [];
  const [completionState, setCompletionState] = useState<Record<string, { completed: number; status: 'pending' | 'partial' | 'almost' | 'done'; missingNote: string }>>({});
  
  // בדיקה אם יש הרשאות עריכה
  const canEdit = !!editOrderItem;
  const canDelete = !!deleteOrder;
  const canRemoveItems = !!removeItemFromOrder;
  const canAddItems = !!onAddItem;
  
  const getItemKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;
  
  const getCompletionState = (orderId: string, itemIdx: number) => {
    const key = getItemKey(orderId, itemIdx);
    return completionState[key] || { completed: 0, status: 'pending', missingNote: '' };
  };
  
  const cycleCompletionStatus = (orderId: string, itemIdx: number, totalQty: number) => {
    const key = getItemKey(orderId, itemIdx);
    const current = getCompletionState(orderId, itemIdx);
    
    let newState;
    if (current.status === 'pending') {
      newState = { completed: totalQty, status: 'done' as const, missingNote: '' };
    } else if (current.status === 'done') {
      newState = { completed: totalQty, status: 'almost' as const, missingNote: '' };
    } else if (current.status === 'almost') {
      newState = { completed: 0, status: 'pending' as const, missingNote: '' };
    } else {
      newState = { completed: 0, status: 'pending' as const, missingNote: '' };
    }
    
    setCompletionState(prev => ({ ...prev, [key]: newState }));
  };
  
  const updateCompletedQty = (orderId: string, itemIdx: number, completed: number, totalQty: number) => {
    const key = getItemKey(orderId, itemIdx);
    const status = completed === 0 ? 'pending' : completed === totalQty ? 'done' : 'partial';
    setCompletionState(prev => ({ ...prev, [key]: { ...prev[key], completed, status } }));
  };
  
  const updateMissingNote = (orderId: string, itemIdx: number, note: string) => {
    const key = getItemKey(orderId, itemIdx);
    setCompletionState(prev => ({ ...prev, [key]: { ...prev[key], missingNote: note } }));
  };
  
  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {orders.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          אין הזמנות ליום זה
        </div>
      )}
      
      {orders.map((o: any) => {
        const groupedItems = groupItemsByCategory(o.items);
        
        return (
          <div key={o.__id} className="rounded-xl border-2 border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-red-100 px-4 py-3 flex items-center justify-between">
              <div className="font-bold text-gray-900 text-2xl truncate">{o.clientName}</div>
              <div className="flex items-center gap-2">
                {o.status && (
                  <span className="text-sm px-3 py-1 rounded-full bg-white/60 text-gray-700 font-medium">
                    {o.status}
                  </span>
                )}
                {/* כפתור מחק - רק למנהלים */}
                {canDelete && (
                  <button 
                    onClick={() => deleteOrder(o.__id!)} 
                    className="text-red-600 hover:text-red-800 text-base font-medium px-3 py-1 rounded hover:bg-white/50 transition-colors"
                  >
                    מחק
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-base font-bold text-gray-700 flex items-center gap-2">
                  <span>פריטים</span>
                  <span className="text-sm font-normal text-gray-500">({o.items.length})</span>
                </div>
                
                {/* כפתור הוסף מנה - רק למנהלים */}
                {canAddItems && (
                  <button 
                    onClick={() => onAddItem(o.__id!)} 
                    className="text-base px-5 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium shadow-sm"
                  >
                    + הוסף מנה
                  </button>
                )}
              </div>
              
              {/* תצוגה לרוחב - grid של קטגוריות */}
              <div className="grid grid-cols-4 gap-2">
                {CATEGORY_ORDER.map(category => {
                  const categoryItems = groupedItems[category];
                  if (!categoryItems || categoryItems.length === 0) return null;
                  
                  const categoryColor = getCategoryColor(category);
                  
                  return (
                    <div key={category} className="rounded-lg overflow-hidden border-2 flex flex-col" style={{ borderColor: categoryColor }}>
                      {/* כותרת קטגוריה */}
                      <div 
                        className="px-2 py-2 text-center text-sm font-bold text-gray-700"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {category}
                      </div>
                      
                      {/* רשימת פריטים */}
                      <div className="flex-1 overflow-auto" style={{ backgroundColor: `${categoryColor}15` }}>
                        <ul className="divide-y divide-gray-200">
                          {categoryItems.map((it: any) => {
                            const originalIndex = o.items.indexOf(it);
                            const state = getCompletionState(o.__id, originalIndex);
                            const totalQty = Number(it.qty) || 1;
                            
                            // צבעי סטטוס
                            let statusColor = '#9CA3AF'; // אפור
                            let statusIcon = '○';
                            if (state.status === 'done') {
                              statusColor = '#10B981'; // ירוק
                              statusIcon = '✓';
                            } else if (state.status === 'almost') {
                              statusColor = '#3B82F6'; // כחול
                              statusIcon = '≈';
                            } else if (state.status === 'partial') {
                              statusColor = '#F59E0B'; // כתום
                              statusIcon = '◐';
                            }
                            
                            return (
                              <li key={originalIndex} className="p-2">
                                <div className="space-y-1">
                                  {/* שורה ראשונה: שם + כמות */}
                                  <div className="flex items-center gap-2">
                                    {/* כפתור סטטוס */}
                                    <button
                                      onClick={() => cycleCompletionStatus(o.__id, originalIndex, totalQty)}
                                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-sm transition-all hover:scale-110 flex-shrink-0"
                                      style={{ backgroundColor: statusColor }}
                                      title={
                                        state.status === 'pending' ? 'לא התחלנו' :
                                        state.status === 'partial' ? 'בתהליך' :
                                        state.status === 'almost' ? 'כמעט במור' : 'הושלם'
                                      }
                                    >
                                      {statusIcon}
                                    </button>
                                    
                                    {/* שם המנה והכמות */}
                                    <div className="flex-1">
                                      <span className="text-base font-semibold text-gray-900">{it.title}</span>
                                      {canEdit ? (
                                        <span 
                                          className="mr-2 text-lg font-bold cursor-pointer hover:text-blue-600 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newQty = prompt(`כמות עבור ${it.title}:`, String(it.qty));
                                            if (newQty && !isNaN(Number(newQty))) {
                                              editOrderItem(o.__id!, originalIndex, { qty: Number(newQty) });
                                            }
                                          }}
                                          title="לחץ לעריכת כמות"
                                        >
                                          × {it.qty}
                                        </span>
                                      ) : (
                                        <span className="mr-2 text-lg font-bold text-gray-700">
                                          × {it.qty}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* שורה שנייה: התקדמות אם חלקי */}
                                  {(state.status === 'partial' || state.status === 'almost') && (
                                    <div className="flex items-center gap-1 pr-9">
                                      <input
                                        type="number"
                                        min="0"
                                        max={totalQty}
                                        className="w-12 text-center bg-white border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        value={state.completed}
                                        onChange={(e) => updateCompletedQty(o.__id, originalIndex, Number(e.target.value) || 0, totalQty)}
                                      />
                                      <span className="text-sm text-gray-600">/ {totalQty}</span>
                                    </div>
                                  )}
                                  
                                  {/* הערה למנה חלקית או כמעט במורה */}
                                  {(state.status === 'partial' || state.status === 'almost') && (
                                    <textarea
                                      className="w-full text-sm bg-blue-50 border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                                      placeholder={state.status === 'almost' ? "מה חסר?" : "הערה"}
                                      rows={2}
                                      value={state.missingNote}
                                      onChange={(e) => updateMissingNote(o.__id, originalIndex, e.target.value)}
                                    />
                                  )}
                                  
                                  {/* כפתורי פעולה */}
                                  <div className="flex gap-1 pr-9">
                                    {/* כפתור הערה - תמיד זמין */}
                                    <button 
                                      onClick={() => toggleNote(o.__id!, originalIndex)} 
                                      className="text-gray-500 hover:text-blue-600 text-base w-6 h-6 rounded hover:bg-blue-50 flex items-center justify-center" 
                                      title="הערה"
                                    >
                                      📝
                                    </button>
                                    
                                    {/* כפתור הסר - רק למנהלים */}
                                    {canRemoveItems && (
                                      <button 
                                        onClick={() => removeItemFromOrder(o.__id!, originalIndex)} 
                                        className="text-gray-500 hover:text-red-600 text-base w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center" 
                                        title="הסר"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                  
                                  {/* הערות רגילות */}
                                  {noteOpen[`${o.__id}:${originalIndex}`] && (
                                    <div className="mt-1 rounded border border-blue-200 p-2 bg-blue-50">
                                      <textarea
                                        className="w-full bg-white border border-blue-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                                        value={it.notes || ""}
                                        onChange={canEdit ? (e) => editOrderItem(o.__id!, originalIndex, { notes: e.target.value }) : undefined}
                                        placeholder="הערה"
                                        rows={2}
                                        readOnly={!canEdit}
                                        disabled={!canEdit}
                                      />
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}