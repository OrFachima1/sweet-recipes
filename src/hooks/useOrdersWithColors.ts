// src/hooks/useOrdersWithColors.ts
import { useMemo } from 'react';
import type { IngestJsonOrder } from '@/types/orders';
import type { Client } from './useClients';

/**
 * Hook שמוודא שכל הזמנה מכילה את הצבע המעודכן ביותר של הלקוח
 * פותר את בעיית הצבעים שלא מתעדכנים בזמן אמת
 * 
 * ⚠️ CRITICAL: תלוי ב-clients array, לא בפונקציה getClientColor
 * זה מונע infinite loop ומבטיח עדכון כשהצבעים משתנים
 */
export function useOrdersWithColors(
  orders: IngestJsonOrder[],
  clients: Client[]
): IngestJsonOrder[] {
  return useMemo(() => {
    // יצירת מפה מהירה של צבעים לפי שם לקוח
    const colorMap = new Map<string, string>();
    clients.forEach(client => {
      colorMap.set(client.name, client.color);
      colorMap.set(client.id, client.color);
    });
    
    // עדכון כל ההזמנות עם הצבע המעודכן
    return orders.map(order => ({
      ...order,
      clientColor: colorMap.get(order.clientName) || '#a5c4f7ff'
    }));
  }, [orders, clients]); // ✅ תלוי ב-orders וב-clients!
}