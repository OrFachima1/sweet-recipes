'use client';
import OrdersCalendarPage from '@/components/OrdersCalendarPage';
import { OrderTrackingProvider } from '@/components/orders/tracking/OrderTrackingContext';
import { useUser, useRole } from '@/lib/auth';

export default function Page() {
  const { user } = useUser();
  const { displayName } = useRole(user?.uid);
  
  return (
    <OrderTrackingProvider 
      userName={displayName || user?.email || "עובד"}
      userId={user?.uid} // 👈 הוסף את זה
    >
      <OrdersCalendarPage apiBase={process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'} />
    </OrderTrackingProvider>
  );
}