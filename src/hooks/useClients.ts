// hooks/useClients.ts
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { getRandomColor } from "@/utils/colorHelpers";

export interface Client {
  id: string; // clientName בתור מזהה ייחודי
  name: string;
  color: string;
  createdAt?: any;
  updatedAt?: any;
}

export function useClients(userId: string | undefined) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 📡 טעינה מ-Firestore בזמן אמת
  useEffect(() => {
    if (!userId) {
      setClients([]);
      setLoading(false);
      return;
    }

    const clientsCol = collection(db, "clients");
    const q = query(clientsCol, orderBy("name", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.id,
          color: d.data().color || "#73a1ecff",
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setClients(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed loading clients", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  // 🎨 עדכון צבע של לקוח
  const updateClientColor = async (clientName: string, newColor: string) => {
    try {
      const clientDoc = doc(db, "clients", clientName);
      await setDoc(
        clientDoc,
        {
          name: clientName,
          color: newColor,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`✅ צבע עודכן עבור ${clientName}`);
    } catch (e) {
      console.error("❌ שגיאה בעדכון צבע", e);
      throw e;
    }
  };

  // ➕ יצירת לקוח חדש (או עדכון אם קיים)
  const ensureClient = async (clientName: string, initialColor?: string) => {
    try {
      const clientDoc = doc(db, "clients", clientName);
      await setDoc(
        clientDoc,
        {
          name: clientName,
          color: initialColor || getRandomColor(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("❌ שגיאה ביצירת לקוח", e);
      throw e;
    }
  };

  // 🔍 קבלת צבע של לקוח (עם fallback)
  const getClientColor = (clientName: string): string => {
    const client = clients.find((c) => c.id === clientName || c.name === clientName);
    return client?.color || "#73a1ecff";
  };

  return {
    clients,
    loading,
    updateClientColor,
    ensureClient,
    getClientColor,
  };
}