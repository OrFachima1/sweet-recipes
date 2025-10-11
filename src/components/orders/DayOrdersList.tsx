"use client";
import React from "react";
import OrderCard from "./OrderCard";

interface DayOrdersListProps {
  dayKey: string;
  daysMap: Map<string, any[]>;
  deleteOrder?: (orderId: string) => void;
  editOrderItem?: (orderId: string, idx: number, patch: any) => void;
  removeItemFromOrder?: (orderId: string, idx: number) => void;
  onAddItem?: (orderId: string) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void; // 🔥 חדש!
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  onEditColor?: (clientName: string, currentColor: string) => void;
  getClientColor?: (clientName: string) => string;
  recipeLinks?: Record<string, string>;
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
  getClientColor,
  recipeLinks,
}: DayOrdersListProps) {
  const orders = daysMap.get(dayKey) || [];

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {orders.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          אין הזמנות ליום זה
        </div>
      )}
      
      {orders.map((order: any) => (
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
          recipeLinks={recipeLinks}
          noteOpen={noteOpen}
          toggleNote={toggleNote}
        />
      ))}
    </div>
  );
}