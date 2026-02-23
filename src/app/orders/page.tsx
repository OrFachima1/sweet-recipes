'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import OrdersCalendarPage from '@/components/OrdersCalendarPage';
import { OrderTrackingProvider } from '@/components/orders/tracking/OrderTrackingContext';
import HomeButton from '@/components/HomeButton';

import { useUser, useRole } from '@/lib/auth';
import LoadingScreen from "@/components/LoadingScreen";

export default function Page() {
  const router = useRouter();

  const { user, loading: userLoading } = useUser();
  // מחזיר: "manager" | "senior_worker" | "worker" | "unauthorized" | null
  const { role, displayName } = useRole(user?.uid);

  // כל התפקידים המורשים (מנהל, אחמ"ש, עובד)
  const isAuthorized = role === 'manager' || role === 'senior_worker' || role === 'worker';

  // שים לב: לא useMemo – שלא נשבור את סדר ה-hooks
  const userName = displayName || user?.email || 'עובד';

  // Redirect guard – מפעילים רק אחרי שה-user נטען
  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }
    if (role == null) return;            // עדיין טוען role
    if (!isAuthorized) {
      router.replace('/no-access');
      return;
    }
  }, [userLoading, user, role, isAuthorized, router]);

  // שלדי ביניים
  if (userLoading || !user || role == null) {
    return <LoadingScreen />;
  }
  if (!isAuthorized) {
    // ה-useEffect כבר מפנה; לא מרנדרים תוכן כדי למנוע הבזק
    return null;
  }

  return (
    <>
      <HomeButton />
      <OrderTrackingProvider userName={userName} userId={user.uid}>
        <OrdersCalendarPage
          apiBase={process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'}
        />
      </OrderTrackingProvider>
    </>
  );
}
