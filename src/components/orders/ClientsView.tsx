"use client";
import React, { useState, useMemo } from "react";
import { fmtYMD, addDays } from "@/utils/orders";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder } from "@/utils/categoryMapping";
import { useClients } from "@/hooks/useClients";
import { useUser } from "@/lib/auth";
import OrderCard from "./OrderCard";

interface ClientsViewProps {
  orders: any[];
  onAddClient?: () => void;
  recipeLinks?: Record<string, string>;
  onEditItem?: (orderId: string, idx: number, patch: any) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void;
}

type TimeRange = "today" | "week" | "weekend" | "twoweeks" | "month" | "custom";

export default function ClientsView({ 
  orders, 
  onAddClient,
  recipeLinks,
  onEditItem,
  onEditOrderNotes
}: ClientsViewProps) {
  const { user } = useUser();
  const { updateClientColor, getClientColor } = useClients(user?.uid);
  
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [focusMode, setFocusMode] = useState(false);
  const [customStart, setCustomStart] = useState<string>(fmtYMD(new Date()));
  const [customEnd, setCustomEnd] = useState<string>(fmtYMD(addDays(new Date(), 7)));
  const [refreshKey, setRefreshKey] = useState(0);

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);
    end.setHours(23, 59, 59, 999);

    switch (timeRange) {
      case "today":
        break;
      case "week":
        end = addDays(today, 7);
        end.setHours(23, 59, 59, 999);
        break;
      case "weekend":
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
        end = addDays(today, daysUntilSaturday);
        end.setHours(23, 59, 59, 999);
        break;
      case "twoweeks":
        end = addDays(today, 14);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        end = addDays(today, 30);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate: start, endDate: end };
  }, [timeRange, customStart, customEnd]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order.eventDate) return false;
      const orderDate = new Date(order.eventDate);
      return orderDate >= startDate && orderDate <= endDate;
    }).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [orders, startDate, endDate]);

  const itemsSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    
    filteredOrders.forEach(order => {
      order.items.forEach((item: any) => {
        const title = item.title;
        summary[title] = (summary[title] || 0) + Number(item.qty || 1);
      });
    });
    
    return summary;
  }, [filteredOrders]);

  const itemsByCategory = useMemo(() => {
    const items = Object.entries(itemsSummary).map(([title, qty]) => ({ title, qty }));
    const grouped: Record<string, any[]> = {};
    
    items.forEach(item => {
      const result = groupItemsByCategory([item]);
      Object.entries(result).forEach(([cat, catItems]) => {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(...catItems);
      });
    });
    
    return grouped;
  }, [itemsSummary]);

  const handleEditColor = async (clientName: string, newColor: string) => {
    try {
      await updateClientColor(clientName, newColor);
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      alert("שגיאה בשמירת הצבע: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">תצוגת לקוחות</h2>
          
          {onAddClient && (
            <button
              onClick={onAddClient}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
            >
              <span className="text-xl leading-none">＋</span>
              <span>הוסף לקוח</span>
            </button>
          )}
        </div>

        {/* Time Range Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTimeRange("today")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "today"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              📅 היום
            </button>
            <button
              onClick={() => setTimeRange("week")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "week"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              📆 שבוע קדימה
            </button>
            <button
              onClick={() => setTimeRange("weekend")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "weekend"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              🎉 עד סופ"ש
            </button>
            <button
              onClick={() => setTimeRange("twoweeks")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "twoweeks"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              📅 שבועיים
            </button>
            <button
              onClick={() => setTimeRange("month")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "month"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              📊 חודש
            </button>
            <button
              onClick={() => setTimeRange("custom")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "custom"
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              🎯 תקופה מותאמת
            </button>
          </div>

          {timeRange === "custom" && (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-600">עד</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`px-3 py-2 rounded-lg border transition-all ${
                focusMode
                  ? "bg-purple-500 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
              }`}
            >
              {focusMode ? "📊 הצג לקוחות" : "🎯 סיכום מנות"}
            </button>
            
            <div className="text-sm text-gray-600">
              {filteredOrders.length} הזמנות | {startDate.toLocaleDateString('he-IL')} - {endDate.toLocaleDateString('he-IL')}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {focusMode ? (
        // Focus Mode: Items summary
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <h3 className="text-xl font-bold mb-4 text-gray-900">סיכום מנות</h3>
          
          {Object.entries(itemsByCategory)
            .sort((a, b) => {
              const orderArray = getCategoryOrder();
              const indexA = orderArray.indexOf(a[0]);
              const indexB = orderArray.indexOf(b[0]);
              const orderA = indexA === -1 ? 999 : indexA;
              const orderB = indexB === -1 ? 999 : indexB;
              return orderA - orderB;
            })
            .map(([category, items]: [string, any[]]) => (
            <div key={category} className="mb-6 last:mb-0">
              <div 
                className="text-sm font-bold mb-2 px-3 py-1 rounded inline-block"
                style={{ 
                  backgroundColor: getCategoryColor(category),
                  color: 'white'
                }}
              >
                {category}
              </div>
              
              <div className="space-y-1">
                {items
                  .sort((a: any, b: any) => b.qty - a.qty)
                  .map((item: any) => (
                    <div key={item.title} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-gray-600 font-bold">{item.qty}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Normal Mode: Client cards
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              אין הזמנות בטווח הזמן שנבחר
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={`${order.__id}-${refreshKey}`}
                order={order}
                mode="client"
                clientColor={getClientColor(order.clientName)}
                onEditColor={handleEditColor}
                onEditItem={onEditItem}
                onEditOrderNotes={onEditOrderNotes}
                recipeLinks={recipeLinks}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}