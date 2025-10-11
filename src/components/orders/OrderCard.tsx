"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder } from "@/utils/categoryMapping";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import ClientColorPicker from "./ClientColorPicker";
import { getTextColor } from "@/utils/colorHelpers";

interface OrderCardProps {
  order: any;
  // View mode
  mode: "day" | "client"; // day = full features, client = compact
  
  // Color
  clientColor?: string;
  onEditColor?: (clientName: string, currentColor: string) => void;
  
  // Actions (optional - for manager mode)
  onDelete?: (orderId: string) => void;
  onEditItem?: (orderId: string, idx: number, patch: any) => void;
  onRemoveItem?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void; // 🔥 חדש!
  
  // Recipe links
  recipeLinks?: Record<string, string>;
  
  // Note management
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
}

export default function OrderCard({
  order,
  mode,
  clientColor,
  onEditColor,
  onDelete,
  onEditItem,
  onRemoveItem,
  onAddItem,
  onEditOrderNotes,
  recipeLinks,
  noteOpen: externalNoteOpen,
  toggleNote: externalToggleNote,
}: OrderCardProps) {
  // Tracking context
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }

  // Local states
  const [localCompletionState, setLocalCompletionState] = useState<Record<string, any>>({});
  const [localNoteOpen, setLocalNoteOpen] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [editingClient, setEditingClient] = useState<{ name: string; color: string } | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState<number | null>(null);
  const [editingOrderNotes, setEditingOrderNotes] = useState(false);
  const [orderNotesText, setOrderNotesText] = useState(
    Array.isArray(order.orderNotes) ? order.orderNotes.join("\n") : order.orderNotes || ""
  );
  const [currentBgColor, setCurrentBgColor] = useState(clientColor || '#73a1ecff'); // 🔥 שמירה מקומית!

  // Permissions - עריכה בכל המצבים, מחיקה רק ב-day
  const canEdit = !!onEditItem;
  const canDelete = mode === "day" && !!onDelete;
  const canRemoveItems = mode === "day" && !!onRemoveItem;
  const canAddItems = mode === "day" && !!onAddItem;

  // Helper functions
  const getItemKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;
  
  const getItemState = (orderId: string, itemIdx: number) => {
    if (tracking) {
      return tracking.getItemState(orderId, itemIdx);
    }
    const key = getItemKey(orderId, itemIdx);
    return localCompletionState[key] || { completed: 0, status: 'pending', missingNote: '' };
  };

  const cycleCompletionStatus = (orderId: string, itemIdx: number, totalQty: number) => {
    const current = getItemState(orderId, itemIdx);
    
    let newState: { completed: number; status: 'pending' | 'partial' | 'almost' | 'done'; missingNote: string };
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
    const status: 'pending' | 'partial' | 'done' = completed === 0 ? 'pending' : completed === totalQty ? 'done' : 'partial';
    
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
    if (onEditItem) {
      onEditItem(orderId, itemIdx, { notes: note });
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

  const handleSaveItemTitle = (itemIdx: number, newTitle: string) => {
    if (canEdit && newTitle.trim()) {
      onEditItem!(order.__id, itemIdx, { title: newTitle.trim() });
      setEditingItemTitle(null);
    }
  };

  const handleSaveOrderNotes = () => {
    if (onEditOrderNotes) {
      onEditOrderNotes(order.__id, orderNotesText);
    }
    setEditingOrderNotes(false);
  };

  const groupedItems = groupItemsByCategory(order.items);
  const orderHistory = tracking ? tracking.getOrderHistory(order.__id) : [];
  const bgColor = currentBgColor; // 🔥 משתמשים ב-state המקומי
  const textColor = getTextColor(bgColor);

  // Render styles based on mode
  const containerClass = mode === "day" 
    ? "rounded-xl border-2 border-gray-200 bg-white shadow-sm overflow-hidden"
    : "rounded-lg border-2 border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow";
  
  const headerPadding = mode === "day" ? "px-4 py-2" : "px-3 py-2";
  const bodyPadding = mode === "day" ? "p-3" : "p-2";
  const categoryWidth = mode === "day" ? "w-20" : "w-14";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className={`${headerPadding} flex items-center justify-between`} style={{ backgroundColor: bgColor }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="font-bold text-xl truncate" style={{ color: textColor }}>
            {order.clientName}
          </div>
          {mode === "client" && order.eventDate && (
            <div className="text-xs opacity-80 flex-shrink-0" style={{ color: textColor }}>
              {new Date(order.eventDate).toLocaleDateString('he-IL', { 
                day: 'numeric', 
                month: 'short' 
              })}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onEditColor && (
            <button
              onClick={() => setEditingClient({ name: order.clientName, color: bgColor })}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title="שנה צבע"
            >
              🎨
            </button>
          )}
          
          {tracking && orderHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title="היסטוריית שינויים"
            >
              📜 {orderHistory.length}
            </button>
          )}
          
          {canDelete && mode === "day" && (
            <button 
              onClick={() => {
                if (confirm(`האם למחוק את ההזמנה של ${order.clientName}?`)) {
                  onDelete(order.__id);
                }
              }}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title="מחק הזמנה"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* History Section */}
      {tracking && showHistory && orderHistory.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200">
          <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span>📜</span>
            <span>היסטוריית שינויים</span>
            <span className="text-xs text-gray-600">({orderHistory.length})</span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {orderHistory.slice(0, 3).map(log => (
              <div key={log.id} className="bg-white rounded-lg px-3 py-2 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-blue-700 text-xs">👤 {log.userName}</span>
                  <span className="text-xs text-gray-500">
                    {log.timestamp.toLocaleString('he-IL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="text-xs text-gray-700">
                  {log.changes?.length || 0} שינויים
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Notes Section */}
      <div className={bodyPadding}>
                  <div className="mb-3 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-700">💬 הערות להזמנה</span>
            {onEditOrderNotes && !editingOrderNotes && (
              <button
                onClick={() => setEditingOrderNotes(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                ✏️ ערוך
              </button>
            )}
          </div>
          {editingOrderNotes ? (
            <div className="space-y-1">
              <textarea
                value={orderNotesText}
                onChange={(e) => setOrderNotesText(e.target.value)}
                className="w-full text-xs p-2 border border-yellow-300 rounded resize-none"
                rows={3}
                placeholder="הערות כלליות להזמנה..."
              />
              <div className="flex gap-1">
                <button
                  onClick={handleSaveOrderNotes}
                  className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  💾 שמור
                </button>
                <button
                  onClick={() => {
                    setEditingOrderNotes(false);
                    setOrderNotesText(
                      Array.isArray(order.orderNotes) ? order.orderNotes.join("\n") : order.orderNotes || ""
                    );
                  }}
                  className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              {orderNotesText || "אין הערות"}
            </div>
          )}
        </div>

        {/* Items Header */}
        <div className="flex items-center justify-between mb-2">
          <div className={`${mode === "day" ? "text-sm" : "text-xs"} font-bold text-gray-700`}>
            פריטים ({order.items.length})
          </div>
          
          {canAddItems && mode === "day" && (
            <button 
              onClick={() => onAddItem(order.__id)}
              className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
            >
              + הוסף מנה
            </button>
          )}
        </div>
        
        {/* Items by Category */}
        <div className={mode === "day" ? "space-y-2" : "space-y-1.5"}>
          {getCategoryOrder().map(category => {
            const categoryItems = groupedItems[category];
            if (!categoryItems || categoryItems.length === 0) return null;
            
            const categoryColor = getCategoryColor(category);
            const shouldRotate = mode === "day" ? categoryItems.length > 5 : categoryItems.length > 4;
            
            return (
              <div key={category} className={`flex ${mode === "day" ? "gap-2" : "gap-1.5"}`}>
                <div 
                  className={`flex-shrink-0 ${categoryWidth} rounded-${mode === "day" ? "lg" : "md"} flex items-center justify-center ${mode === "day" ? "text-xs" : "text-xs"} font-bold text-gray-700 px-2 py-1`}
                  style={{ 
                    backgroundColor: categoryColor,
                    writingMode: shouldRotate ? 'vertical-rl' : 'horizontal-tb',
                    textOrientation: shouldRotate ? 'mixed' : 'initial'
                  }}
                >
                  {category}
                </div>
                
                <div className={`flex-1 ${mode === "day" ? "space-y-1" : "space-y-0.5"}`}>
                  {categoryItems.map((it: any) => {
                    const originalIndex = order.items.indexOf(it);
                    const state = getItemState(order.__id, originalIndex);
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
                      statusIcon = '●';
                    }
                    
                    return (
                      <div 
                        key={originalIndex} 
                        className={`rounded-${mode === "day" ? "lg" : "md"} ${mode === "day" ? "p-2" : "p-1.5"} border`}
                        style={{ 
                          backgroundColor: `${categoryColor}15`,
                          borderColor: categoryColor
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cycleCompletionStatus(order.__id, originalIndex, totalQty)}
                            className={`${mode === "day" ? "w-6 h-6" : "w-5 h-5"} rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0`}
                            style={{ backgroundColor: statusColor }}
                          >
                            {statusIcon}
                          </button>
                          
                          <div className="flex-1 flex items-center gap-1 group">
                            {editingItemTitle === originalIndex ? (
                              <input
                                type="text"
                                defaultValue={it.title}
                                autoFocus
                                onBlur={(e) => handleSaveItemTitle(originalIndex, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveItemTitle(originalIndex, e.currentTarget.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingItemTitle(null);
                                  }
                                }}
                                className="text-sm font-semibold border-2 border-blue-400 rounded px-2 py-0.5 flex-1"
                              />
                            ) : (
                              <>
                                <div className="flex-1 flex items-center gap-1">
                                  {recipeLinks?.[it.title] ? (
                                    <a
                                      href={`/recipes/${recipeLinks[it.title]}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                                      title="פתח מתכון"
                                    >
                                      {it.title}
                                    </a>
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-900">
                                      {it.title}
                                    </span>
                                  )}
                                  
                                  {canEdit && (
                                    <button
                                      onClick={() => setEditingItemTitle(originalIndex)}
                                      className="text-xs text-gray-400 hover:text-blue-600 p-1"
                                      title="ערוך שם"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {canEdit ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={totalQty}
                                      onChange={(e) => {
                                        const newQty = Math.max(0, parseInt(e.target.value) || 0);
                                        if (onEditItem && newQty !== totalQty) {
                                          onEditItem(order.__id, originalIndex, { qty: newQty });
                                        }
                                      }}
                                      className={`${mode === "day" ? "w-12" : "w-10"} ${mode === "day" ? "text-sm" : "text-xs"} font-bold text-gray-700 border border-gray-300 rounded px-1 text-center`}
                                      title="עדכן כמות"
                                    />
                                  ) : (
                                    <span className={`${mode === "day" ? "text-sm" : "text-xs"} font-bold text-gray-700`}>
                                      × {totalQty}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          
                          {canRemoveItems && (
                            <button
                              onClick={() => {
                                if (confirm(`האם להסיר את ${it.title}?`)) {
                                  onRemoveItem!(order.__id, originalIndex);
                                }
                              }}
                              className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        
                        {/* Status Controls */}
                        {mode === "day" && state.status !== 'pending' && (
                          <div className="mt-2 space-y-1">
                            {state.status !== 'done' && (
                              <>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min="0"
                                    max={totalQty}
                                    value={state.completed || 0}
                                    onChange={(e) => updateCompletedQty(order.__id, originalIndex, Number(e.target.value), totalQty)}
                                    className="flex-1"
                                  />
                                  <span className="text-xs font-mono text-gray-600 w-12 text-center">
                                    {state.completed || 0}/{totalQty}
                                  </span>
                                </div>
                                
                                <input
                                  type="text"
                                  value={state.missingNote || ''}
                                  onChange={(e) => updateMissingNote(order.__id, originalIndex, e.target.value)}
                                  placeholder="מה חסר?"
                                  className="w-full text-xs p-1 border border-orange-300 rounded"
                                />
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Notes */}
                        {mode === "day" && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleToggleNote(order.__id, originalIndex)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              💬 {isNoteOpen(order.__id, originalIndex) ? 'סגור הערה' : 'הוסף הערה'}
                            </button>
                            
                            {isNoteOpen(order.__id, originalIndex) && (
                              <textarea
                                value={it.notes || ''}
                                onChange={(e) => handleNoteChange(order.__id, originalIndex, e.target.value)}
                                placeholder="הערות לפריט..."
                                className="w-full mt-1 text-xs p-2 border border-gray-300 rounded resize-none"
                                rows={2}
                              />
                            )}
                          </div>
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

      {/* Color Picker Modal */}
      {editingClient && onEditColor && (
        <ClientColorPicker
          show={!!editingClient}
          clientName={editingClient.name}
          currentColor={editingClient.color}
          onClose={() => setEditingClient(null)}
          onSave={async (newColor) => {
            await onEditColor(editingClient.name, newColor);
            setCurrentBgColor(newColor); // 🔥 עדכון מיידי!
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}