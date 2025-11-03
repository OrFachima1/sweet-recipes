'use client';
import React, { useState, useMemo } from 'react';

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
}

type DateFilter = 'today' | 'week' | 'month' | 'custom' | 'all';

export default function RevenueModal({ show, onClose, orders, prices }: RevenueModalProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'clients' | 'products'>('clients');

  // חישוב טווח תאריכים
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return { start: today, end: today };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // ראשון
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { start: weekStart, end: weekEnd };
      
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: monthStart, end: monthEnd };
      
      case 'custom':
        if (!customStart || !customEnd) return null;
        return {
          start: new Date(customStart),
          end: new Date(customEnd)
        };
      
      case 'all':
        return null;
    }
  }, [dateFilter, customStart, customEnd]);

  // סינון הזמנות לפי תאריך
  const filteredOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    if (!dateRange) return orders;
    
    return orders.filter(order => {
      if (!order.eventDate) return false;
      const orderDate = new Date(order.eventDate);
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
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

        // לפי מוצר
        if (!byProduct[item.title]) {
          byProduct[item.title] = { revenue: 0, quantity: 0, orders: 0 };
        }
        byProduct[item.title].revenue += itemRevenue;
        byProduct[item.title].quantity += item.qty;
      });

      // לפי לקוח
      if (!byClient[order.clientName]) {
        byClient[order.clientName] = { revenue: 0, orderCount: 0, items: {} };
      }
      byClient[order.clientName].revenue += orderRevenue;
      byClient[order.clientName].orderCount += 1;

      totalRevenue += orderRevenue;
    });

    // ספירת הזמנות ייחודיות לכל מוצר
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (byProduct[item.title] && !byProduct[item.title].orders) {
          byProduct[item.title].orders = 0;
        }
      });
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
    { value: 'week', label: 'השבוע', icon: '📆' },
    { value: 'month', label: 'החודש', icon: '🗓️' },
    { value: 'all', label: 'הכל', icon: '∞' },
    { value: 'custom', label: 'מותאם', icon: '⚙️' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 w-full max-w-7xl h-[90vh] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border-2 border-purple-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-l from-purple-600 via-purple-500 to-pink-500 px-8 py-6 flex-shrink-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg">
                💰
              </div>
              <div>
                <div className="font-bold text-white text-2xl">מעקב הכנסות</div>
                <div className="text-white/90 text-sm">ניתוח מפורט של הכנסות וביצועים</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all flex items-center justify-center text-white text-xl font-bold shadow-lg hover:scale-110 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-6 border-b border-purple-200/50 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex flex-wrap gap-3 items-center">
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => setDateFilter(btn.value)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                  dateFilter === btn.value
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                    : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200 hover:border-purple-400'
                }`}
              >
                <span className="mr-2">{btn.icon}</span>
                {btn.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="mt-4 flex gap-3 items-center animate-in slide-in-from-top duration-300">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-4 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none shadow-sm"
              />
              <span className="text-gray-600 font-medium">←</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-4 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Stats Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-purple-100/50 to-pink-100/50 border-b border-purple-200/50 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* סה"כ הכנסות */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">סה"כ הכנסות</span>
                <span className="text-3xl">💵</span>
              </div>
              <div className="text-4xl font-bold bg-gradient-to-l from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {revenueData.totalRevenue.toFixed(2)}₪
              </div>
            </div>

            {/* מספר הזמנות */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">מספר הזמנות</span>
                <span className="text-3xl">📦</span>
              </div>
              <div className="text-4xl font-bold text-blue-600">
                {revenueData.totalOrders}
              </div>
            </div>

            {/* ממוצע להזמנה */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-emerald-200 hover:scale-105 transition-transform">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">ממוצע להזמנה</span>
                <span className="text-3xl">📊</span>
              </div>
              <div className="text-4xl font-bold text-emerald-600">
                {revenueData.totalOrders > 0 
                  ? (revenueData.totalRevenue / revenueData.totalOrders).toFixed(2)
                  : '0.00'}₪
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="px-8 py-4 border-b border-purple-200/50 bg-white/30 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('clients')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'clients'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200'
              }`}
            >
              👥 לפי לקוחות
            </button>
            <button
              onClick={() => setViewMode('products')}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'products'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-white hover:bg-purple-50 text-gray-700 border border-purple-200'
              }`}
            >
              🎂 לפי מוצרים
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {viewMode === 'clients' ? (
            <div className="space-y-3">
              {revenueData.byClient.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-6xl mb-4">📭</div>
                  <div className="text-xl font-medium">אין הזמנות בטווח זה</div>
                </div>
              ) : (
                revenueData.byClient.map(([client, data], index) => (
                  <div
                    key={client}
                    className="bg-white rounded-2xl p-5 shadow-md border-2 border-purple-100 hover:border-purple-300 hover:shadow-xl transition-all hover:scale-[1.02] animate-in slide-in-from-bottom duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-lg">{client}</div>
                          <div className="text-sm text-gray-500">
                            {data.orderCount} הזמנות • ממוצע: {(data.revenue / data.orderCount).toFixed(2)}₪
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold bg-gradient-to-l from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {data.revenue.toFixed(2)}₪
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {((data.revenue / revenueData.totalRevenue) * 100).toFixed(1)}% מהכל
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {revenueData.byProduct.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-6xl mb-4">🎂</div>
                  <div className="text-xl font-medium">אין מוצרים בטווח זה</div>
                </div>
              ) : (
                revenueData.byProduct.map(([product, data], index) => (
                  <div
                    key={product}
                    className="bg-white rounded-2xl p-5 shadow-md border-2 border-pink-100 hover:border-pink-300 hover:shadow-xl transition-all hover:scale-[1.02] animate-in slide-in-from-bottom duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800 text-lg">{product}</div>
                          <div className="text-sm text-gray-500">
                            {data.quantity} יחידות • {data.orders} הזמנות • ממוצע: {(data.revenue / data.quantity).toFixed(2)}₪
                          </div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-2xl font-bold bg-gradient-to-l from-pink-600 to-orange-600 bg-clip-text text-transparent">
                          {data.revenue.toFixed(2)}₪
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {((data.revenue / revenueData.totalRevenue) * 100).toFixed(1)}% מהכל
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