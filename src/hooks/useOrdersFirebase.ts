// src/hooks/useOrdersFirebase.ts
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  query,
  orderBy as firestoreOrderBy,
  writeBatch,
  limit,
} from 'firebase/firestore';
import type { IngestJsonOrder } from '@/types/orders';

interface UseOrdersFirebaseProps {
  user: any;
  isManager: boolean;
  getClientColor: (clientName: string) => string;
  setOrders: (orders: IngestJsonOrder[]) => void;
  orders: IngestJsonOrder[];
  setMenuOptions: (options: string[]) => void;
}

export function useOrdersFirebase({
  user,
  isManager,
  getClientColor,
  setOrders,
  orders,
  setMenuOptions,
}: UseOrdersFirebaseProps) {
  // נשמור רפרנס לפונקציה כדי לא לשים אותה בתלויות של useEffect
  const getClientColorRef = useRef(getClientColor);
  useEffect(() => {
    getClientColorRef.current = getClientColor;
  }, [getClientColor]);

  // ----- שאילתה יציבה להזמנות (אפשר להוסיף כאן סינון תאריכים אם יש צורך) -----
  const ordersQuery = useMemo(() => {
    return query(
      collection(db, 'orders'),
      limit(200) // חשוב: לא למשוך את כל הקולקציה
    );
  }, []);

  // ===== Load Orders from Firestore (מאזין יחיד) =====
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      ordersQuery,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data: any = d.data();
          const o: IngestJsonOrder = {
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
            source: data.source,
            meta: data.meta,
            // שדות משלוח
            deliveryMethod: data.deliveryMethod || null,
            estimatedTime: data.estimatedTime || null,
            phone1: data.phone1 || null,
            phone1Name: data.phone1Name || null,
            phone2: data.phone2 || null,
            phone2Name: data.phone2Name || null,
            address: data.address || null,
          };
          return o;
        });
        setOrders(list);
      },
      (err) => {
        console.error('Failed loading orders', err);
      }
    );

    return () => unsub();
  }, [user, ordersQuery, setOrders]);

  // NOTE: Settings & Category Config listeners removed - already handled by useOrdersSettings hook
  // This eliminates duplicate Firebase reads for orderSettings/main and orderSettings/categoryConfig

  // ===== Load Menu from Firestore =====
  useEffect(() => {
    if (!user) return;

    const menuDoc = doc(db, 'orderSettings', 'menu');
    const unsub = onSnapshot(
      menuDoc,
      (snap) => {
        if (snap.exists()) {
          const data: any = snap.data();
          const menuArray = data.items || [];
          setMenuOptions(menuArray);
        } else {
          setMenuOptions([]);
        }
      },
      (err) => {
        console.error('Failed loading menu', err);
        setMenuOptions([]);
      }
    );

    return () => unsub();
  }, [user, setMenuOptions]);

  // ===== Persist Orders to Firestore =====
  const persist = useCallback(
  async (next: IngestJsonOrder[]) => {
    if (!user || !isManager) return;

    try {
      const batch = writeBatch(db);

      // משאירים רק כאלה עם __id
      const validOrders = next.filter((o) => o.__id);

      if (validOrders.length === 0) return;

      // מחיקת הזמנות שנמחקו
      const currentIds = new Set(validOrders.map((o) => o.__id!));
      const deletedIds = orders
        .filter((o) => o.__id && !currentIds.has(o.__id))
        .map((o) => o.__id!);

      for (const id of deletedIds) {
        batch.delete(doc(db, 'orders', id));
      }

      // עדכון / יצירה
      for (const order of validOrders) {
        const orderDoc = doc(db, 'orders', order.__id!);

        // ניקוי undefined → null
        const cleanData: any = {
          orderId: order.orderId ?? null,
          clientName: order.clientName ?? null,
          clientColor: order.clientColor || getClientColorRef.current(order.clientName),
          eventDate: order.eventDate ?? null,
          status: order.status ?? 'new',
          items: (order.items || []).map((item) => ({
            title: item.title ?? null,
            qty: typeof item.qty === 'number' ? item.qty : 1,
            unit: item.unit ?? null,
            notes: item.notes ?? null,
          })),
          orderNotes: order.orderNotes === undefined ? null : (order.orderNotes || null),
          totalSum: typeof order.totalSum === 'number' ? order.totalSum : null,
          currency: order.currency ?? null,
          source: order.source ?? null,
          meta: order.meta ?? null,
          // שדות משלוח
          deliveryMethod: order.deliveryMethod ?? null,
          estimatedTime: order.estimatedTime ?? null,
          phone1: order.phone1 ?? null,
          phone1Name: order.phone1Name ?? null,
          phone2: order.phone2 ?? null,
          phone2Name: order.phone2Name ?? null,
          address: order.address ?? null,
        };

        // 🔥 בדיקה נוספת - אם יש undefined בנתונים, החלף ל-null
        const finalData = JSON.parse(
          JSON.stringify(cleanData, (key, value) => value === undefined ? null : value)
        );

        console.log('💾 Persisting order:', { 
          orderId: order.__id, 
          orderNotes: finalData.orderNotes,
          orderNotesType: typeof finalData.orderNotes,
          hasUndefined: JSON.stringify(finalData).includes('undefined')
        });

        batch.set(orderDoc, finalData, { merge: true });
      }

      await batch.commit();
      console.log('✅ Successfully persisted orders');
    } catch (e: any) {
      console.error('❌ Error persisting orders:', e);
      alert(
        `שגיאה בשמירה ל-Firebase: ${e?.message || e?.code || 'Unknown error'}`
      );
    }
  },
  [user, isManager, orders]
);
  // ===== Save Settings to Firestore =====
  const saveSettings = useCallback(
    async (newMapping: Record<string, string>, newIgnored: string[]) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, 'orderSettings', 'main'),
          {
            mapping: newMapping,
            ignored: newIgnored,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error('Failed saving settings', e);
      }
    },
    [user]
  );

  return {
    persist,
    saveSettings,
  };
}
