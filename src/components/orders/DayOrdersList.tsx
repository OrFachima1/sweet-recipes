"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, CATEGORY_ORDER } from "@/utils/categoryMapping";

interface DayOrdersListProps {
  dayKey: string;
  daysMap: Map<string, any[]>;
  deleteOrder?: (orderId: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
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
            <div className="bg-red-100 px-4 py-2 flex items-center justify-between">
              <div className="font-bold text-gray-900 text-xl truncate">{o.clientName}</div>
              <div className="flex items-center gap-2">
                {o.status && (
                  <span className="text-xs px-2 py-1 rounded-full bg-white/60 text-gray-700 font-medium">
                    {o.status}
                  </span>
                )}
                {canDelete && (
                  <button 
                    onClick={() => deleteOrder(o.__id!)} 
                    className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-white/50"
                  >
                    מחק
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-gray-700">
                  פריטים ({o.items.length})
                </div>
                
                {canAddItems && (
                  <button 
                    onClick={() => onAddItem(o.__id!)} 
                    className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    + הוסף מנה
                  </button>
                )}
              </div>
              
              {/* תצוגת קבוצות קטגוריה */}
              <div className="space-y-2">
                {CATEGORY_ORDER.map(category => {
                  const categoryItems = groupedItems[category];
                  if (!categoryItems || categoryItems.length === 0) return null;
                  
                  const categoryColor = getCategoryColor(category);
                  
                  return (
                    <div key={category} className="flex gap-2">
                      {/* תג קטגוריה מצד ימין */}
                      <div 
                        className="flex-shrink-0 w-20 rounded-lg flex items-center justify-center text-xs font-bold text-gray-700 px-2 py-1"
                        style={{ 
                          backgroundColor: categoryColor,
                          writingMode: categoryItems.length > 5 ? 'vertical-rl' : 'horizontal-tb',
                          textOrientation: categoryItems.length > 5 ? 'mixed' : 'initial'
                        }}
                      >
                        {category}
                      </div>
                      
                      {/* רשימת מנות */}
                      <div className="flex-1 space-y-1">
                        {categoryItems.map((it: any) => {
                          const originalIndex = o.items.indexOf(it);
                          const state = getCompletionState(o.__id, originalIndex);
                          const totalQty = Number(it.qty) || 1;
                          
                          let statusColor = '#9CA3AF';
                          let statusIcon = '○';
                          if (state.status === 'done') {
                            statusColor = '#10B981';
                            statusIcon = '✓';
                          } else if (state.status === 'almost') {
                            statusColor = '#3B82F6';
                            statusIcon = '≈';
                          } else if (state.status === 'partial') {
                            statusColor = '#F59E0B';
                            statusIcon = '◐';
                          }
                          
                          return (
                            <div 
                              key={originalIndex} 
                              className="rounded-lg p-2 border"
                              style={{ 
                                backgroundColor: `${categoryColor}15`,
                                borderColor: categoryColor
                              }}
                            >
                              {/* שורה ראשונה: סטטוס + שם + כמות + כפתורים */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => cycleCompletionStatus(o.__id, originalIndex, totalQty)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                                  style={{ backgroundColor: statusColor }}
                                >
                                  {statusIcon}
                                </button>
                                
                                <div className="flex-1 flex items-center gap-1">
                                  <span className="text-sm font-semibold text-gray-900">{it.title}</span>
                                  {canEdit ? (
                                    <span 
                                      className="text-base font-bold cursor-pointer hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newQty = prompt(`כמות עבור ${it.title}:`, String(it.qty));
                                        if (newQty && !isNaN(Number(newQty))) {
                                          editOrderItem(o.__id!, originalIndex, { qty: Number(newQty) });
                                        }
                                      }}
                                    >
                                      ×{it.qty}
                                    </span>
                                  ) : (
                                    <span className="text-base font-bold text-gray-700">
                                      ×{it.qty}
                                    </span>
                                  )}
                                </div>
                                
                                {/* כפתורי פעולה */}
                                <div className="flex gap-1 flex-shrink-0">
                                  <button 
                                    onClick={() => toggleNote(o.__id!, originalIndex)} 
                                    className="text-gray-500 hover:text-blue-600 w-5 h-5 flex items-center justify-center text-sm"
                                  >
                                    📝
                                  </button>
                                  
                                  {canRemoveItems && (
                                    <button 
                                      onClick={() => removeItemFromOrder(o.__id!, originalIndex)} 
                                      className="text-gray-500 hover:text-red-600 w-5 h-5 flex items-center justify-center font-bold"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* התקדמות אם חלקי */}
                              {(state.status === 'partial' || state.status === 'almost') && (
                                <div className="flex items-center gap-1 mt-1 mr-8">
                                  <input
                                    type="number"
                                    min="0"
                                    max={totalQty}
                                    className="w-10 text-center bg-white border border-gray-300 rounded px-1 py-0.5 text-xs"
                                    value={state.completed}
                                    onChange={(e) => updateCompletedQty(o.__id, originalIndex, Number(e.target.value) || 0, totalQty)}
                                  />
                                  <span className="text-xs text-gray-600">/ {totalQty}</span>
                                </div>
                              )}
                              
                              {/* הערה למנה חלקית */}
                              {(state.status === 'partial' || state.status === 'almost') && (
                                <textarea
                                  className="w-full text-xs bg-blue-50 border border-blue-300 rounded px-2 py-1 mt-1 mr-8"
                                  placeholder={state.status === 'almost' ? "מה חסר?" : "הערה"}
                                  rows={1}
                                  value={state.missingNote}
                                  onChange={(e) => updateMissingNote(o.__id, originalIndex, e.target.value)}
                                />
                              )}
                              
                              {/* הערות רגילות */}
                              {noteOpen[`${o.__id}:${originalIndex}`] && (
                                <textarea
                                  className="w-full bg-white border border-blue-300 rounded p-2 text-xs mt-1 mr-8"
                                  value={it.notes || ""}
                                  onChange={canEdit ? (e) => editOrderItem(o.__id!, originalIndex, { notes: e.target.value }) : undefined}
                                  placeholder="הערה"
                                  rows={2}
                                  readOnly={!canEdit}
                                />
                              )}
                            </div>
                          );
                        })}
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