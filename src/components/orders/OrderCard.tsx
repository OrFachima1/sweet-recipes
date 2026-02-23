"use client";
import React, { useState } from "react";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder } from "@/utils/categoryMapping";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import ClientColorPicker from "./ClientColorPicker";
import { getTextColor } from "@/utils/colorHelpers";
import type { DeliveryMethod } from "@/types/orders";

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
  onEditEventDate?: (orderId: string, newDate: string) => void;
  onEditDelivery?: (orderId: string, delivery: {
    deliveryMethod?: DeliveryMethod;
    estimatedTime?: string;
    phone1?: string;
    phone1Name?: string;
    phone2?: string;
    phone2Name?: string;
    address?: string;
  }) => void;

  recipeLinks?: Record<string, string>;
  
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  
  // accordion
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (orderId: string, isExpanded: boolean) => void;
  externalExpanded?: boolean;
  
  // גישה ותפריט
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
  onEditEventDate,
  onEditDelivery,
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
  const [showMenu, setShowMenu] = useState(false);
  const [currentBgColor, setCurrentBgColor] = useState(clientColor || '#73a1ecff');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventDate, setEditingEventDate] = useState(false);
  const [eventDateValue, setEventDateValue] = useState(order.eventDate || "");
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(order.deliveryMethod || "pickup");
  const [estimatedTime, setEstimatedTime] = useState(order.estimatedTime || "");
  const [phone1, setPhone1] = useState(order.phone1 || "");
  const [phone1Name, setPhone1Name] = useState(order.phone1Name || "");
  const [phone2, setPhone2] = useState(order.phone2 || "");
  const [phone2Name, setPhone2Name] = useState(order.phone2Name || "");
  const [address, setAddress] = useState(order.address || "");

  // מצב expanded - חיצוני או מקומי
  const isExpanded = externalExpanded !== undefined ? externalExpanded : localExpanded;

  // Toggle accordion
  const handleToggle = () => {
    if (!isCollapsible) return;
    
    const newExpanded = !isExpanded;
    setLocalExpanded(newExpanded);
    onToggle?.(order.__id, newExpanded);
  };

  // Permissions - עריכה רק במצב עריכה
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* סטטיסטיקות - נשאר */}
          {tracking && (
            <div className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-bold ${
              stats.percentage === 100 
                ? 'bg-green-500 text-white' 
                : stats.percentage >= 50 
                  ? 'bg-blue-500 text-white'
                  : stats.percentage > 0
                    ? 'bg-orange-400 text-white'
                    : 'bg-gray-400 text-white'
            }`}>
              <span className="hidden xs:inline">{stats.percentage === 100 ? '✓' : stats.percentage >= 50 ? '◐' : stats.percentage > 0 ? '◔' : '○'}</span>
              <span>{stats.done}/{stats.total}</span>
            </div>
          )}
          
          {/* תפריט 3 נקודות - רק למנהלים */}
          {isManager && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // פתיחת הכרטיס אם הוא סגור
                  if (isCollapsible && !isExpanded) {
                    const newExpanded = true;
                    setLocalExpanded(newExpanded);
                    onToggle?.(order.__id, newExpanded);
                  }
                  setShowMenu(!showMenu);
                }}
                className="text-base sm:text-lg px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hover:bg-white/20 transition-colors"
                style={{ color: textColor }}
                title="אפשרויות"
              >
                ⋮
              </button>
              
              {/* תפריט dropdown */}
              {showMenu && (
                <>
                  {/* רקע שקוף לסגירה */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  
                  {/* התפריט עצמו */}
                  <div 
                    className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 z-20 min-w-[160px] sm:min-w-[180px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* כפתור עין/עיפרון */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditMode(!isEditMode);
                        setShowMenu(false);
                      }}
                      className="w-full text-right px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-700"
                    >
                      <span className="text-base sm:text-lg">{isEditMode ? '👁️' : '✏️'}</span>
                      <span>{isEditMode ? 'מצב צפייה' : 'מצב עריכה'}</span>
                    </button>
                    
                    {/* כפתור שינוי צבע */}
                    {onEditColor && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingClient({ name: order.clientName, color: bgColor });
                          setShowMenu(false);
                        }}
                        className="w-full text-right px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-700"
                      >
                        <span className="text-base sm:text-lg">🎨</span>
                        <span>שנה צבע</span>
                      </button>
                    )}
                    
                    {/* כפתור היסטוריה */}
                    {tracking && orderHistory.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHistory(!showHistory);
                          setShowMenu(false);
                        }}
                        className="w-full text-right px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-700"
                      >
                        <span className="text-base sm:text-lg">📜</span>
                        <span>היסטוריה ({orderHistory.length})</span>
                      </button>
                    )}
                    
                    {/* כפתור שינוי תאריך */}
                    {onEditEventDate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEventDate(true);
                          setShowMenu(false);
                        }}
                        className="w-full text-right px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-700"
                      >
                        <span className="text-base sm:text-lg">📅</span>
                        <span>שנה תאריך</span>
                      </button>
                    )}

                    {/* כפתור עריכת משלוח - רק במצב עריכה */}
                    {onEditDelivery && isEditMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDelivery(true);
                          setDeliveryMethod(order.deliveryMethod || "pickup");
                          setEstimatedTime(order.estimatedTime || "");
                          setPhone1(order.phone1 || "");
                          setPhone1Name(order.phone1Name || "");
                          setPhone2(order.phone2 || "");
                          setPhone2Name(order.phone2Name || "");
                          setAddress(order.address || "");
                          setShowMenu(false);
                        }}
                        className="w-full text-right px-3 sm:px-4 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-700"
                      >
                        <span className="text-base sm:text-lg">🚚</span>
                        <span>ערוך פרטי אספקה</span>
                      </button>
                    )}

                    {/* מחיקה */}
                    {canDelete && (
                      <>
                        <div className="border-t border-gray-200 my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`האם למחוק את ההזמנה של ${order.clientName}?`)) {
                              onDelete(order.__id);
                            }
                            setShowMenu(false);
                          }}
                          className="w-full text-right px-3 sm:px-4 py-2 hover:bg-red-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-red-600 font-medium"
                        >
                          <span className="text-base sm:text-lg">🗑️</span>
                          <span>מחק הזמנה</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
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
            {/* עריכת תאריך אירוע */}
            {editingEventDate && onEditEventDate && (
              <div className="mb-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700">שנה תאריך אירוע</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={eventDateValue}
                    onChange={(e) => setEventDateValue(e.target.value)}
                    className="w-full text-sm p-2 border border-blue-300 rounded"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (eventDateValue) {
                          onEditEventDate(order.__id, eventDateValue);
                          setEditingEventDate(false);
                        }
                      }}
                      className="text-sm px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      💾 שמור
                    </button>
                    <button
                      onClick={() => {
                        setEditingEventDate(false);
                        setEventDateValue(order.eventDate || "");
                      }}
                      className="text-sm px-3 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* עריכת פרטי אספקה */}
            {editingDelivery && onEditDelivery && (
              <div className="mb-3 bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-700">🚚 פרטי אספקה</span>
                </div>
                <div className="space-y-3">
                  {/* שיטת אספקה */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("pickup")}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                        deliveryMethod === "pickup"
                          ? "border-rose-400 bg-rose-50 text-rose-700 font-semibold"
                          : "border-gray-300 hover:border-gray-400 text-gray-600"
                      }`}
                    >
                      <span>🏪</span>
                      <span>איסוף</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod("delivery")}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm ${
                        deliveryMethod === "delivery"
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">שעה משוערת</label>
                    <input
                      type="time"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      className="w-full text-sm p-2 border border-purple-300 rounded"
                    />
                  </div>

                  {/* איש קשר 1 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">שם איש קשר 1</label>
                      <input
                        type="text"
                        value={phone1Name}
                        onChange={(e) => setPhone1Name(e.target.value)}
                        placeholder="שם..."
                        className="w-full text-sm p-2 border border-purple-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">טלפון 1</label>
                      <input
                        type="tel"
                        value={phone1}
                        onChange={(e) => setPhone1(e.target.value)}
                        placeholder="050-0000000"
                        className="w-full text-sm p-2 border border-purple-300 rounded"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* איש קשר 2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">שם איש קשר 2</label>
                      <input
                        type="text"
                        value={phone2Name}
                        onChange={(e) => setPhone2Name(e.target.value)}
                        placeholder="שם..."
                        className="w-full text-sm p-2 border border-purple-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">טלפון 2</label>
                      <input
                        type="tel"
                        value={phone2}
                        onChange={(e) => setPhone2(e.target.value)}
                        placeholder="050-0000000"
                        className="w-full text-sm p-2 border border-purple-300 rounded"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* כתובת */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">כתובת למשלוח</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="רחוב, עיר..."
                      className="w-full text-sm p-2 border border-purple-300 rounded"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onEditDelivery(order.__id, {
                          deliveryMethod,
                          estimatedTime: estimatedTime || undefined,
                          phone1: phone1.trim() || undefined,
                          phone1Name: phone1Name.trim() || undefined,
                          phone2: phone2.trim() || undefined,
                          phone2Name: phone2Name.trim() || undefined,
                          address: address.trim() || undefined,
                        });
                        setEditingDelivery(false);
                      }}
                      className="text-sm px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      💾 שמור
                    </button>
                    <button
                      onClick={() => {
                        setEditingDelivery(false);
                        setDeliveryMethod(order.deliveryMethod || "pickup");
                        setEstimatedTime(order.estimatedTime || "");
                        setPhone1(order.phone1 || "");
                        setPhone1Name(order.phone1Name || "");
                        setPhone2(order.phone2 || "");
                        setPhone2Name(order.phone2Name || "");
                        setAddress(order.address || "");
                      }}
                      className="text-sm px-3 py-1.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* תצוגת פרטי אספקה - במצב צפייה */}
            {!editingDelivery && (order.deliveryMethod || order.estimatedTime || order.phone1 || order.phone2 || order.address) && (
              <div className="mb-3 bg-purple-50 rounded-lg p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">🚚 פרטי אספקה</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      order.deliveryMethod === 'delivery'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {order.deliveryMethod === 'delivery' ? '🚚 משלוח' : '🏪 איסוף'}
                    </span>
                    {order.estimatedTime && (
                      <span className="text-gray-500">⏰ {order.estimatedTime}</span>
                    )}
                  </div>
                  {order.address && (
                    <div className="flex items-start gap-1">
                      <span>📍</span>
                      <span>{order.address}</span>
                    </div>
                  )}
                  {(order.phone1 || order.phone2) && (
                    <div className="flex flex-col gap-1">
                      {order.phone1 && (
                        <div className="flex items-center gap-2">
                          <span>📞</span>
                          {order.phone1Name && <span className="text-gray-700">{order.phone1Name}:</span>}
                          <a href={`tel:${order.phone1}`} className="text-blue-600 hover:underline" dir="ltr">
                            {order.phone1}
                          </a>
                        </div>
                      )}
                      {order.phone2 && (
                        <div className="flex items-center gap-2">
                          <span>📞</span>
                          {order.phone2Name && <span className="text-gray-700">{order.phone2Name}:</span>}
                          <a href={`tel:${order.phone2}`} className="text-blue-600 hover:underline" dir="ltr">
                            {order.phone2}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mb-3 bg-yellow-50 rounded-lg p-2 border border-yellow-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-700">הערות להזמנה</span>
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
                          statusIcon = '◐';
                        }
                        
                        return (
                          <div 
                            key={originalIndex} 
                            className={`rounded-${mode === "day" ? "lg" : "md"} ${mode === "day" ? "p-2" : "p-1.5"} border overflow-hidden`}
                            style={{ 
                              backgroundColor: `${categoryColor}15`,
                              borderColor: categoryColor,
                              maxWidth: '100%'
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
                                      {recipeLinks && recipeLinks[it.title] ? (
                                        <a
                                          href={`/recipes/${recipeLinks[it.title]}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`${mode === "day" ? "text-sm" : "text-xs"} text-blue-600 hover:text-blue-800`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {it.title}
                                        </a>
                                      ) : (
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
                                      )}
                                      
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
                            
                            {it.notes && (
                              <div className="mt-2">
                                {isManager && isEditMode && editingItemNote === originalIndex ? (
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