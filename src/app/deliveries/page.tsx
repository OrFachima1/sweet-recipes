'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';

import { useUser, useRole } from '@/lib/auth';
import { useClients } from '@/hooks/useClients';
import LoadingScreen from '@/components/LoadingScreen';
import HomeButton from '@/components/HomeButton';
import DeliveryCard from '@/components/deliveries/DeliveryCard';
import OrderVerificationModal from '@/components/orders/modals/OrderVerificationModal';
import type { IngestJsonOrder } from '@/types/orders';

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateHebrew(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function DeliveriesPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { role } = useRole(user?.uid);
  const { getClientColor } = useClients(user?.uid);

  const [selectedDate, setSelectedDate] = useState(() => formatDateForInput(new Date()));
  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyOrderId, setVerifyOrderId] = useState<string | null>(null);
  const [dishAccessories, setDishAccessories] = useState<Record<string, string[]>>({});
  const [categoryConfig, setCategoryConfig] = useState<{
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'delivery' | 'pickup'>('all');

  // שמירת רפרנס יציב לפונקציה כדי למנוע לולאת רינדור
  const getClientColorRef = useRef(getClientColor);
  useEffect(() => {
    getClientColorRef.current = getClientColor;
  }, [getClientColor]);

  const isAuthorized = role === 'manager' || role === 'senior_worker' || role === 'worker';

  // Redirect guard
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (role == null) return;
    if (!isAuthorized) {
      router.replace('/no-access');
      return;
    }
  }, [userLoading, user, role, isAuthorized, router]);

  // Load orders for selected date
  useEffect(() => {
    if (!user || !selectedDate) return;

    setLoading(true);
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('eventDate', '==', selectedDate)
    );

    const unsub = onSnapshot(
      q,
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
            orderNotes: data.orderNotes,
            totalSum: data.totalSum,
            currency: data.currency,
            deliveryMethod: data.deliveryMethod || null,
            estimatedTime: data.estimatedTime || null,
            phone1: data.phone1 || null,
            phone1Name: data.phone1Name || null,
            phone2: data.phone2 || null,
            phone2Name: data.phone2Name || null,
            address: data.address || null,
          } as IngestJsonOrder;
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('Failed loading orders', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, selectedDate]);

  // Load dish accessories
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      doc(db, 'orderSettings', 'dishAccessories'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setDishAccessories(d.accessories || {});
        } else {
          setDishAccessories({});
        }
      }
    );

    return () => unsub();
  }, [user]);

  // Load category config for verification modal
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      doc(db, 'orderSettings', 'categoryConfig'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const config = {
            items: data.items || {},
            itemMapping: data.itemMapping || {},
          };
          setCategoryConfig(config);
        }
      }
    );

    return () => unsub();
  }, [user]);

  // Filter by type
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (filterType === 'delivery') {
      filtered = orders.filter((o) => o.deliveryMethod === 'delivery');
    } else if (filterType === 'pickup') {
      filtered = orders.filter((o) => o.deliveryMethod === 'pickup' || !o.deliveryMethod);
    }
    return filtered.sort((a, b) => {
      if (!a.estimatedTime) return 1;
      if (!b.estimatedTime) return -1;
      return a.estimatedTime.localeCompare(b.estimatedTime);
    });
  }, [orders, filterType]);

  const deliveryCount = orders.filter((o) => o.deliveryMethod === 'delivery').length;
  const pickupCount = orders.filter((o) => o.deliveryMethod === 'pickup' || !o.deliveryMethod).length;

  // Loading states
  if (userLoading || !user || role == null) {
    return <LoadingScreen />;
  }
  if (!isAuthorized) {
    return null;
  }

  const handleVerify = (orderId: string) => {
    setVerifyOrderId(orderId);
  };

  const verifyOrder = verifyOrderId
    ? orders.find((o) => o.__id === verifyOrderId)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50" dir="rtl">
      <HomeButton />

      <div className="max-w-4xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">וידוא הזמנות</h1>
          <p className="text-gray-500">{formatDateHebrew(selectedDate)}</p>
        </div>

        {/* Date Picker */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 bg-white rounded-2xl shadow-md px-4 py-2">
            <button
              onClick={() => {
                const prev = new Date(selectedDate);
                prev.setDate(prev.getDate() - 1);
                setSelectedDate(formatDateForInput(prev));
              }}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-center text-lg font-medium text-gray-700 outline-none"
            />
            <button
              onClick={() => {
                const next = new Date(selectedDate);
                next.setDate(next.getDate() + 1);
                setSelectedDate(formatDateForInput(next));
              }}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setFilterType('all')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              filterType === 'all'
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
            }`}
          >
            הכל ({orders.length})
          </button>
          <button
            onClick={() => setFilterType('delivery')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              filterType === 'delivery'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
            }`}
          >
            🚚 משלוחים ({deliveryCount})
          </button>
          <button
            onClick={() => setFilterType('pickup')}
            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
              filterType === 'pickup'
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow'
            }`}
          >
            🏪 איסופים ({pickupCount})
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 text-lg">אין הזמנות ליום זה</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredOrders.map((order) => (
              <DeliveryCard
                key={order.__id}
                order={order}
                onVerify={() => handleVerify(order.__id!)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {verifyOrder && (
        <OrderVerificationModal
          order={verifyOrder}
          dishAccessories={dishAccessories}
          categoryConfig={categoryConfig || undefined}
          onClose={() => setVerifyOrderId(null)}
        />
      )}
    </div>
  );
}
