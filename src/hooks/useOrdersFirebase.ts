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
import { setCategoryConfig } from '@/utils/categoryMapping';
import type { IngestJsonOrder } from '@/types/orders';

interface UseOrdersFirebaseProps {
  user: any;
  isManager: boolean;
  getClientColor: (clientName: string) => string;
  setOrders: (orders: IngestJsonOrder[]) => void;
  orders: IngestJsonOrder[];
  settings: {
    updateMapping: (m: Record<string, string>) => void;
    updateIgnored: (arr: string[]) => void;
    updateCategoryConfig: (cfg: {
      items: Record<string, { color: string; order: number }>;
      itemMapping: Record<string, string>;
    }) => void;
  };
  setMenuOptions: (options: string[]) => void;
}

export function useOrdersFirebase({
  user,
  isManager,
  getClientColor,
  setOrders,
  orders,
  settings,
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

  // ===== Load Settings & Category Config (מאוחד) =====
  useEffect(() => {
    if (!user) return;

    const settingsDoc = doc(db, 'orderSettings', 'main');
    const categoryDoc = doc(db, 'orderSettings', 'categoryConfig');

    const unsub1 = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) {
        const data: any = snap.data();
        settings.updateMapping(data.mapping || {});
        settings.updateIgnored(data.ignored || []);
      }
    });

    const unsub2 = onSnapshot(categoryDoc, (snap) => {
      if (snap.exists()) {
        const data: any = snap.data();
        const config = {
          items: data.items || {},
          itemMapping: data.itemMapping || {},
        };
        settings.updateCategoryConfig(config);
        setCategoryConfig(config);
      } else {
        // אופציונלי: איפוס אם אין דוק
        const empty = { items: {}, itemMapping: {} };
        settings.updateCategoryConfig(empty);
        setCategoryConfig(empty as any);
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [user, settings]);

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
            clientColor:
              order.clientColor || getClientColorRef.current(order.clientName),
            eventDate: order.eventDate ?? null,
            status: order.status ?? 'new',
            items: (order.items || []).map((item) => ({
              title: item.title ?? null,
              qty: typeof item.qty === 'number' ? item.qty : 1,
              unit: item.unit ?? null,
              notes: item.notes ?? null,
            })),
            orderNotes: order.orderNotes ?? null,
            totalSum: typeof order.totalSum === 'number' ? order.totalSum : null,
            currency: order.currency ?? null,
            source: order.source ?? null,
            meta: order.meta ?? null,
            // אם זה יצירה חדשה, זה יהיה ה-createdAt; בעדכונים הוא יכול להישאר כפי שהיה.
          };

          // משתמשים ב-merge כדי לא לשכתב מסמך ללא צורך
          // (אם אתה רוצה למנוע כתיבה כשהתוכן זהה, אפשר להוסיף כאן guard עם getDoc+השוואה)
          writeBatch; // no-op to satisfy import in some bundlers
          // set כרגיל:
          // הערה: אם תרצה ממש לצמצם כתיבות, החלף ל-set עם merge:true רק כשיש שינוי אמיתי.
          // כאן נשאיר כמו שהיה אצלך (שקול Guard בהמשך אם עדיין רואים הרבה writes).
          // כדי לשמור על ההתנהגות הקודמת שלך:
          // batch.set(orderDoc, cleanData);  // ← אם תרצה תמיד לשכתב
          // עדיף:
          // batch.set(orderDoc, cleanData, { merge: true });

          batch.set(orderDoc, cleanData, { merge: true });
        }

        await batch.commit();
      } catch (e: any) {
        console.error('שגיאה בשמירה:', e);
        alert(
          `שגיאה בשמירה ל-Firebase: ${e?.message || e?.code || 'Unknown error'}`
        );
      }
    },
    [user, isManager, orders] // לא תלוי בפונקציות משתנות
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
