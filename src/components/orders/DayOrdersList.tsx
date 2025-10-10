"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder} from "@/utils/categoryMapping";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import ClientColorPicker from "./ClientColorPicker"; // ✅ הוסף
import { getTextColor } from "@/utils/colorHelpers"; // ✅ הוסף
interface DayOrdersListProps {
  dayKey: string;
  daysMap: Map<string, any[]>;
  deleteOrder?: (orderId: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
   categories?: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  } | null;
   onEditColor?: (clientName: string, currentColor: string) => void;
  getClientColor?: (clientName: string) => string;
  recipeLinks?: Record<string, string>; // ✅ הוסף

}

export default function DayOrdersList({
  dayKey,
  daysMap,
  deleteOrder,
  editOrderItem,
  removeItemFromOrder,
  onAddItem,
  noteOpen: externalNoteOpen,
  toggleNote: externalToggleNote,
   onEditColor, // ✅ הוסף
  getClientColor, // ✅ הוסף
    recipeLinks, // ✅ הוסף
}: DayOrdersListProps) {
  const orders = daysMap.get(dayKey) || [];
  
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }

  const [localCompletionState, setLocalCompletionState] = useState<Record<string, { completed: number; status: 'pending' | 'partial' | 'almost' | 'done'; missingNote: string }>>({});
  const [localNoteOpen, setLocalNoteOpen] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [editingClient, setEditingClient] = useState<{ name: string; color: string } | null>(null);

  const canEdit = !!editOrderItem;
  const canDelete = !!deleteOrder;
  const canRemoveItems = !!removeItemFromOrder;
  const canAddItems = !!onAddItem;

  const getItemKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;
  
  const getItemState = (orderId: string, itemIdx: number) => {
    if (tracking) {
      return tracking.getItemState(orderId, itemIdx);
    }
    const key = getItemKey(orderId, itemIdx);
    return localCompletionState[key] || { completed: 0, status: 'pending' as const, missingNote: '' };
  };

  const cycleCompletionStatus = (orderId: string, itemIdx: number, totalQty: number) => {
    const current = getItemState(orderId, itemIdx);
    
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
    
    if (tracking) {
      tracking.updateItemState(orderId, itemIdx, newState);
    } else {
      const key = getItemKey(orderId, itemIdx);
      setLocalCompletionState(prev => ({ ...prev, [key]: newState }));
    }
  };
  
  const updateCompletedQty = (orderId: string, itemIdx: number, completed: number, totalQty: number) => {
    const status = completed === 0 ? 'pending' : completed === totalQty ? 'done' : 'partial';
    
    if (tracking) {
      tracking.updateItemState(orderId, itemIdx, { completed, status });
    } else {
      const key = getItemKey(orderId, itemIdx);
      setLocalCompletionState(prev => ({ ...prev, [key]: { ...prev[key], completed, status } }));
    }
  };
  
  const updateMissingNote = (orderId: string, itemIdx: number, note: string) => {
    if (tracking) {
      tracking.updateItemState(orderId, itemIdx, { missingNote: note });
    } else {
      const key = getItemKey(orderId, itemIdx);
      setLocalCompletionState(prev => ({ ...prev, [key]: { ...prev[key], missingNote: note } }));
    }
  };

  const handleToggleNote = (orderId: string, itemIdx: number) => {
    if (externalToggleNote) {
      externalToggleNote(orderId, itemIdx);
    } else if (tracking) {
      tracking.toggleNote(orderId, itemIdx);
    } else {
      const key = getItemKey(orderId, itemIdx);
      setLocalNoteOpen(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleNoteChange = (orderId: string, itemIdx: number, note: string) => {
    if (tracking) {
      tracking.updateItemNote(orderId, itemIdx, note);
    }
    if (editOrderItem) {
      editOrderItem(orderId, itemIdx, { notes: note });
    }
  };

  const isNoteOpen = (orderId: string, itemIdx: number) => {
    const key = getItemKey(orderId, itemIdx);
    if (externalNoteOpen) {
      return externalNoteOpen[key] || false;
    } else if (tracking) {
      return tracking.noteStates[key] || false;
    } else {
      return localNoteOpen[key] || false;
    }
  };

  const handleSaveOrder = (order: any) => {
    if (tracking) {
      tracking.saveOrderChanges(order.__id, order.clientName, order.items);
      alert(`✅ השינויים נשמרו`);
    }
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
        const orderHistory = tracking ? tracking.getOrderHistory(o.__id) : [];
        
        return (
          <div key={o.__id} className="rounded-xl border-2 border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Header */}
           {/* Header */}
<div 
  className="px-4 py-2 flex items-center justify-between"
  style={{ 
    backgroundColor: o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff')
  }}
>
  <div 
    className="font-bold text-xl truncate"
    style={{ 
      color: getTextColor(o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff'))
    }}
  >
    {o.clientName}
  </div>
  
  <div className="flex items-center gap-2">
    {/* ✅ כפתור עריכת צבע */}
    {onEditColor && getClientColor && (
      <button
        onClick={() => setEditingClient({ 
          name: o.clientName, 
          color: o.clientColor || getClientColor(o.clientName) 
        })}
        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10 transition-all"
        title="שנה צבע"
        style={{ 
          color: getTextColor(o.clientColor || getClientColor(o.clientName))
        }}
      >
        🎨
      </button>
    )}
    
    {o.status && (
      <span 
        className="text-xs px-2 py-1 rounded-full font-medium"
        style={{
          backgroundColor: 'rgba(255,255,255,0.3)',
          color: getTextColor(o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff'))
        }}
      >
        {o.status}
      </span>
    )}
    
    {tracking && (
      <>
        <button
          onClick={() => handleSaveOrder(o)}
          className="text-sm font-medium px-2 py-1 rounded hover:bg-white/50 flex items-center gap-1"
          title="שמור שינויים"
          style={{ 
            color: getTextColor(o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff'))
          }}
        >
          💾 <span className="hidden sm:inline">שמור</span>
        </button>
        
        {orderHistory.length > 0 && (
          <button
            onClick={() => setShowHistory(prev => ({ ...prev, [o.__id]: !prev[o.__id] }))}
            className="text-sm font-medium px-2 py-1 rounded hover:bg-white/50"
            title="היסטוריית שינויים"
            style={{ 
              color: getTextColor(o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff'))
            }}
          >
            📜 {orderHistory.length}
          </button>
        )}
      </>
    )}
    
    {canDelete && (
      <button 
        onClick={() => {
          if (confirm(`האם למחוק את ההזמנה של ${o.clientName}?`)) {
            deleteOrder(o.__id!);
          }
        }}
        className="text-sm font-medium px-2 py-1 rounded hover:bg-white/50"
        style={{ 
          color: getTextColor(o.clientColor || (getClientColor ? getClientColor(o.clientName) : '#73a1ecff'))
        }}
      >
        🗑️
      </button>
    )}
  </div>
</div>

            {/* היסטוריית שינויים - קומפקטית */}
            {tracking && showHistory[o.__id] && orderHistory.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200">
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span>📜</span>
                  <span>היסטוריית שינויים</span>
                  <span className="text-xs text-gray-600">({orderHistory.length})</span>
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {orderHistory.map(log => {
                    // קיבוץ שינויים לפי פריט
                    const itemChangesMap = new Map<number, {
                      title: string;
                      status?: { old: string; new: string };
                      completed?: { old: number; new: number };
                      missingNote?: string;
                      note?: boolean;
                    }>();

                    log.changes?.forEach(change => {
                      if (!itemChangesMap.has(change.itemIndex)) {
                        itemChangesMap.set(change.itemIndex, { title: change.itemTitle });
                      }
                      const item = itemChangesMap.get(change.itemIndex)!;
                      
                      if (change.type === 'status') {
                        item.status = { old: change.oldValue, new: change.newValue };
                      } else if (change.type === 'completed') {
                        item.completed = { old: change.oldValue, new: change.newValue };
                      } else if (change.type === 'missingNote') {
                        item.missingNote = change.newValue;
                      } else if (change.type === 'note') {
                        item.note = true;
                      }
                    });

                    return (
                      <div key={log.id} className="bg-white rounded-lg px-3 py-2 border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-blue-700 text-sm">👤 {log.userName}</span>
                          <span className="text-xs text-gray-500">
                            {log.timestamp.toLocaleString('he-IL', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {itemChangesMap.size > 0 && (
                          <div className="space-y-1">
                            {Array.from(itemChangesMap.entries()).map(([idx, item]) => {
                              const statusEmoji: Record<string, string> = {
                                pending: '○',
                                partial: '◐',
                                almost: '≈',
                                done: '✓'
                              };
                              
                              // בניית שורה אחת לפריט
                              const parts: string[] = [];
                              
                              // סטטוס עם חיצים הפוכים
                              if (item.status) {
                                parts.push(`${statusEmoji[item.status.new]} → ${statusEmoji[item.status.old]}`);
                              }
                              
                              // כמות - הנוכחי מול הכולל
                              if (item.completed && item.status) {
                                // מוצאים את הכמות הכוללת מהפריטים המקוריים
                                const originalItem = o.items[idx];
                                const totalQty = originalItem?.qty || item.completed.new;
                                parts.push(`(${item.completed.new}/${totalQty})`);
                              }
                              
                              // הערת חסר
                              if (item.missingNote) {
                                parts.push(`"${item.missingNote}"`);
                              }
                              
                              // הערה רגילה
                              if (item.note) {
                                parts.push('💬');
                              }
                              
                              return (
                                <div key={idx} className="text-xs text-gray-700 py-0.5">
                                  <span className="font-semibold">{item.title}:</span>{' '}
                                  <span>{parts.join(' | ')}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
           {getCategoryOrder().map(category => {
                  const categoryItems = groupedItems[category];
                  if (!categoryItems || categoryItems.length === 0) return null;
                  
                  const categoryColor = getCategoryColor(category);
                  
                  return (
                    <div key={category} className="flex gap-2">
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
                      
                      <div className="flex-1 space-y-1">
                        {categoryItems.map((it: any) => {
                          const originalIndex = o.items.indexOf(it);
                          const state = getItemState(o.__id, originalIndex);
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
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => cycleCompletionStatus(o.__id, originalIndex, totalQty)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                                  style={{ backgroundColor: statusColor }}
                                >
                                  {statusIcon}
                                </button>
                                
                                <div className="flex-1 flex items-center gap-1">
{recipeLinks?.[it.title] ? (
  <a
    href={`/recipes/${recipeLinks[it.title]}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()} // אם לשורה יש onClick אחר
    className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
    title="פתח מתכון"
  >
    {it.title}
  </a>
) : (
  <span className="text-sm font-semibold text-gray-900">{it.title}</span>
)}


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
                                
                                <div className="flex gap-1 flex-shrink-0">
                                  <button 
                                    onClick={() => handleToggleNote(o.__id!, originalIndex)} 
                                    className={`w-5 h-5 flex items-center justify-center text-sm rounded transition-all ${
                                      it.notes && it.notes.trim() 
                                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                        : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                    title={it.notes && it.notes.trim() ? 'יש הערה - לחץ לצפייה' : 'הוסף הערה'}
                                  >
                                    {it.notes && it.notes.trim() ? '💬' : '📝'}
                                  </button>
                                  
                                  {canRemoveItems && (
                                    <button 
                                      onClick={() => {
                                        if (confirm(`האם להסיר את ${it.title}?`)) {
                                          removeItemFromOrder(o.__id!, originalIndex);
                                        }
                                      }}
                                      className="text-gray-500 hover:text-red-600 w-5 h-5 flex items-center justify-center font-bold"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                              
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
                              
                              {(state.status === 'partial' || state.status === 'almost') && (
                                <textarea
                                  className="w-full text-xs bg-blue-50 border border-blue-300 rounded px-2 py-1 mt-1 mr-8"
                                  placeholder={state.status === 'almost' ? "מה חסר?" : "הערה"}
                                  rows={1}
                                  value={state.missingNote}
                                  onChange={(e) => updateMissingNote(o.__id, originalIndex, e.target.value)}
                                />
                              )}
                              
                              {isNoteOpen(o.__id, originalIndex) && (
                                <textarea
                                  className="w-full bg-white border border-blue-300 rounded p-2 text-xs mt-1 mr-8"
                                  value={it.notes || ""}
                                  onChange={canEdit ? (e) => handleNoteChange(o.__id!, originalIndex, e.target.value) : undefined}
                                  placeholder="הערה"
                                  rows={2}
                                  readOnly={!canEdit}
                                />
                              )}
                                  {/* ✅ הוסף את זה */}
    {editingClient && onEditColor && (
      <ClientColorPicker
        show={!!editingClient}
        clientName={editingClient.name}
        currentColor={editingClient.color}
        onClose={() => setEditingClient(null)}
        onSave={async (newColor) => {
          await onEditColor(editingClient.name, newColor);
          setEditingClient(null);
        }}
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