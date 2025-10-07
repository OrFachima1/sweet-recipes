'use client';
import OrdersCalendarPage from '@/components/OrdersCalendarPage';

export default function Page() {
  return <OrdersCalendarPage apiBase={process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'} />;
}
