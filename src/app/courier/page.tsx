'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useClientsContext } from '@/contexts/ClientsContext';
import { logout } from '@/lib/auth';
import LoadingScreen from '@/components/LoadingScreen';
import type { IngestJsonOrder } from '@/types/orders';

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateHebrew(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getTextColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose }: { order: IngestJsonOrder; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const bgColor = order.clientColor || '#73a1ec';
  const textColor = getTextColor(bgColor);
  const balance = (order.totalSum ?? 0) - (order.deposit ?? 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col max-h-[90vh] rounded-t-2xl overflow-hidden shadow-2xl bg-white pointer-events-auto">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: bgColor }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: textColor }}>{order.clientName}</h2>
            {order.estimatedTime && (
              <span className="text-sm opacity-80" style={{ color: textColor }}>⏰ {order.estimatedTime}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" dir="rtl">
          {/* Payment */}
          {order.totalSum != null && (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>סה״כ לתשלום:</span>
                <span className="font-medium">{order.totalSum.toLocaleString()} ₪</span>
              </div>
              {order.deliveryFee != null && order.deliveryFee > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>דמי משלוח:</span>
                  <span className="font-medium">{order.deliveryFee.toLocaleString()} ₪</span>
                </div>
              )}
              {(order.deposit ?? 0) > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>מקדמה:</span>
                  <span className="font-medium">{(order.deposit ?? 0).toLocaleString()} ₪</span>
                </div>
              )}
              <div className={`flex justify-between font-bold text-base border-t border-emerald-200 pt-1 ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                <span>יתרה לתשלום:</span>
                <span>{balance.toLocaleString()} ₪</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.orderNotes && (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 text-sm text-gray-700">
              <span className="font-bold block mb-1">הערות:</span>
              {order.orderNotes}
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="font-bold text-gray-700 mb-2 text-base">פריטים ({order.items.length})</h3>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between border border-gray-200">
                  <span className="text-sm font-medium text-gray-800">{item.title}</span>
                  <span className="text-sm font-bold text-gray-600 bg-white border border-gray-300 px-2 py-0.5 rounded-full">
                    × {item.qty} {item.unit || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Courier Card ─────────────────────────────────────────────────────────────

function CourierCard({ order, onDetails }: { order: IngestJsonOrder; onDetails: () => void }) {
  const bgColor = order.clientColor || '#73a1ec';
  const textColor = getTextColor(bgColor);
  const balance = (order.totalSum ?? 0) - (order.deposit ?? 0);
  const hasBalance = order.totalSum != null;

  return (
    <div className="rounded-2xl shadow-md overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: bgColor }}>
        <span className="text-lg font-bold" style={{ color: textColor }}>{order.clientName}</span>
        {order.estimatedTime && (
          <span className="text-sm font-semibold px-3 py-1 rounded-full bg-black/20" style={{ color: textColor }}>
            ⏰ {order.estimatedTime}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-3 space-y-3">
        {/* Address */}
        {order.address ? (
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(order.address)}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-blue-600 hover:text-blue-800"
          >
            <span className="text-lg mt-0.5 flex-shrink-0">📍</span>
            <span className="text-sm font-medium underline">{order.address}</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span>📍</span>
            <span>אין כתובת</span>
          </div>
        )}

        {/* Phones */}
        <div className="space-y-2">
          {order.phone1 && (
            <a href={`tel:${order.phone1}`} className="flex items-center gap-2 text-blue-600">
              <span className="text-lg flex-shrink-0">📞</span>
              <div className="flex flex-col leading-tight">
                {order.phone1Name && <span className="text-xs text-gray-500">{order.phone1Name}</span>}
                <span className="text-sm font-medium" dir="ltr">{order.phone1}</span>
              </div>
            </a>
          )}
          {order.phone2 && (
            <a href={`tel:${order.phone2}`} className="flex items-center gap-2 text-blue-600">
              <span className="text-lg flex-shrink-0">📞</span>
              <div className="flex flex-col leading-tight">
                {order.phone2Name && <span className="text-xs text-gray-500">{order.phone2Name}</span>}
                <span className="text-sm font-medium" dir="ltr">{order.phone2}</span>
              </div>
            </a>
          )}
          {!order.phone1 && !order.phone2 && (
            <span className="text-gray-400 text-sm">אין טלפון</span>
          )}
        </div>

        {/* Balance */}
        {hasBalance && (
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${balance > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
            <span className="text-sm font-medium text-gray-700">יתרה לתשלום</span>
            <span className={`text-base font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {balance.toLocaleString()} ₪
            </span>
          </div>
        )}

        {/* Details button */}
        <button
          onClick={onDetails}
          className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          פרטי הזמנה
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CourierPage() {
  const router = useRouter();
  const { user, loading: authLoading, role, displayName } = useAuth();
  const { getClientColor } = useClientsContext();

  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<IngestJsonOrder | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatDateForInput(new Date()));

  const today = formatDateForInput(new Date());
  const isToday = selectedDate === today;
  const getClientColorRef = useRef(getClientColor);
  useEffect(() => { getClientColorRef.current = getClientColor; }, [getClientColor]);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (role === null) return;
    if (role !== 'courier' && role !== 'manager' && role !== 'senior_worker') {
      router.replace('/no-access');
    }
  }, [authLoading, user, role, router]);

  // Load deliveries for selected date
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'orders'), where('eventDate', '==', selectedDate), where('deliveryMethod', '==', 'delivery')),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          return {
            __id: d.id,
            orderId: data.orderId,
            clientName: data.clientName,
            clientColor: getClientColorRef.current(data.clientName),
            eventDate: data.eventDate,
            status: data.status,
            items: data.items || [],
            orderNotes: data.orderNotes || null,
            totalSum: data.totalSum ?? null,
            deliveryFee: data.deliveryFee ?? null,
            deposit: data.deposit ?? null,
            currency: data.currency,
            deliveryMethod: data.deliveryMethod,
            estimatedTime: data.estimatedTime || null,
            phone1: data.phone1 || null,
            phone1Name: data.phone1Name || null,
            phone2: data.phone2 || null,
            phone2Name: data.phone2Name || null,
            address: data.address || null,
          } as IngestJsonOrder;
        });
        // Sort by time
        list.sort((a, b) => {
          if (!a.estimatedTime) return 1;
          if (!b.estimatedTime) return -1;
          return a.estimatedTime.localeCompare(b.estimatedTime);
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, [user, selectedDate]);

  if (authLoading || !user || role === null) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-800">🚚 משלוחים</h1>
            <div className="flex items-center gap-3">
              {displayName && <span className="text-sm text-gray-600">{displayName}</span>}
              <button
                onClick={() => logout()}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                יציאה
              </button>
            </div>
          </div>
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(formatDateForInput(d));
              }}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              ›
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-medium text-gray-700">{formatDateHebrew(selectedDate)}</span>
            </div>
            <button
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(formatDateForInput(d));
              }}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              ‹
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="px-3 h-9 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors"
              >
                היום
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Summary */}
        {!loading && (
          <div className="mb-5 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between">
            <span className="text-gray-600 font-medium">{orders.length} משלוחים</span>
            <span className="text-2xl font-bold text-blue-600">{orders.length}</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🚚</div>
            <p className="text-gray-500 text-lg font-medium">אין משלוחים היום</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <CourierCard
                key={order.__id}
                order={order}
                onDetails={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
