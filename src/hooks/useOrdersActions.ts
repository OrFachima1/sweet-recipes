import { useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { IngestJsonOrder } from '@/types/orders';
import { generateId } from '@/utils/imageHelpers';
import { fmtYMD } from '@/utils/orders';

interface UseOrdersActionsProps {
  orders: IngestJsonOrder[];
  setOrders: (orders: IngestJsonOrder[]) => void;
}

export function useOrdersActions({ orders, setOrders }: UseOrdersActionsProps) {
  
  // מחיקת הזמנה
  const deleteOrder = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      setOrders(orders.filter(o => o.__id !== id));
    } catch (error) {
      console.error('Failed to delete order:', error);
      alert('שגיאה במחיקת הזמנה');
    }
  }, [orders, setOrders]);

  // עריכת פריט בהזמנה
const editOrderItem = useCallback(async (
  orderId: string,
  itemIndex: number,
  patch: Partial<any>
) => {
  const order = orders.find(o => o.__id === orderId);
  if (!order) return;

  const newItems = [...order.items];
  newItems[itemIndex] = { ...newItems[itemIndex], ...patch };

  try {
    // 🔥 תיקון: ניקוי undefined לפני שמירה
    const cleanOrder = {
      ...order,
      items: newItems,
      // וידוא שאין undefined
      orderNotes: order.orderNotes === undefined ? null : (order.orderNotes || null),
      updatedAt: serverTimestamp(),
    };
    
    // 🔥 הסרת כל undefined מהאובייקט
    const finalOrder = JSON.parse(
      JSON.stringify(cleanOrder, (key, value) => value === undefined ? null : value)
    );
    
    await setDoc(doc(db, 'orders', orderId), finalOrder);
    
    setOrders(orders.map(o => 
      o.__id === orderId ? { ...o, items: newItems } : o
    ));
  } catch (error) {
    console.error('Failed to edit item:', error);
    alert('שגיאה בעריכת פריט');
  }
}, [orders, setOrders]);

  // הסרת פריט מהזמנה
  const removeItemFromOrder = useCallback(async (
    orderId: string,
    itemIndex: number
  ) => {
    const order = orders.find(o => o.__id === orderId);
    if (!order) return;

    const newItems = order.items.filter((_, idx) => idx !== itemIndex);

    try {
      await setDoc(doc(db, 'orders', orderId), {
        ...order,
        items: newItems,
        updatedAt: serverTimestamp(),
      });
      
      setOrders(orders.map(o => 
        o.__id === orderId ? { ...o, items: newItems } : o
      ));
    } catch (error) {
      console.error('Failed to remove item:', error);
      alert('שגיאה בהסרת פריט');
    }
  }, [orders, setOrders]);

  // שמירת הזמנה ידנית
  const saveManualOrder = useCallback(async (orderData: Partial<IngestJsonOrder>) => {
    const id = generateId();
    const newOrder: IngestJsonOrder = {
      __id: id,
      orderId: orderData.orderId || null,
      clientName: orderData.clientName || '',
      clientColor: orderData.clientColor || undefined,
      eventDate: orderData.eventDate || fmtYMD(new Date()),
      status: orderData.status || 'pending',
      items: orderData.items || [],
      orderNotes: orderData.orderNotes || '',
      notes: orderData.notes || '',
      totalSum: orderData.totalSum || null,
      currency: orderData.currency || 'ILS',
      source: 'manual',
      // שדות משלוח
      deliveryMethod: orderData.deliveryMethod || null,
      estimatedTime: orderData.estimatedTime || null,
      phone1: orderData.phone1 || null,
      phone2: orderData.phone2 || null,
    };

    try {
      await setDoc(doc(db, 'orders', id), {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOrders([...orders, newOrder]);
    } catch (error) {
      console.error('Failed to save manual order:', error);
      alert('שגיאה בשמירת הזמנה');
    }
  }, [orders, setOrders]);
  
  return {
    deleteOrder,
    editOrderItem,
    removeItemFromOrder,
    saveManualOrder,
  };
}