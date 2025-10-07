"use client";
import React from "react";
import DayOrdersList from "@/components/orders/DayOrdersList";

interface DayModalProps {
  dayKey: string;
  onClose: () => void;
  daysMap: Map<string, any[]>;
  deleteOrder: (id: string) => void;
  editOrderItem: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder: (orderId: string, idx: number) => void;
  onAddItem: (orderId: string) => void;
  noteOpen: Record<string, boolean>;
  toggleNote: (orderId: string, idx: number) => void;
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
}: DayModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-7xl h-[90vh] rounded-2xl overflow-hidden border-4 border-gray-200 shadow-2xl flex flex-col"
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
            onClick={onClose} 
            className="text-gray-600 hover:text-gray-900 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/50 transition-colors"
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
          />
        </div>
      </div>
    </div>
  );
}