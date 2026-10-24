'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { fmtYMD, isOrderInRange, type DayRange } from '@/utils/orders';

interface Order {
  __id?: string;
  clientName: string;
  eventDate?: string | null;
  items: Array<{
    title: string;
    qty: number;
    unit?: string | null;
  }>;
}

interface RevenueModalProps {
  show: boolean;
  onClose: () => void;
  orders: Order[];
  prices: Record<string, number>;
  // מדווח לעמוד איזה טווח נדרש, כדי שההזמנות שלו ייטענו מ-Firebase
  onRangeChange?: (range: DayRange | null) => void;
}

// "הכל" — כל ההזמנות במסד
const ALL_RANGE: DayRange = { start: '0000-01-01', end: '9999-12-31' };

type DateFilter = 'today' | 'week' | 'month' | 'custom' | 'all';

export default function RevenueModal({ show, onClose, orders, prices, onRangeChange }: RevenueModalProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'clients' | 'products'>('clients');

  // חישוב טווח תאריכים (YYYY-MM-DD, כולל שני הקצוות)
  const dateRange = useMemo((): DayRange | null => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { start: fmtYMD(today), end: fmtYMD(today) };

      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { start: fmtYMD(weekStart), end: fmtYMD(weekEnd) };
      }

      case 'month':
        return {
          start: fmtYMD(new Date(now.getFullYear(), now.getMonth(), 1)),
          end: fmtYMD(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };

      case 'custom':
        if (!customStart || !customEnd || customStart > customEnd) return null;
        return { start: customStart, end: customEnd };

      case 'all':
        return ALL_RANGE;
    }
  }, [dateFilter, customStart, customEnd]);

  // טעינת ההזמנות של הטווח מ-Firebase כל עוד החלון פתוח
  useEffect(() => {
    onRangeChange?.(show ? dateRange : null);
  }, [onRangeChange, show, dateRange]);

  // סינון הזמנות לפי תאריך
  const filteredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders) || !dateRange) return [];
    return orders.filter(order => isOrderInRange(order.eventDate, dateRange));
  }, [orders, dateRange]);

  // חישוב הכנסות
  const revenueData = useMemo(() => {
    const byClient: Record<string, { revenue: number; orderCount: number; items: Record<string, number> }> = {};
    const byProduct: Record<string, { revenue: number; quantity: number; orders: number }> = {};
    let totalRevenue = 0;

    if (!filteredOrders || !Array.isArray(filteredOrders)) {
      return {
        byClient: [],
        byProduct: [],
        totalRevenue: 0,
        totalOrders: 0
      };
    }

    filteredOrders.forEach(order => {
      if (!order || !order.items || !Array.isArray(order.items)) return;
      
      let orderRevenue = 0;

      order.items.forEach(item => {
        const price = prices[item.title] || 0;
        const itemRevenue = price * item.qty;
        orderRevenue += itemRevenue;

        if (!byProduct[item.title]) {
          byProduct[item.title] = { revenue: 0, quantity: 0, orders: 0 };
        }
        byProduct[item.title].revenue += itemRevenue;
        byProduct[item.title].quantity += item.qty;
      });

      if (!byClient[order.clientName]) {
        byClient[order.clientName] = { revenue: 0, orderCount: 0, items: {} };
      }
      byClient[order.clientName].revenue += orderRevenue;
      byClient[order.clientName].orderCount += 1;

      totalRevenue += orderRevenue;
    });

    Object.keys(byProduct).forEach(product => {
      byProduct[product].orders = filteredOrders.filter(order => 
        order.items.some(item => item.title === product)
      ).length;
    });

    return {
      byClient: Object.entries(byClient).sort(([, a], [, b]) => b.revenue - a.revenue),
      byProduct: Object.entries(byProduct).sort(([, a], [, b]) => b.revenue - a.revenue),
      totalRevenue,
      totalOrders: filteredOrders.length
    };
  }, [filteredOrders, prices]);

  if (!show) return null;

  const filterButtons: Array<{ value: DateFilter; label: string; icon: string }> = [
    { value: 'today', label: 'היום', icon: '📅' },
    { value: 'week', label: 'שבוע', icon: '📆' },
    { value: 'month', label: 'חודש', icon: '🗓️' },
    { value: 'all', label: 'הכל', icon: '🌐' },
    { value: 'custom', label: 'בחר', icon: '⚙️' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 w-full max-w-7xl h-[95vh] md:h-[90vh] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border-2 border-purple-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - רספונסיבי */}
        <div className="relative bg-gradient-to-l from-purple-600 via-purple-500 to-pink-500 px-3 py-3 md:px-8 md:py-6 flex-shrink-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl md:text-3xl shadow-lg">
                💰
              </div>
              <div>
                <div className="font-bold text-white text-lg md:text-2xl">מעקב הכנסות</div>
                <div className="text-white/90 text-xs md:text-sm hidden md:block">ניתוח מפורט של הכנסות</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all flex items-center justify-center text-white text-lg md:text-xl font-bold shadow-lg active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters - רספונסיבי */}
        <div className="px-3 py-3 md:px-8 md:py-6 border-b border-purple-200/50 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-wrap gap-1.5 md:gap-3 items-center">
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => setDateFilter(btn.value)}
                className={`px-2.5 py-1.5 md:px-5 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-base font-medium transition-all shadow-sm ${
                  dateFilter === btn.value
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                    : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200 hover:border-purple-400'
                }`}
              >
                <span className="mr-1">{btn.icon}</span>
                <span className="hidden sm:inline">{btn.label}</span>
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2 md:gap-3 items-stretch sm:items-center animate-in slide-in-from-top duration-300">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none shadow-sm text-sm md:text-base"
              />
              <span className="text-gray-600 font-medium text-center sm:inline hidden">←</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none shadow-sm text-sm md:text-base"
              />
            </div>
          )}
        </div>

        {/* Stats Header - רספונסיבי */}
        <div className="px-3 py-3 md:px-8 md:py-6 bg-gradient-to-r from-purple-100/50 to-pink-100/50 border-b border-purple-200/50 flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
            {/* סה"כ הכנסות */}
            <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg border-2 border-purple-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-1 md:mb-2">
                <span className="text-gray-600 font-medium text-xs md:text-base">סה"כ הכנסות</span>
                <span className="text-xl md:text-3xl">💵</span>
              </div>
              <div className="text-2xl md:text-4xl font-bold bg-gradient-to-l from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {revenueData.totalRevenue.toFixed(2)}₪
              </div>
            </div>

            {/* מספר הזמנות */}
            <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg border-2 border-blue-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-1 md:mb-2">
                <span className="text-gray-600 font-medium text-xs md:text-base">מספר הזמנות</span>
                <span className="text-xl md:text-3xl">📦</span>
              </div>
              <div className="text-2xl md:text-4xl font-bold text-blue-600">
                {revenueData.totalOrders}
              </div>
            </div>

            {/* ממוצע להזמנה */}
            <div className="bg-white rounded-xl md:rounded-2xl p-3 md:p-6 shadow-lg border-2 border-emerald-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-1 md:mb-2">
                <span className="text-gray-600 font-medium text-xs md:text-base">ממוצע להזמנה</span>
                <span className="text-xl md:text-3xl">📊</span>
              </div>
              <div className="text-2xl md:text-4xl font-bold text-emerald-600">
                {revenueData.totalOrders > 0 
                  ? (revenueData.totalRevenue / revenueData.totalOrders).toFixed(2)
                  : '0.00'}₪
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle - רספונסיבי */}
        <div className="px-3 py-2 md:px-8 md:py-4 border-b border-purple-200/50 bg-white/30 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('clients')}
              className={`flex-1 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-medium transition-all ${
                viewMode === 'clients'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200'
              }`}
            >
              <span className="hidden sm:inline">👥 </span>לקוחות
            </button>
            <button
              onClick={() => setViewMode('products')}
              className={`flex-1 px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-medium transition-all ${
                viewMode === 'products'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200'
              }`}
            >
              <span className="hidden sm:inline">🎂 </span>מוצרים
            </button>
          </div>
        </div>

        {/* Content - רספונסיבי */}
        <div className="flex-1 overflow-auto px-3 py-3 md:px-8 md:py-6">
          {viewMode === 'clients' ? (
            <div className="space-y-2 md:space-y-3">
              {revenueData.byClient.length === 0 ? (
                <div className="text-center py-12 md:py-16 text-gray-500">
                  <div className="text-4xl md:text-6xl mb-2 md:mb-4">📭</div>
                  <div className="text-base md:text-xl font-medium">אין הזמנות בטווח זה</div>
                </div>
              ) : (
                revenueData.byClient.map(([client, data], index) => (
                  <div
                    key={client}
                    className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-md border-2 border-purple-100 hover:border-purple-300 hover:shadow-xl transition-all hover:scale-[1.01] md:hover:scale-[1.02] animate-in slide-in-from-bottom duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm md:text-lg shadow-lg flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-sm md:text-lg truncate">{client}</div>
                          <div className="text-xs md:text-sm text-gray-500">
                            {data.orderCount} הזמנות • ממוצע: {(data.revenue / data.orderCount).toFixed(2)}₪
                          </div>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <div className="text-lg md:text-2xl font-bold bg-gradient-to-l from-purple-600 to-pink-600 bg-clip-text text-transparent whitespace-nowrap">
                          {data.revenue.toFixed(2)}₪
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 md:mt-1">
                          {((data.revenue / revenueData.totalRevenue) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {revenueData.byProduct.length === 0 ? (
                <div className="text-center py-12 md:py-16 text-gray-500">
                  <div className="text-4xl md:text-6xl mb-2 md:mb-4">🎂</div>
                  <div className="text-base md:text-xl font-medium">אין מוצרים בטווח זה</div>
                </div>
              ) : (
                revenueData.byProduct.map(([product, data], index) => (
                  <div
                    key={product}
                    className="bg-white rounded-xl md:rounded-2xl p-3 md:p-5 shadow-md border-2 border-pink-100 hover:border-pink-300 hover:shadow-xl transition-all hover:scale-[1.01] md:hover:scale-[1.02] animate-in slide-in-from-bottom duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm md:text-lg shadow-lg flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-sm md:text-lg truncate">{product}</div>
                          <div className="text-xs md:text-sm text-gray-500">
                            {data.quantity} יח' • {data.orders} הזמנות
                          </div>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <div className="text-lg md:text-2xl font-bold bg-gradient-to-l from-pink-600 to-orange-600 bg-clip-text text-transparent whitespace-nowrap">
                          {data.revenue.toFixed(2)}₪
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 md:mt-1">
                          {((data.revenue / revenueData.totalRevenue) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}