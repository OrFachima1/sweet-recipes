"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder } from "@/utils/categoryMapping";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import ClientColorPicker from "./ClientColorPicker";
import { getTextColor } from "@/utils/colorHelpers";

interface OrderCardProps {
  order: any;
  mode: "day" | "client";
  
  clientColor?: string;
  onEditColor?: (clientName: string, currentColor: string) => void;
  
  onDelete?: (orderId: string) => void;
  onEditItem?: (orderId: string, idx: number, patch: any) => void;
  onRemoveItem?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void;
  
  recipeLinks?: Record<string, string>;
  
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  
  // accordion
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (orderId: string, isExpanded: boolean) => void;
  externalExpanded?: boolean;
  
  // בישה ותפריט
  isManager?: boolean;
  menuOptions?: string[];
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'ממתין',
    'partial': 'בביצוע',
    'almost': 'כמעט גמור',
    'done': 'הושלם'
  };
  return statusMap[status] || status;
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
  isCollapsible = false,
  defaultExpanded = true,
  onToggle,
  externalExpanded,
  isManager = false,
  menuOptions = []
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
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const [showHistory, setShowHistory] = useState(false);
  const [editingClient, setEditingClient] = useState<{ name: string; color: string } | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState<number | null>(null);
  const [editingItemQty, setEditingItemQty] = useState<number | null>(null);
  const [editingItemNote, setEditingItemNote] = useState<number | null>(null);
  const [editingOrderNotes, setEditingOrderNotes] = useState(false);
  const [orderNotesText, setOrderNotesText] = useState(
    Array.isArray(order.orderNotes) ? order.orderNotes.join("\n") : order.orderNotes || ""
  );
  const [currentBgColor, setCurrentBgColor] = useState(clientColor || '#73a1ecff');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  // 🔥 תיקון 2: הוספת state למצב עריכה/צפייה
  const [isEditMode, setIsEditMode] = useState(false);

  // מצב expanded - חיצוני או מקומי
  const isExpanded = externalExpanded !== undefined ? externalExpanded : localExpanded;

  // Toggle accordion
  const handleToggle = () => {
    if (!isCollapsible) return;
    
    const newExpanded = !isExpanded;
    setLocalExpanded(newExpanded);
    onToggle?.(order.__id, newExpanded);
  };

  // 🔥 תיקון 2: Permissions - עריכה רק במצב עריכה
  const canEdit = !!onEditItem && isManager && isEditMode;
  const canDelete = !!onDelete && isManager && isEditMode;
  const canRemoveItems = !!onRemoveItem && isManager && isEditMode;
  const canAddItems =  !!onAddItem && isManager && isEditMode;

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
    if (canEdit && newTitle.trim() && menuOptions.includes(newTitle.trim())) {
      onEditItem!(order.__id, itemIdx, { title: newTitle.trim() });
      setEditingItemTitle(null);
      setSearchTerm("");
      setShowAutocomplete(false);
    }
  };

  const handleSaveItemQty = (itemIdx: number, newQty: number) => {
    if (canEdit && newQty > 0) {
      onEditItem!(order.__id, itemIdx, { qty: newQty });
      setEditingItemQty(null);
    }
  };

  const handleSaveItemNote = (itemIdx: number, note: string) => {
    if (canEdit) {
      onEditItem!(order.__id, itemIdx, { notes: note });
      setEditingItemNote(null);
    }
  };

  // 🔥 תיקון 1: שמירת הערות להזמנה - וידוא שאין undefined
  const handleSaveOrderNotes = () => {
    if (onEditOrderNotes) {
      const cleanNotes = orderNotesText?.trim() || "";
      onEditOrderNotes(order.__id, cleanNotes);
    }
    setEditingOrderNotes(false);
  };

  // אוטוקומפליט מסונן
  const filteredMenuOptions = menuOptions.filter((option: string) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  // חישוב סטטיסטיקות
  const getStats = () => {
    if (!tracking) return { done: 0, total: order.items?.length || 0, percentage: 0 };
    
    let done = 0;
    const total = order.items?.length || 0;
    
    order.items?.forEach((_: any, idx: number) => {
      const state = getItemState(order.__id, idx);
      if (state.status === 'done') {
        done++;
      }
    });
    
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percentage };
  };

  const stats = getStats();
  const groupedItems = groupItemsByCategory(order.items || []);
  const orderHistory = tracking ? tracking.getOrderHistory(order.__id) : [];
  const bgColor = currentBgColor;
  const textColor = getTextColor(bgColor);

  // Render styles
  const containerClass = mode === "day" 
    ? "rounded-xl border-2 border-gray-200 bg-white shadow-sm overflow-hidden"
    : "rounded-lg border-2 border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow";
  
  const headerPadding = mode === "day" ? "px-4 py-3" : "px-3 py-2";
  const bodyPadding = mode === "day" ? "p-3" : "p-2";
  const categoryWidth = mode === "day" ? "w-20" : "w-14";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div 
        className={`${headerPadding} flex items-center justify-between ${isCollapsible ? 'cursor-pointer hover:opacity-90' : ''} transition-all`}
        style={{ backgroundColor: bgColor }}
        onClick={isCollapsible ? handleToggle : undefined}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* חץ accordion */}
          {isCollapsible && (
            <span className="text-white text-xl font-bold transition-transform duration-200" style={{ 
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(90deg)' 
            }}>
              ▼
            </span>
          )}
          
          {/* שם לקוח */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`${mode === "day" ? "text-lg" : "text-base"} font-bold truncate`} style={{ color: textColor }}>
                {order.clientName}
              </span>
            </div>
            {mode === "client" && order.eventDate && (
              <span className="text-xs" style={{ color: textColor, opacity: 0.8 }}>
                {new Date(order.eventDate).toLocaleDateString('he-IL')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* סטטיסטיקות */}
          {tracking && (
            <div className={`text-xs px-2 py-1 rounded font-bold ${
              stats.percentage === 100 
                ? 'bg-green-500 text-white' 
                : stats.percentage >= 50 
                  ? 'bg-blue-500 text-white'
                  : stats.percentage > 0
                    ? 'bg-orange-400 text-white'
                    : 'bg-gray-400 text-white'
            }`}>
              <span>{stats.percentage === 100 ? '✓' : stats.percentage >= 50 ? '●' : stats.percentage > 0 ? '◐' : '⚪'}</span>
              <span>{stats.done}/{stats.total}</span>
            </div>
          )}
          
          {/* 🔥 תיקון 2: כפתור טוגל עריכה/צפייה */}
          {isManager && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditMode(!isEditMode);
              }}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title={isEditMode ? 'מצב עריכה' : 'מצב צפייה'}
            >
              {isEditMode ? '✏️' : '👁️'}
            </button>
          )}
          
          {/* כפתור שינוי צבע - רק למנהל */}
          {isManager && onEditColor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingClient({ name: order.clientName, color: bgColor });
              }}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title="שנה צבע"
            >
              🎨
            </button>
          )}
          
          {tracking && orderHistory.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHistory(!showHistory);
              }}
              className="text-sm px-2 py-1 rounded hover:bg-white/20 transition-colors"
              style={{ color: textColor }}
              title="היסטוריית שינויים"
            >
              📜 {orderHistory.length}
            </button>
          )}
          
          {canDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
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

      {/* Body */}
      {(!isCollapsible || isExpanded) && (
        <>
          {/* History Section */}
          {tracking && showHistory && orderHistory.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-3 border-b-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span>📜</span>
                  <span>היסטוריית שינויים</span>
                  <span className="text-xs text-gray-600">({orderHistory.length})</span>
                </h4>
                {orderHistory.length > 3 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    {showAllHistory ? 'הצג פחות' : `הצג הכל (${orderHistory.length})`}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {(showAllHistory ? orderHistory : orderHistory.slice(0, 3)).map((log) => {
                  const time = new Date(log.timestamp).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  return (
                    <div key={log.id} className="bg-white rounded-lg p-2 border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">{log.userName}</span>
                        <span className="text-xs text-gray-500">{time}</span>
                      </div>
                      {log.changes && log.changes.length > 0 ? (
                        <div className="space-y-1">
                          {log.changes.map((change, idx) => (
                            <div key={idx} className="text-xs text-gray-600">
                              <span className="font-medium">{change.itemTitle}:</span>{' '}
                              <span className="text-gray-500">
                                {change.type === 'status' && (
                                  <>
                                    <span className="text-orange-500">{translateStatus(change.oldValue)}</span>
                                    {' → '}
                                    <span className="text-green-600 font-semibold">{translateStatus(change.newValue)}</span>
                                  </>
                                )}
                                {change.type === 'completed' && (
                                  <>
                                    <span className="text-gray-500">הושלמו:</span>{' '}
                                    <span className="text-red-500">{change.oldValue}</span>
                                    {' → '}
                                    <span className="text-green-600 font-semibold">{change.newValue}</span>
                                  </>
                                )}
                                {change.type === 'missingNote' && (
                                  <>
                                    <span className="text-gray-500">הערה:</span>{' '}
                                    <span className="text-amber-600 font-semibold">"{change.newValue}"</span>
                                  </>
                                )}
                                {change.type === 'note' && (
                                  <>
                                    <span className="text-gray-500">הערה:</span>{' '}
                                    <span className="text-blue-600">"{change.newValue}"</span>
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 italic">
                          {log.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Order Notes */}
          <div className={bodyPadding}>
            <div className="mb-3 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-700">הערות להזמנה</span>
                {/* 🔥 תיקון 3: כפתור 💬 באותה שורה, רק במצב עריכה */}
                {isManager && !editingOrderNotes && isEditMode && (
                  <button
                    onClick={() => setEditingOrderNotes(true)}
                    className="text-base hover:scale-110 transition-transform"
                    title="הוסף הערה"
                  >
                    💬
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
              
              {canAddItems && (
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
                        // 🔥 תיקון 4: בדיקת תקינות
                        if (!it || !it.title) return null;
                        
                        const originalIndex = order.items.indexOf(it);
                        if (originalIndex === -1) return null;
                        
                        const state = getItemState(order.__id, originalIndex);
                        const totalQty = Number(it.qty) || 1;
                        
                        let statusColor = '#9CA3AF';
                        let statusIcon = '◯';
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
                              
                              <div className="flex-1 flex items-center justify-between gap-2">
                                <div className="flex-1 flex items-center gap-1">
                                  {editingItemTitle === originalIndex ? (
                                    <div className="flex-1 relative">
                                      <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onBlur={() => {
                                          if (!showAutocomplete) {
                                            setEditingItemTitle(null);
                                            setSearchTerm("");
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && searchTerm.trim()) {
                                            handleSaveItemTitle(originalIndex, searchTerm);
                                          } else if (e.key === 'Escape') {
                                            setEditingItemTitle(null);
                                            setSearchTerm("");
                                            setShowAutocomplete(false);
                                          }
                                        }}
                                        onFocus={() => setShowAutocomplete(searchTerm.length >= 2)}
                                        className={`flex-1 ${mode === "day" ? "text-sm" : "text-xs"} p-1 border border-blue-400 rounded`}
                                        autoFocus
                                      />
                                      {showAutocomplete && filteredMenuOptions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-32 overflow-y-auto">
                                          {filteredMenuOptions.map((opt) => (
                                            <div
                                              key={opt}
                                              className="px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSaveItemTitle(originalIndex, opt);
                                              }}
                                            >
                                              {opt}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex-1 flex items-center gap-1">
                                      <span 
                                        className={`${mode === "day" ? "text-sm" : "text-xs"} ${canEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                        onDoubleClick={() => {
                                          if (canEdit) {
                                            setEditingItemTitle(originalIndex);
                                            setSearchTerm(it.title);
                                          }
                                        }}
                                      >
                                        {it.title}
                                      </span>
                                      
                                      {/* 🔥 אימוגי הערה באותה שורה עם השם */}
                                      {it.notes && (
                                        <span 
                                          className="text-blue-600 cursor-help" 
                                          title={it.notes}
                                        >
                                          💬
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {editingItemQty === originalIndex ? (
                                    <input
                                      type="number"
                                      defaultValue={totalQty}
                                      onBlur={(e) => handleSaveItemQty(originalIndex, parseInt(e.target.value) || 1)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveItemQty(originalIndex, parseInt(e.currentTarget.value) || 1);
                                        } else if (e.key === 'Escape') {
                                          setEditingItemQty(null);
                                        }
                                      }}
                                      className={`w-12 ${mode === "day" ? "text-sm" : "text-xs"} p-1 border border-blue-400 rounded text-center`}
                                      autoFocus
                                    />
                                  ) : (
                                    <span 
                                      className={`${mode === "day" ? "text-sm" : "text-xs"} font-bold ${canEdit ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                      onDoubleClick={() => {
                                        if (canEdit) {
                                          setEditingItemQty(originalIndex);
                                        }
                                      }}
                                    >
                                      × {totalQty}
                                    </span>
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
                            </div>
                            
                            {/* Status Controls */}
                            {state.status !== 'pending' && (
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
                            
                            {/* 🔥 הערות מלאות מתחת - עובדים יכולים לראות, רק מנהל במצב עריכה יכול לערוך */}
                            {it.notes && (
                              <div className="mt-2">
                                {isManager && isEditMode && editingItemNote === originalIndex ? (
                                  // מצב עריכה - רק למנהל במצב עריכה
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      defaultValue={it.notes}
                                      onBlur={(e) => handleSaveItemNote(originalIndex, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveItemNote(originalIndex, e.currentTarget.value);
                                        } else if (e.key === 'Escape') {
                                          setEditingItemNote(null);
                                        }
                                      }}
                                      placeholder="הערה לפריט..."
                                      className="flex-1 text-xs p-1 border border-blue-400 rounded"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => setEditingItemNote(null)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  // מצב צפייה - כולם יכולים לראות
                                  <div 
                                    className={`flex items-center gap-2 bg-blue-50 border border-blue-200 rounded p-1 ${
                                      isManager && isEditMode ? 'cursor-pointer hover:bg-blue-100' : ''
                                    }`}
                                    onClick={() => {
                                      if (isManager && isEditMode) {
                                        setEditingItemNote(originalIndex);
                                      }
                                    }}
                                  >
                                    <span className="text-blue-600 text-sm">💬</span>
                                    <span className="text-xs text-gray-700 flex-1">{it.notes}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* 🔥 כפתור הוסף הערה - רק למנהל במצב עריכה */}
                            {isManager && isEditMode && !it.notes && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setEditingItemNote(originalIndex)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <span className="text-sm">💬</span>
                                  <span>הוסף הערה</span>
                                </button>
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
        </>
      )}

      {/* Color Picker Modal */}
      {editingClient && onEditColor && (
        <ClientColorPicker
          show={!!editingClient}
          clientName={editingClient.name}
          currentColor={editingClient.color}
          onClose={() => setEditingClient(null)}
          onSave={async (newColor) => {
            await onEditColor(editingClient.name, newColor);
            setCurrentBgColor(newColor);
            setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}