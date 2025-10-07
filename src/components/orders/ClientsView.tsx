"use client";
import React, { useState, useMemo } from "react";
import { fmtYMD, addDays } from "@/utils/orders";
import { groupItemsByCategory, getCategoryColor, CATEGORY_ORDER } from "@/utils/categoryMapping";

interface ClientsViewProps {
  orders: any[];
  onAddClient?: () => void;
}

type TimeRange = "today" | "week" | "weekend" | "twoweeks" | "month" | "custom";

export default function ClientsView({ orders, onAddClient }: ClientsViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [focusMode, setFocusMode] = useState(false);
  const [customStart, setCustomStart] = useState<string>(fmtYMD(new Date()));
  const [customEnd, setCustomEnd] = useState<string>(fmtYMD(addDays(new Date(), 7)));

  // חישוב טווח התאריכים
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    switch (timeRange) {
      case "today":
        break;
      case "week":
        end = addDays(today, 7);
        break;
      case "weekend":
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
        end = addDays(today, daysUntilSaturday);
        break;
      case "twoweeks":
        end = addDays(today, 14);
        break;
      case "month":
        end = addDays(today, 30);
        break;
      case "custom":
        start = new Date(customStart);
        end = new Date(customEnd);
        break;
    }

    return { startDate: start, endDate: end };
  }, [timeRange, customStart, customEnd]);

  // סינון הזמנות לפי טווח
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order.eventDate) return false;
      const orderDate = new Date(order.eventDate);
      return orderDate >= startDate && orderDate <= endDate;
    }).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [orders, startDate, endDate]);

  // מצב מיקוד - סיכום מנות
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

  // קיבוץ לפי קטגוריה
  const itemsByCategory = useMemo(() => {
    const items = Object.entries(itemsSummary).map(([title, qty]) => ({ title, qty }));
    return groupItemsByCategory(items);
  }, [itemsSummary]);

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

        {/* בחירת טווח זמן */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTimeRange("today")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "today"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              היום
            </button>
            <button
              onClick={() => setTimeRange("week")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "week"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              השבוע הקרוב
            </button>
            <button
              onClick={() => setTimeRange("weekend")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "weekend"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              עד סוף שבוע
            </button>
            <button
              onClick={() => setTimeRange("twoweeks")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "twoweeks"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              השבועיים הקרובים
            </button>
            <button
              onClick={() => setTimeRange("month")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "month"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              החודש
            </button>
            <button
              onClick={() => setTimeRange("custom")}
              className={`px-3 py-2 rounded-lg border transition-all ${
                timeRange === "custom"
                  ? "bg-pink-400 text-white border-pink-400"
                  : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
              }`}
            >
              תקופה מותאמת
            </button>
          </div>

          {/* טווח מותאם אישית */}
          {timeRange === "custom" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">מ:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm"
              />
              <span className="text-sm text-gray-700">עד:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm"
              />
            </div>
          )}

          {/* מצב מיקוד */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                focusMode
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white border-blue-200 hover:bg-blue-50 text-gray-900"
              }`}
            >
              <span className="text-lg">🎯</span>
              <span>מצב מיקוד</span>
            </button>
            <span className="text-sm text-gray-600">
              {filteredOrders.length} הזמנות | {startDate.toLocaleDateString('he-IL')} - {endDate.toLocaleDateString('he-IL')}
            </span>
          </div>
        </div>
      </div>

      {/* תצוגת מיקוד - סיכום מנות */}
      {focusMode ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">סיכום מנות</h3>
          
          {/* שונה ל-2 עמודות */}
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_ORDER.map(category => {
              const categoryItems = itemsByCategory[category];
              if (!categoryItems || categoryItems.length === 0) return null;
              
              const categoryColor = getCategoryColor(category);
              
              return (
                <div key={category} className="rounded-lg overflow-hidden border-2" style={{ borderColor: categoryColor }}>
                  <div 
                    className="px-3 py-2 text-center text-sm font-bold text-gray-700"
                    style={{ backgroundColor: categoryColor }}
                  >
                    {category}
                  </div>
                  
                  <div className="p-3 space-y-2" style={{ backgroundColor: `${categoryColor}15` }}>
                    {categoryItems.map((item: any) => (
                      <div key={item.title} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-900">{item.title}</span>
                        <span className="text-lg font-bold text-gray-700">× {item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* תצוגת לקוחות - responsive grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              אין הזמנות בתקופה זו
            </div>
          ) : (
            filteredOrders.map((order: any) => (
              <ClientCard key={order.__id} order={order} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// קומפוננטת כרטיס לקוח - תצוגה קומפקטית
function ClientCard({ order }: { order: any }) {
  const [completionState, setCompletionState] = useState<Record<number, { completed: number; status: 'pending' | 'partial' | 'almost' | 'done'; missingNote: string }>>({});
  
  const getCompletionState = (itemIdx: number) => {
    return completionState[itemIdx] || { completed: 0, status: 'pending', missingNote: '' };
  };
  
  const cycleCompletionStatus = (itemIdx: number, totalQty: number) => {
    const current = getCompletionState(itemIdx);
    
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
    
    setCompletionState(prev => ({ ...prev, [itemIdx]: newState }));
  };
  
  const updateCompletedQty = (itemIdx: number, completed: number, totalQty: number) => {
    const status = completed === 0 ? 'pending' : completed === totalQty ? 'done' : 'partial';
    setCompletionState(prev => ({ ...prev, [itemIdx]: { ...prev[itemIdx], completed, status } }));
  };
  
  const updateMissingNote = (itemIdx: number, note: string) => {
    setCompletionState(prev => ({ ...prev, [itemIdx]: { ...prev[itemIdx], missingNote: note } }));
  };

  const groupedItems = groupItemsByCategory(order.items);
  
  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-red-100 px-3 py-2 flex-shrink-0">
        <h4 className="text-base font-bold text-gray-900 truncate" title={order.clientName}>
          {order.clientName}
        </h4>
        <p className="text-xs text-gray-700 mt-0.5">
          {new Date(order.eventDate).toLocaleDateString('he-IL', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </p>
        {order.status && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-700 font-medium">
            {order.status}
          </span>
        )}
      </div>
      
      {/* Body - תצוגה קומפקטית */}
      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-1.5">
          {CATEGORY_ORDER.map(category => {
            const categoryItems = groupedItems[category];
            if (!categoryItems || categoryItems.length === 0) return null;
            
            const categoryColor = getCategoryColor(category);
            
            return (
              <div key={category} className="flex gap-1.5">
                {/* תג קטגוריה מצד ימין */}
                <div 
                  className="flex-shrink-0 w-14 rounded-md flex items-center justify-center text-xs font-bold text-gray-700 px-1 py-0.5"
                  style={{ 
                    backgroundColor: categoryColor,
                    writingMode: categoryItems.length > 4 ? 'vertical-rl' : 'horizontal-tb',
                    textOrientation: categoryItems.length > 4 ? 'mixed' : 'initial'
                  }}
                >
                  {category}
                </div>
                
                {/* רשימת מנות */}
                <div className="flex-1 space-y-0.5">
                  {categoryItems.map((item: any) => {
                    const originalIndex = order.items.indexOf(item);
                    const state = getCompletionState(originalIndex);
                    const totalQty = Number(item.qty) || 1;
                    
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
                        className="rounded-md p-1.5 border"
                        style={{ 
                          backgroundColor: `${categoryColor}15`,
                          borderColor: categoryColor
                        }}
                      >
                        {/* שורה ראשונה */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => cycleCompletionStatus(originalIndex, totalQty)}
                            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                            style={{ backgroundColor: statusColor }}
                          >
                            {statusIcon}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-900 truncate block">{item.title}</span>
                          </div>
                          
                          <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                            ×{item.qty}
                          </span>
                        </div>
                        
                        {/* התקדמות אם חלקי */}
                        {(state.status === 'partial' || state.status === 'almost') && (
                          <>
                            <div className="flex items-center gap-1 mt-1 mr-6">
                              <input
                                type="number"
                                min="0"
                                max={totalQty}
                                className="w-8 text-center bg-white border border-gray-300 rounded px-0.5 py-0.5 text-xs"
                                value={state.completed}
                                onChange={(e) => updateCompletedQty(originalIndex, Number(e.target.value) || 0, totalQty)}
                              />
                              <span className="text-xs text-gray-600">/ {totalQty}</span>
                            </div>
                            
                            <textarea
                              className="w-full text-xs bg-blue-50 border border-blue-300 rounded px-1 py-0.5 mt-1 mr-6 resize-none"
                              placeholder={state.status === 'almost' ? "מה חסר?" : "הערה"}
                              rows={1}
                              value={state.missingNote}
                              onChange={(e) => updateMissingNote(originalIndex, e.target.value)}
                            />
                          </>
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
}