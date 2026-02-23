"use client";
import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
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
import { useAuth } from "./AuthContext";

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt?: any;
  updatedAt?: any;
}

interface ClientsContextType {
  clients: Client[];
  loading: boolean;
  updateClientColor: (clientName: string, newColor: string) => Promise<void>;
  ensureClient: (clientName: string, initialColor?: string) => Promise<void>;
  getClientColor: (clientName: string) => string;
}

const ClientsContext = createContext<ClientsContextType>({
  clients: [],
  loading: true,
  updateClientColor: async () => {},
  ensureClient: async () => {},
  getClientColor: () => "#73a1ecff",
});

export function ClientsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Single listener for clients collection
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

  const updateClientColor = useCallback(async (clientName: string, newColor: string) => {
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
    } catch (e) {
      console.error("Error updating client color", e);
      throw e;
    }
  }, []);

  const ensureClient = useCallback(async (clientName: string, initialColor?: string) => {
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
      console.error("Error creating client", e);
      throw e;
    }
  }, []);

  const getClientColor = useCallback((clientName: string): string => {
    const client = clients.find((c) => c.id === clientName || c.name === clientName);
    return client?.color || "#73a1ecff";
  }, [clients]);

  return (
    <ClientsContext.Provider
      value={{
        clients,
        loading,
        updateClientColor,
        ensureClient,
        getClientColor,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
}

export function useClientsContext() {
  return useContext(ClientsContext);
}
