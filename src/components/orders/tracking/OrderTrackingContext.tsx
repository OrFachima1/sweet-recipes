"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy as firestoreOrderBy,
  writeBatch
} from "firebase/firestore";

// טיפוסים
export interface ItemCompletionState {
  completed: number;
  status: 'pending' | 'partial' | 'almost' | 'done';
  missingNote: string;
}

export interface ChangeLog {
  id: string;
  timestamp: Date;
  userName: string;
  action: 'save' | 'edit' | 'delete' | 'note' | 'status' | 'multiple';
  orderId: string;
  orderName?: string;
  itemIndex?: number;
  itemTitle?: string;
  description: string;
  changes?: Array<{
    type: 'status' | 'note' | 'missingNote' | 'completed';
    itemIndex: number;
    itemTitle: string;
    oldValue?: any;
    newValue?: any;
  }>;
  oldValue?: any;
  newValue?: any;
}

export interface OrderItemState {
  [itemKey: string]: ItemCompletionState;
}

interface OrderTrackingContextType {
  itemStates: Record<string, OrderItemState>;
  getItemState: (orderId: string, itemIdx: number) => ItemCompletionState;
  updateItemState: (orderId: string, itemIdx: number, state: Partial<ItemCompletionState>) => void;
  noteStates: Record<string, boolean>;
  toggleNote: (orderId: string, itemIdx: number) => void;
  itemNotes: Record<string, string>;
  updateItemNote: (orderId: string, itemIdx: number, note: string) => void;
  changeLogs: ChangeLog[];
  getOrderHistory: (orderId: string) => ChangeLog[];
  saveOrderChanges: (orderId: string, orderName: string, items: any[]) => Promise<void>;
  clearOrderChanges: (orderId: string) => void;
  currentUser: string;
  setCurrentUser: (name: string) => void;
}

const OrderTrackingContext = createContext<OrderTrackingContextType | undefined>(undefined);

interface OrderTrackingProviderProps {
  children: React.ReactNode;
  userName?: string;
  userId?: string;
}

export function OrderTrackingProvider({ children, userName, userId }: OrderTrackingProviderProps) {
  const [itemStates, setItemStates] = useState<Record<string, OrderItemState>>({});
  const [noteStates, setNoteStates] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [currentUser, setCurrentUser] = useState<string>(userName || "עובד");

  const initialStatesRef = useRef<Record<string, {
    itemStates: OrderItemState;
    itemNotes: Record<string, string>;
  }>>({});

  useEffect(() => {
    if (userName) {
      setCurrentUser(userName);
    }
  }, [userName]);

  // 🔥 טעינת היסטוריה מ-Firestore
  useEffect(() => {
    if (!userId) return;

    const logsCol = collection(db, "orderLogs");
    const q = query(logsCol, firestoreOrderBy("timestamp", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as ChangeLog;
      });
      setChangeLogs(logs);
    });

    return () => unsub();
  }, [userId]);

  // 🔥 טעינת מצבי פריטים מ-Firestore
  useEffect(() => {
    if (!userId) return;

    const statesDoc = doc(db, "orderStates", "current");
    
    const unsub = onSnapshot(statesDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setItemStates(data.itemStates || {});
        setItemNotes(data.itemNotes || {});
      }
    });

    return () => unsub();
  }, [userId]);

  const getItemKey = (orderId: string, itemIdx: number) => `${orderId}:${itemIdx}`;

  const getItemState = useCallback((orderId: string, itemIdx: number): ItemCompletionState => {
    const key = getItemKey(orderId, itemIdx);
    const orderStates = itemStates[orderId] || {};
    return orderStates[key] || { completed: 0, status: 'pending', missingNote: '' };
  }, [itemStates]);

  const updateItemState = useCallback((
    orderId: string, 
    itemIdx: number, 
    state: Partial<ItemCompletionState>
  ) => {
    const key = getItemKey(orderId, itemIdx);
    const oldState = getItemState(orderId, itemIdx);
    
    if (!initialStatesRef.current[orderId]) {
      initialStatesRef.current[orderId] = {
        itemStates: itemStates[orderId] || {},
        itemNotes: {}
      };
    }
    
    setItemStates(prev => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [key]: { ...oldState, ...state }
      }
    }));
  }, [itemStates, getItemState]);

  const toggleNote = useCallback((orderId: string, itemIdx: number) => {
    const key = getItemKey(orderId, itemIdx);
    setNoteStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const updateItemNote = useCallback((
    orderId: string, 
    itemIdx: number, 
    note: string
  ) => {
    const key = getItemKey(orderId, itemIdx);
    
    if (!initialStatesRef.current[orderId]) {
      initialStatesRef.current[orderId] = {
        itemStates: itemStates[orderId] || {},
        itemNotes: {}
      };
    }
    if (!initialStatesRef.current[orderId].itemNotes[key]) {
      initialStatesRef.current[orderId].itemNotes[key] = itemNotes[key] || '';
    }
    
    setItemNotes(prev => ({
      ...prev,
      [key]: note
    }));
  }, [itemNotes, itemStates]);

  // 🔥 שמירה ל-Firestore כשסוגרים
  const saveOrderChanges = useCallback(async (
    orderId: string,
    orderName: string,
    items: any[]
  ) => {
    const initialData = initialStatesRef.current[orderId];
    if (!initialData) return;

    const changes: Array<{
      type: 'status' | 'note' | 'missingNote' | 'completed';
      itemIndex: number;
      itemTitle: string;
      oldValue?: any;
      newValue?: any;
    }> = [];

    const currentStates = itemStates[orderId] || {};
    items.forEach((item, idx) => {
      const key = getItemKey(orderId, idx);
      const initial = initialData.itemStates[key] || { completed: 0, status: 'pending', missingNote: '' };
      const current = currentStates[key] || { completed: 0, status: 'pending', missingNote: '' };

      if (initial.status !== current.status) {
        changes.push({
          type: 'status',
          itemIndex: idx,
          itemTitle: item.title,
          oldValue: initial.status,
          newValue: current.status
        });
      }

      if (initial.completed !== current.completed) {
        changes.push({
          type: 'completed',
          itemIndex: idx,
          itemTitle: item.title,
          oldValue: initial.completed,
          newValue: current.completed
        });
      }

      if (initial.missingNote !== current.missingNote && current.missingNote) {
        changes.push({
          type: 'missingNote',
          itemIndex: idx,
          itemTitle: item.title,
          oldValue: initial.missingNote,
          newValue: current.missingNote
        });
      }

      const initialNote = initialData.itemNotes[key] || '';
      const currentNote = itemNotes[key] || '';
      if (initialNote !== currentNote) {
        changes.push({
          type: 'note',
          itemIndex: idx,
          itemTitle: item.title,
          oldValue: initialNote,
          newValue: currentNote
        });
      }
    });

    if (changes.length > 0 && userId) {
      const newLog: ChangeLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        userName: currentUser,
        action: 'multiple',
        orderId,
        orderName,
        description: `${changes.length} שינויים בהזמנה`,
        changes
      };
      
      try {
        const batch = writeBatch(db);
        
        // שמירת לוג
        batch.set(doc(db, "orderLogs", newLog.id), {
          ...newLog,
          timestamp: serverTimestamp()
        });
        
        // שמירת מצבים נוכחיים
        batch.set(doc(db, "orderStates", "current"), {
          itemStates,
          itemNotes,
          updatedAt: serverTimestamp()
        });
        
        await batch.commit();
        
        setChangeLogs(prev => [newLog, ...prev]);
      } catch (e) {
        console.error("Failed to save to Firebase:", e);
      }
    }

    delete initialStatesRef.current[orderId];
  }, [itemStates, itemNotes, currentUser, userId]);

  const clearOrderChanges = useCallback((orderId: string) => {
    delete initialStatesRef.current[orderId];
  }, []);

  const getOrderHistory = useCallback((orderId: string): ChangeLog[] => {
    return changeLogs
      .filter(log => log.orderId === orderId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [changeLogs]);

  const value: OrderTrackingContextType = {
    itemStates,
    getItemState,
    updateItemState,
    noteStates,
    toggleNote,
    itemNotes,
    updateItemNote,
    changeLogs,
    getOrderHistory,
    saveOrderChanges,
    clearOrderChanges,
    currentUser,
    setCurrentUser
  };

  return (
    <OrderTrackingContext.Provider value={value}>
      {children}
    </OrderTrackingContext.Provider>
  );
}

export function useOrderTracking() {
  const context = useContext(OrderTrackingContext);
  if (!context) {
    throw new Error('useOrderTracking must be used within OrderTrackingProvider');
  }
  return context;
}