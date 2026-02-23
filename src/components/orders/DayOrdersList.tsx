"use client";
import React, { useState, useEffect } from "react";
import OrderCard from "./OrderCard";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import { useUser } from "@/lib/auth";

interface DayOrdersListProps {
  dayKey: string;
  daysMap: Map<string, any[]>;
  deleteOrder?: (orderId: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  onEditEventDate?: (orderId: string, newDate: string) => void;  // 🔥 הוסף
  onEditDelivery?: (orderId: string, delivery: {
    deliveryMethod?: 'delivery' | 'pickup';
    estimatedTime?: string;
    phone1?: string;
    phone2?: string;
    address?: string;
  }) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void;
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  onEditColor?: (clientName: string, currentColor: string) => void;
  getClientColor?: (clientName: string) => string;
  recipeLinks?: Record<string, string>;
  isManager?: boolean;
  showDeliveryDetails?: boolean;
  menuOptions?: string[];
}

export default function DayOrdersList({
  dayKey,
  daysMap,
  deleteOrder,
  editOrderItem,
  removeItemFromOrder,
  onAddItem,
  onEditOrderNotes,
  noteOpen,
  toggleNote,
  onEditColor,
  onEditEventDate,
  onEditDelivery,
  getClientColor,
  recipeLinks,
  isManager = false,
  showDeliveryDetails = false,
  menuOptions = []
}: DayOrdersListProps) {
  const { user } = useUser();
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }

  const orders = daysMap.get(dayKey) || [];
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 🔥 פתוח רק אם יש לקוח אחד, אחרת סגור
  useEffect(() => {
    if (orders.length === 1) {
      setExpandedOrders(new Set(orders.map(o => o.__id)));
    } else {
      setExpandedOrders(new Set());
    }
  }, [orders.length]);

  // 🔥 בדיקה אם יש שינויים לא שמורים
  useEffect(() => {
    if (tracking) {
      setHasUnsavedChanges(tracking.hasUnsavedChanges);
    }
  }, [tracking]);

  // 🔥 אזהרה לפני יציאה מהדף
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

  const toggleOrder = (orderId: string, isExpanded: boolean) => {
    const newExpanded = new Set(expandedOrders);
    if (isExpanded) {
      newExpanded.add(orderId);
    } else {
      newExpanded.delete(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // 🔥 שמירת שינויים
  const handleSave = async () => {
    if (!tracking) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      for (const order of orders) {
        await tracking.saveOrderChanges(order.__id, order.clientName, order.items);
      }
      
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (error: any) {
      console.error('Failed to save:', error);
      setSaveError(error?.message || 'שגיאה בשמירה. בדוק את החיבור לאינטרנט ונסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  // 🔥 ביטול שינויים
  const handleDiscard = () => {
    if (!tracking) return;
    
    if (confirm('לבטל את כל השינויים שלא נשמרו?')) {
      orders.forEach(order => {
        tracking.clearOrderChanges(order.__id);
      });
      setHasUnsavedChanges(false);
      setSaveError(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 🔥 פאנל שמירה - מופיע כשיש שינויים */}
      {tracking && hasUnsavedChanges && (
  <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300 rounded-lg sm:rounded-xl p-2 sm:p-4 shadow-lg">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xl sm:text-2xl">⚠️</span>
        <div>
          <div className="font-bold text-sm sm:text-base text-orange-900">יש שינויים שלא נשמרו</div>
          <div className="text-xs sm:text-sm text-orange-700 hidden sm:block">לחץ על "שמור שינויים" כדי לשמור את העדכונים</div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleDiscard}
          className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all"
          disabled={isSaving}
        >
          ביטול
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 sm:px-6 py-1.5 sm:py-2 text-sm rounded-lg bg-gradient-to-l from-green-500 to-emerald-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2"
        >
          {isSaving ? (
            <>
              <span className="animate-spin text-base sm:text-lg">⟳</span>
              <span>שומר...</span>
            </>
          ) : (
            <>
              <span className="text-base sm:text-lg">💾</span>
              <span className="hidden xs:inline">שמור שינויים</span>
              <span className="xs:hidden">שמור</span>
            </>
          )}
        </button>
      </div>
    </div>
    
    {saveError && (
      <div className="mt-2 text-xs sm:text-sm text-red-600 bg-red-50 rounded p-2">
        ❌ {saveError}
      </div>
    )}
    
    {saveSuccess && (
      <div className="mt-2 text-xs sm:text-sm text-green-600 bg-green-50 rounded p-2">
        ✓ השינויים נשמרו בהצלחה!
      </div>
    )}
  </div>
)}


      {/* רשימת הזמנות */}
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {orders.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            אין הזמנות ליום זה
          </div>
        )}
        
        {orders.map((order: any) => {
          const isExpanded = expandedOrders.has(order.__id);
          
          return (
            <OrderCard
              key={order.__id}
              order={order}
              mode="day"
              clientColor={order.clientColor || (getClientColor ? getClientColor(order.clientName) : undefined)}
              onEditColor={onEditColor}
              onDelete={deleteOrder}
              onEditItem={editOrderItem}
              onRemoveItem={removeItemFromOrder}
              onAddItem={onAddItem}
              onEditOrderNotes={onEditOrderNotes}
              onEditEventDate={onEditEventDate}
              onEditDelivery={onEditDelivery}
              recipeLinks={recipeLinks}
              noteOpen={noteOpen}
              toggleNote={toggleNote}
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

      {/* 🔥 כפתור שמירה צף בתחתית */}
      {tracking && hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          >
            {isSaving ? (
              <>
                <span className="animate-spin text-2xl">⟳</span>
                <span>שומר...</span>
              </>
            ) : (
              <>
                <span className="text-2xl">💾</span>
                <span>שמור שינויים</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}