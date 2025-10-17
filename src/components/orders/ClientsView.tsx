"use client";
import React, { useState, useMemo, useEffect } from "react";
import { fmtYMD, addDays } from "@/utils/orders";
import { groupItemsByCategory, getCategoryColor, getCategoryOrder } from "@/utils/categoryMapping";
import { useClients } from "@/hooks/useClients";
import { useUser } from "@/lib/auth";
import { useOrderTracking } from "./tracking/OrderTrackingContext";
import OrderCard from "./OrderCard";

interface ClientsViewProps {
  orders: any[];
  onAddClient?: () => void;
  recipeLinks?: Record<string, string>;
  onEditItem?: (orderId: string, idx: number, patch: any) => void;
  onEditOrderNotes?: (orderId: string, notes: string) => void;
  onRemoveItem?: (orderId: string, idx: number) => void;
  onDeleteOrder?: (orderId: string) => void;
  onAddItem?: (orderId: string) => void;
  noteOpen?: Record<string, boolean>;
  toggleNote?: (orderId: string, idx: number) => void;
  isManager?: boolean;
  menuOptions?: string[];
}

type TimeRange = "today" | "weekend" | "twoweeks" | "custom";

export default function ClientsView({ 
  orders, 
  onAddClient,
  recipeLinks,
  onEditItem,
  onEditOrderNotes,
  onRemoveItem,
  onDeleteOrder,
  onAddItem,
  noteOpen,
  toggleNote,
  isManager,
  menuOptions = []
}: ClientsViewProps) {
  const { user } = useUser();
  const { updateClientColor, getClientColor } = useClients(user?.uid);
  
  let tracking;
  try {
    tracking = useOrderTracking();
  } catch {
    tracking = null;
  }
  
  const [timeRange, setTimeRange] = useState<TimeRange>("weekend");
  const [focusMode, setFocusMode] = useState(false);
  const [customStart, setCustomStart] = useState<string>(fmtYMD(new Date()));
  const [customEnd, setCustomEnd] = useState<string>(fmtYMD(addDays(new Date(), 7)));
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<{orderId: string; itemIdx: number} | null>(null);
  const [editingQty, setEditingQty] = useState<{orderId: string; itemIdx: number; value: number} | null>(null);
  const [editingCompleted, setEditingCompleted] = useState<{
  orderId: string;
  itemIdx: number;
  value: string;
} | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (tracking) {
      setHasUnsavedChanges(tracking.hasUnsavedChanges);
    }
  }, [tracking]);

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

  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);
    end.setHours(23, 59, 59, 999);

    switch (timeRange) {
      case "today":
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
      return groupItemsByCategory(items);
    }, [itemsSummary]);

    // חישוב סטטוס סיכום למנה
    const getItemSummaryStatus = (itemTitle: string) => {
    if (!tracking) return { completedUnits: 0, totalUnits: 0, isAlmost: false };
    
    let completedUnits = 0;
    let totalUnits = 0;
    let hasAlmost = false;
    
    filteredOrders.forEach(order => {
      order.items.forEach((item: any, itemIdx: number) => {
        if (item.title === itemTitle) {
          const itemQty = Number(item.qty || 0);
          totalUnits += itemQty; // ✅ מוסיף את הכמות!
          
          const state = tracking.getItemState(order.__id, itemIdx);
          
          if (state.status === 'done') {
            completedUnits += itemQty; // ✅ מוסיף את הכמות המלאה
          } else if (state.status === 'almost') {
            completedUnits += itemQty; // ✅ כמעט = מוסיפים את הכל
            hasAlmost = true; // ✅ מסמנים שיש לפחות אחד "כמעט"
          } else if (state.status === 'partial') {
            // ✅ חלקי = מוסיפים את מה שהושלם בפועל
            completedUnits += (state.completed || 0);
          }
          // pending = לא מוסיפים כלום
        }
      });
    });
    
    return { completedUnits, totalUnits, isAlmost: hasAlmost };
  };

  const handleEditColor = async (clientName: string, newColor: string) => {
    try {
      await updateClientColor(clientName, newColor);
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      alert("שגיאה בשמירת הצבע: " + (e as Error).message);
    }
  };

  const toggleOrder = (orderId: string, isExpanded: boolean) => {
    const newExpanded = new Set(expandedOrders);
    if (isExpanded) {
      newExpanded.add(orderId);
    } else {
      newExpanded.delete(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const toggleItem = (itemTitle: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemTitle)) {
      newExpanded.delete(itemTitle);
    } else {
      newExpanded.add(itemTitle);
    }
    setExpandedItems(newExpanded);
  };

  const handleSave = async () => {
    if (!tracking) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      for (const order of filteredOrders) {
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

  const handleDiscard = () => {
    if (!tracking) return;
    
    if (confirm('לבטל את כל השינויים שלא נשמרו?')) {
      filteredOrders.forEach(order => {
        tracking.clearOrderChanges(order.__id);
      });
      setHasUnsavedChanges(false);
      setSaveError(null);
    }
  };

  // פונקציות עזר
  const cycleStatus = (orderId: string, itemIdx: number, qty: number) => {
    if (!tracking) return;
    
    const current = tracking.getItemState(orderId, itemIdx);
    let newState;
    
    if (current.status === 'pending') {
      newState = { completed: qty, status: 'done' as const, missingNote: '' };
    } else if (current.status === 'done') {
      newState = { completed: qty, status: 'almost' as const, missingNote: '' };
    } else if (current.status === 'almost') {
      newState = { completed: 0, status: 'pending' as const, missingNote: '' };
    } else {
      newState = { completed: 0, status: 'pending' as const, missingNote: '' };
    }
    
    tracking.updateItemState(orderId, itemIdx, newState);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return '✓';
      case 'almost': return '≈';
      case 'partial': return '◐';
      default: return '○';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return '#10B981';
      case 'almost': return '#3B82F6';
      case 'partial': return '#F59E0B';
      default: return '#9CA3AF';
    }
  };

  const updateMissingNote = (orderId: string, itemIdx: number, note: string) => {
    if (!tracking) return;
    tracking.updateItemState(orderId, itemIdx, { missingNote: note });
  };

  const updateCompleted = (orderId: string, itemIdx: number, completed: number, total: number) => {
    if (!tracking) return;
    
    const status = completed === 0 ? 'pending' : completed === total ? 'done' : 'partial';
    tracking.updateItemState(orderId, itemIdx, { completed, status: status as any });
  };

  return (
    <div className="space-y-4">
      {tracking && hasUnsavedChanges && (
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold text-orange-900">יש שינויים שלא נשמרו</div>
                <div className="text-sm text-orange-700">לחץ על "שמור שינויים" כדי לשמור את העדכונים</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all"
                disabled={isSaving}
              >
                בטל
              </button>
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
            </div>
          </div>
          
          {saveError && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 rounded p-2">
              ❌ {saveError}
            </div>
          )}
          
          {saveSuccess && (
            <div className="mt-2 text-sm text-green-600 bg-green-50 rounded p-2">
              ✓ השינויים נשמרו בהצלחה!
            </div>
          )}
        </div>
      )}

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

        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => setTimeRange("today")}
              className={`px-4 py-3 rounded-xl border-2 transition-all font-medium ${
                timeRange === "today"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg scale-105"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md"
              }`}
            >
              <div className="text-lg mb-1">📅</div>
              <div className="text-sm">היום</div>
            </button>
            
            <button
              onClick={() => setTimeRange("weekend")}
              className={`px-4 py-3 rounded-xl border-2 transition-all font-medium ${
                timeRange === "weekend"
                  ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-600 shadow-lg scale-105"
                  : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:shadow-md"
              }`}
            >
              <div className="text-lg mb-1">🎯</div>
              <div className="text-sm">עד סוף השבוע</div>
            </button>
            
            <button
              onClick={() => setTimeRange("twoweeks")}
              className={`px-4 py-3 rounded-xl border-2 transition-all font-medium ${
                timeRange === "twoweeks"
                  ? "bg-gradient-to-br from-pink-500 to-pink-600 text-white border-pink-600 shadow-lg scale-105"
                  : "bg-white text-gray-700 border-gray-200 hover:border-pink-300 hover:shadow-md"
              }`}
            >
              <div className="text-lg mb-1">📆</div>
              <div className="text-sm">שבועיים קרובים</div>
            </button>
            
            <button
              onClick={() => setTimeRange("custom")}
              className={`px-4 py-3 rounded-xl border-2 transition-all font-medium ${
                timeRange === "custom"
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-600 shadow-lg scale-105"
                  : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:shadow-md"
              }`}
            >
              <div className="text-lg mb-1">⚙️</div>
              <div className="text-sm">מותאם אישית</div>
            </button>
          </div>

          {timeRange === "custom" && (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">📍 מתאריך</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">🏁 עד תאריך</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`px-6 py-3 rounded-xl border-2 transition-all font-bold shadow-md ${
                focusMode
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:shadow-lg"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{focusMode ? "📊" : "🎯"}</span>
                <span>{focusMode ? "הצג לקוחות" : "מצב מיקוד"}</span>
              </div>
            </button>
            
            <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              <span className="font-bold text-gray-900">{filteredOrders.length}</span> הזמנות
              <span className="mx-2">•</span>
              {startDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
      </div>

      {focusMode ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">📊 סיכום מנות</h3>
            <div className="text-sm text-gray-600">
              סה״כ <span className="font-bold text-lg text-gray-900">{Object.values(itemsSummary).reduce((a, b) => a + b, 0)}</span> פריטים
            </div>
          </div>
          
          <div className="space-y-3">
            {getCategoryOrder().map(category => {
              const categoryItems = itemsByCategory[category];
              if (!categoryItems || categoryItems.length === 0) return null;
              
              const categoryColor = getCategoryColor(category);
              const totalInCategory = categoryItems.reduce((sum: number, item: any) => sum + item.qty, 0);
              
              const darkerColor = (() => {
                const hex = categoryColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                const darkerR = Math.floor(r * 0.6);
                const darkerG = Math.floor(g * 0.6);
                const darkerB = Math.floor(b * 0.6);
                return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
              })();
              
              return (
                <div key={category} className="rounded-lg overflow-hidden border-2" style={{ borderColor: categoryColor }}>
                  <div 
                    className="px-4 py-2 flex items-center justify-between"
                    style={{ backgroundColor: categoryColor }}
                  >
                    <span className="text-base font-bold text-gray-800">{category}</span>
                    <span className="text-xs font-bold text-gray-700 bg-white/50 px-2 py-1 rounded-full">
                      ({totalInCategory})
                    </span>
                  </div>
                  
                  <div className="p-2" style={{ backgroundColor: `${categoryColor}10` }}>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {categoryItems.map((item: any) => {
                        const isExpanded = expandedItems.has(item.title);
                        const statusSummary = getItemSummaryStatus(item.title);
                        
                        // מציאת כל הלקוחות עם המנה הזו
                        const clientsWithItem: Array<{
                          clientName: string;
                          color: string;
                          date: string;
                          items: Array<{ orderId: string; itemIdx: number; qty: number; notes?: string }>;
                        }> = [];
                        
                        filteredOrders.forEach(order => {
                          order.items.forEach((orderItem: any, itemIdx: number) => {
                            if (orderItem.title === item.title) {
                              let client = clientsWithItem.find(c => c.clientName === order.clientName);
                              if (!client) {
                                client = {
                                  clientName: order.clientName,
                                  color: getClientColor(order.clientName),
                                  date: new Date(order.eventDate).toLocaleDateString('he-IL', { 
                                    day: '2-digit', 
                                    month: '2-digit' 
                                  }),
                                  items: []
                                };
                                clientsWithItem.push(client);
                              }
                              client.items.push({
                                orderId: order.__id,
                                itemIdx,
                                qty: Number(orderItem.qty || 1),
                                notes: orderItem.notes
                              });
                            }
                          });
                        });
                        
                        return (
                          <div 
                            key={item.title} 
                            className="bg-white rounded-lg border-2 overflow-hidden"
                            style={{ borderColor: categoryColor }}
                          >
                            {/* כרטיס ראשי */}
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                {recipeLinks?.[item.title] ? (
                                  <a
                                    href={`/recipes/${recipeLinks[item.title]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline block"
                                    title="פתח מתכון"
                                  >
                                    {item.title}
                                  </a>
                                ) : (
                                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                                )}
                              </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="text-center">
                                    <div 
                                      className="text-2xl font-bold flex items-center gap-1" 
                                      style={{ 
                                        color: statusSummary.completedUnits === statusSummary.totalUnits 
                                          ? (statusSummary.isAlmost ? '#3B82F6' : '#10B981')  // כחול אם כמעט, ירוק אם הכל
                                          : darkerColor  // צבע רגיל אם לא הושלם
                                      }}
                                    >
                                      <span>{statusSummary.completedUnits}/{statusSummary.totalUnits}</span>
                                      {statusSummary.completedUnits === statusSummary.totalUnits && statusSummary.isAlmost && (
                                        <span className="text-lg">*</span>  // כוכבית אם הכל הושלם אבל יש "כמעט"
                                      )}
                                    </div>
                                  </div>
                                  {/* כפתור פתיחה/סגירה */}
                                  <button
                                    onClick={() => toggleItem(item.title)}
                                    className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-all shadow-sm"
                                  >
                                    <span className="text-white text-xl font-bold">
                                      ?
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* תוכן מורחב */}
                            {isExpanded && (
                              <div className="border-t-2 bg-gray-50" style={{ borderColor: categoryColor }}>
                                <div className="p-3 space-y-2">
                                  {clientsWithItem.map((client, clientIdx) => (
                                    <div 
                                      key={clientIdx}
                                      className="bg-white rounded-lg border-2 overflow-hidden"
                                      style={{ borderColor: client.color }}
                                    >
                                      {/* שורת לקוח */}
                                      <div 
                                        className="px-3 py-2 flex items-center justify-between"
                                        style={{ backgroundColor: `${client.color}20` }}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: client.color }}
                                          />
                                          <span className="font-bold text-sm">{client.clientName}</span>
                                          <span className="text-xs text-gray-500">({client.date})</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">
                                          {client.items.reduce((sum, it) => sum + it.qty, 0)} יח׳
                                        </span>
                                      </div>

                                      {/* פריטים */}
                                      <div className="px-2 py-1.5 space-y-1">
                                        {client.items.map((itemInfo, idx) => {
                                          const state = tracking?.getItemState(itemInfo.orderId, itemInfo.itemIdx) || { status: 'pending', missingNote: '' };
                                          const statusColor = getStatusColor(state.status);
                                          const statusIcon = getStatusIcon(state.status);
                                          
                                          return (
                                            <div key={idx} className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                {/* Checkbox */}
                                                <button
                                                  onClick={() => cycleStatus(itemInfo.orderId, itemInfo.itemIdx, itemInfo.qty)}
                                                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                                  style={{ 
                                                    backgroundColor: statusColor,
                                                    opacity: state.status === 'pending' ? 0.3 : 1
                                                  }}
                                                >
                                                  <span className="text-white text-sm font-bold">{statusIcon}</span>
                                                </button>
                                                
                                                <span className="text-sm text-gray-600">{itemInfo.qty} יח׳</span>
                                                
                                                {/* תגית סטטוס */}
                                                <div 
                                                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                  style={{
                                                    backgroundColor: `${statusColor}20`,
                                                    color: statusColor
                                                  }}
                                                >
                                                  {state.status === 'done' ? 'הושלם' :
                                                   state.status === 'almost' ? 'כמעט' :
                                                   state.status === 'partial' ? 'חלקי' : 'ממתין'}
                                                </div>

                                                {/* הערה מהמנה המקורית */}
                                                {itemInfo.notes && (
                                                  <div className="flex-1 text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                                    💬 {itemInfo.notes}
                                                  </div>
                                                )}
                                              </div>

                                              {/* אזור הערה חסרה/עדכון כמות - רק במצב "כמעט" */}
                                              {state.status === 'almost' && (
                                                <div className="mr-8 space-y-1">
                                                  {/* הערה על חסר */}
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="text"
                                                      value={state.missingNote || ''}
                                                      onChange={(e) => updateMissingNote(itemInfo.orderId, itemInfo.itemIdx, e.target.value)}
                                                      placeholder="הערה על חסר..."
                                                      className="flex-1 text-xs px-2 py-1 rounded border border-blue-300 focus:border-blue-500 outline-none"
                                                    />
                                                  </div>
                                                  
                                                  {/* עדכון כמות שהושלמה */}
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-600">הושלם:</span>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max={itemInfo.qty}
                                                      value={
                                                        editingCompleted?.orderId === itemInfo.orderId && 
                                                        editingCompleted?.itemIdx === itemInfo.itemIdx
                                                          ? editingCompleted.value
                                                          : (state.completed || 0)
                                                      }
                                                      onChange={(e) => {
                                                        // רק שומר מקומית את הערך בזמן ההקלדה
                                                        setEditingCompleted({
                                                          orderId: itemInfo.orderId,
                                                          itemIdx: itemInfo.itemIdx,
                                                          value: e.target.value
                                                        });
                                                      }}
                                                      onBlur={(e) => {
                                                        // שומר בפועל רק כשעוזבים את השדה
                                                        const value = Number(e.target.value);
                                                        if (!isNaN(value) && value >= 0 && value <= itemInfo.qty) {
                                                          updateCompleted(itemInfo.orderId, itemInfo.itemIdx, value, itemInfo.qty);
                                                        }
                                                        setEditingCompleted(null);
                                                      }}
                                                      onKeyDown={(e) => {
                                                        // שמירה גם ב-Enter
                                                        if (e.key === 'Enter') {
                                                          e.currentTarget.blur();
                                                        }
                                                      }}
                                                      className="w-16 text-xs px-2 py-1 rounded border border-blue-300 focus:border-blue-500 outline-none text-center"
                                                    />
                                                    <span className="text-xs text-gray-500">מתוך {itemInfo.qty}</span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">
              אין הזמנות בתקופה זו
            </div>
          ) : (
            filteredOrders.map((order: any) => {
              const isExpanded = expandedOrders.has(order.__id);
              
              return (
                <OrderCard
                  key={`${order.__id}-${refreshKey}`}
                  order={order}
                  mode="client"
                  clientColor={getClientColor(order.clientName)}
                  onEditColor={handleEditColor}
                  onEditItem={onEditItem}
                  onEditOrderNotes={onEditOrderNotes}
                  onRemoveItem={onRemoveItem}
                  onDelete={onDeleteOrder}
                  onAddItem={onAddItem}
                  noteOpen={noteOpen}
                  toggleNote={toggleNote}
                  isManager={isManager}
                  menuOptions={menuOptions}
                  recipeLinks={recipeLinks}
                  isCollapsible={true}
                  defaultExpanded={false}
                  externalExpanded={isExpanded}
                  onToggle={(orderId, expanded) => toggleOrder(orderId, expanded)}
                />
              );
            })
          )}
        </div>
      )}

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