"use client";
import React, { useEffect } from "react";
import DayOrdersList from "@/components/orders/DayOrdersList";
import { useOrderTracking } from "@/components/orders/tracking/OrderTrackingContext";

interface DayModalProps {
  dayKey: string;
  onClose: () => void;
  daysMap: Map<string, any[]>;
  deleteOrder?: (id: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  isManager?: boolean;
  updateClientColor?: (clientName: string, newColor: string) => Promise<void>;
  getClientColor?: (clientName: string) => string;
}

export default function DayModal({
  dayKey,
  onClose,
  daysMap,
  deleteOrder,
  editOrderItem,
  removeItemFromOrder,
  onAddItem,
  noteOpen,
  toggleNote,
  isManager,
  updateClientColor,
  getClientColor,
}: DayModalProps) {
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }

  // שמירה אוטומטית לכל ההזמנות כשסוגרים
  const handleClose = () => {
    if (tracking) {
      const orders = daysMap.get(dayKey) || [];
      orders.forEach(order => {
        tracking.saveOrderChanges(order.__id, order.clientName, order.items);
      });
    }
    onClose();
  };

  // שמירה גם כש-ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [dayKey, daysMap, tracking]);

  return (
    <>
      {/* שכבת רקע נפרדת */}
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
          <div className="px-6 py-4 bg-red-100 border-b-2 border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="font-bold text-gray-900 text-xl">
              {new Date(dayKey).toLocaleDateString('he-IL', { 
                weekday: 'long',
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
              })}
            </div>
            <button 
              onClick={handleClose} 
              className="text-gray-600 hover:text-gray-900 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/50 transition-colors"
              title="סגור ושמור (ESC)"
            >
              ✕
            </button>
          </div>
          
          {/* Body */}
          <div className="flex-1 overflow-hidden">
            <DayOrdersList
              dayKey={dayKey}
              daysMap={daysMap}
              deleteOrder={deleteOrder}
              editOrderItem={editOrderItem}
              removeItemFromOrder={removeItemFromOrder}
              onAddItem={onAddItem}
              noteOpen={noteOpen}
              toggleNote={toggleNote}
              onEditColor={isManager ? updateClientColor : undefined}
              getClientColor={getClientColor}
            />
          </div>

          {/* Footer - אינדיקטור */}
          {tracking && (
            <div className="px-6 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 text-center">
              💡 השינויים יישמרו אוטומטית כשתסגור את החלון
            </div>
          )}
        </div>
      </div>
    </>
  );
}