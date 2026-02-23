"use client";
import React, { useEffect, useState } from "react";
import OrderCard from "@/components/orders/OrderCard";
import { useOrderTracking } from "@/components/orders/tracking/OrderTrackingContext";

interface DayModalProps {
  dayKey: string;
  onClose: () => void;
  daysMap: Map<string, any[]>;
  deleteOrder?: (id: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void;
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  isManager?: boolean;
  showDeliveryDetails?: boolean;
  onEditEventDate?: (orderId: string, newDate: string) => void;  // 🔥 הוסף
  onEditDelivery?: (orderId: string, delivery: {
    deliveryMethod?: 'delivery' | 'pickup';
    estimatedTime?: string;
    phone1?: string;
    phone2?: string;
    address?: string;
  }) => void;
  updateClientColor?: (clientName: string, newColor: string) => Promise<void>;
  getClientColor?: (clientName: string) => string;
  recipeLinks?: Record<string, string>;
  menuOptions?: string[];
}

export default function DayModal({
  dayKey,
  onClose,
  daysMap,
  deleteOrder,
  editOrderItem,
  removeItemFromOrder,
  onAddItem,
  onEditEventDate,
  onEditDelivery,
  onEditOrderNotes,
  noteOpen: externalNoteOpen,
  toggleNote: externalToggleNote,
  isManager,
  showDeliveryDetails,
  updateClientColor,
  getClientColor,
  recipeLinks,
  menuOptions = []
}: DayModalProps) {
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }

  const orders = daysMap.get(dayKey) || [];
  
  // State
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [localNoteOpen, setLocalNoteOpen] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // בדיקה אם יש שינויים לא שמורים (אם יש tracking)
  useEffect(() => {
    if (tracking) {
      const hasChanges = tracking.hasUnsavedChanges;
      setHasUnsavedChanges(hasChanges);
    }
  }, [tracking]);

  // 🔥 פתיחה בברירת מחדל: פתוח רק אם יש לקוח אחד, אחרת סגור
  useEffect(() => {
    if (orders.length === 1) {
      setExpandedOrders(new Set(orders.map(o => o.__id)));
    } else {
      setExpandedOrders(new Set());
    }
  }, [orders.length]);

  // Toggle accordion
  const toggleOrder = (orderId: string, isExpanded: boolean) => {
    const newExpanded = new Set(expandedOrders);
    if (isExpanded) {
      newExpanded.add(orderId);
    } else {
      newExpanded.delete(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // פתיחה/סגירה של הכל
  const toggleAll = (expand: boolean) => {
    if (expand) {
      setExpandedOrders(new Set(orders.map(o => o.__id)));
    } else {
      setExpandedOrders(new Set());
    }
  };

  // Toggle notes
  const handleToggleNote = (orderId: string, itemIdx: number) => {
    if (externalToggleNote) {
      externalToggleNote(orderId, itemIdx);
    } else {
      const key = `${orderId}:${itemIdx}`;
      setLocalNoteOpen(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // Note state
  const getNoteOpen = (orderId: string, itemIdx: number) => {
    const key = `${orderId}:${itemIdx}`;
    return externalNoteOpen?.[key] || localNoteOpen[key] || false;
  };

  // שמירת שינויים
  const handleSave = async () => {
    if (!tracking) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // שמירת השינויים עבור כל הזמנה
      for (const order of orders) {
        await tracking.saveOrderChanges(order.__id, order.clientName, order.items);
      }
      
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      
      // הסתרת הודעת הצלחה אחרי 3 שניות
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (error: any) {
      console.error('Failed to save:', error);
      setSaveError(error?.message || 'שגיאה בשמירה. בדוק את החיבור לאינטרנט ונסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  // סגירה עם בדיקת שינויים
  const handleClose = () => {
    if (hasUnsavedChanges && tracking) {
      const confirmed = window.confirm(
        'יש שינויים שלא נשמרו. האם לסגור בכל זאת?\n\n(השינויים יאבדו!)'
      );
      if (!confirmed) return;
      
      // 🔥 אם המשתמש בחר לא לשמור - נקה את השינויים שלא נשמרו
      orders.forEach(order => {
        tracking.clearOrderChanges(order.__id);
      });
    }
    onClose();
  };

  // אזהרה לפני יציאה מהדף
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ESC לסגירה
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [hasUnsavedChanges]);

  // חישוב סטטיסטיקות כוללות
  const totalItems = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0);
  const completedItems = tracking ? orders.reduce((sum, o) => {
    let done = 0;
    o.items?.forEach((_: any, idx: number) => {
      const state = tracking.getItemState(o.__id, idx);
      if (state.status === 'done') {
        done++;
      }
    });
    return sum + done;
  }, 0) : 0;

  return (
    <>
      {/* שכבת רקע */}
      <div 
        className="fixed inset-0 bg-black/40 z-40" 
        onClick={handleClose}
      />
      
      {/* תוכן המודאל */}
      <div className="fixed inset-0 z-41 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl overflow-hidden border-4 border-gray-200 shadow-2xl flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-l from-blue-500 to-cyan-500 border-b-2 border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="font-bold text-white text-2xl">
                {new Date(dayKey).toLocaleDateString('he-IL', { 
                  weekday: 'long',
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              <div className="text-white/80 text-sm mt-1">
                {orders.length} הזמנות • {completedItems}/{totalItems} פריטים הושלמו
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* אינדיקטור שינויים לא שמורים */}
              {hasUnsavedChanges && (
  <div className="bg-orange-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold flex items-center gap-0.5 sm:gap-1 animate-pulse">
    <span className="text-sm sm:text-base">⚠️</span>
    <span className="hidden xs:inline">שינויים לא שמורים</span>
    <span className="xs:hidden">לא נשמר</span>
  </div>
)}

{saveSuccess && (
  <div className="bg-green-500 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold flex items-center gap-0.5 sm:gap-1">
    <span className="text-sm sm:text-base">✔</span>
    <span>נשמר!</span>
  </div>
)}
              
              <button 
                onClick={handleClose} 
                className="text-white hover:text-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                title="סגור (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* אזור שגיאה */}
         {saveError && (
  <div className="bg-red-50 border-b-2 border-red-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2">
    <div className="flex items-center gap-1.5 sm:gap-2 text-red-700 flex-1 min-w-0">
      <span className="text-base sm:text-xl flex-shrink-0">❌</span>
      <span className="font-medium text-xs sm:text-sm truncate">{saveError}</span>
    </div>
    <button
      onClick={() => setSaveError(null)}
      className="text-red-500 hover:text-red-700 text-lg sm:text-xl flex-shrink-0"
    >
      ✕
    </button>
  </div>
)}
          {/* כפתורים עליונים */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
           <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs sm:text-sm font-medium transition-all"
            >
              <span className="hidden xs:inline">פתח הכל</span>
              <span className="xs:hidden">פתח</span>
              <span className="ml-1">({orders.length})</span>
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs sm:text-sm font-medium transition-all"
            >
              <span className="hidden xs:inline">סגור הכל</span>
              <span className="xs:hidden">סגור</span>
            </button>
          </div>
            {/* כפתור שמירה עליון */}
            {tracking && hasUnsavedChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg bg-gradient-to-l from-green-500 to-emerald-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>שומר...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>שמור שינויים</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {/* Body - רשימת הזמנות */}
          <div className="flex-1 overflow-y-auto p-6">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                אין הזמנות ליום זה
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const isExpanded = expandedOrders.has(order.__id);

                  return (
                    <OrderCard
                      key={order.__id}
                      order={order}
                      mode="day"
                      clientColor={order.clientColor || (getClientColor ? getClientColor(order.clientName) : undefined)}
                      onEditColor={updateClientColor}
                      onDelete={deleteOrder}
                      onEditItem={editOrderItem}
                      onRemoveItem={removeItemFromOrder}
                      onAddItem={onAddItem}
                      onEditOrderNotes={onEditOrderNotes}
                      onEditEventDate={onEditEventDate}
                      onEditDelivery={onEditDelivery}
                      recipeLinks={recipeLinks}
                      noteOpen={externalNoteOpen || localNoteOpen}
                      toggleNote={handleToggleNote}
                      isCollapsible={true}
                      externalExpanded={isExpanded}
                      onToggle={(orderId, expanded) => toggleOrder(orderId, expanded)}
                      isManager={isManager}
                      showDeliveryDetails={showDeliveryDetails}
                      menuOptions={menuOptions}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - כפתור שמירה צף */}
         {tracking && hasUnsavedChanges && (
  <button
    onClick={handleSave}
    disabled={isSaving}
    className="px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg bg-gradient-to-l from-green-500 to-emerald-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2"
  >
    {isSaving ? (
      <>
        <span className="animate-spin text-sm sm:text-base">⟳</span>
        <span>שומר...</span>
      </>
    ) : (
      <>
        <span className="text-sm sm:text-base">💾</span>
        <span className="hidden xs:inline">שמור שינויים</span>
        <span className="xs:hidden">שמור</span>
      </>
    )}
  </button>
)}

        </div>
      </div>
    </>
  );
}