"use client";
import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import deepEqual from "fast-deep-equal";
import { useAuth } from "./AuthContext";
import { setCategoryConfig as setGlobalCategoryConfig } from "@/utils/categoryMapping";

interface CategoryConfig {
  items: Record<string, { color: string; order: number }>;
  itemMapping: Record<string, string>;
}

interface OrderSettingsContextType {
  mapping: Record<string, string>;
  ignored: string[];
  recipeLinks: Record<string, string>;
  prices: Record<string, number>;
  categoryConfig: CategoryConfig | null;
  dishAccessories: Record<string, string[]>;
  updateMapping: (newMapping: Record<string, string>) => Promise<void>;
  updateIgnored: (newIgnored: string[]) => Promise<void>;
  updateCategoryConfig: (newConfig: CategoryConfig) => Promise<void>;
  updateRecipeLinks: (newLinks: Record<string, string>) => Promise<void>;
  updatePrices: (newPrices: Record<string, number>) => Promise<void>;
  updateDishAccessories: (newAccessories: Record<string, string[]>) => Promise<void>;
}

const OrderSettingsContext = createContext<OrderSettingsContextType>({
  mapping: {},
  ignored: [],
  recipeLinks: {},
  prices: {},
  categoryConfig: null,
  dishAccessories: {},
  updateMapping: async () => {},
  updateIgnored: async () => {},
  updateCategoryConfig: async () => {},
  updateRecipeLinks: async () => {},
  updatePrices: async () => {},
  updateDishAccessories: async () => {},
});

export function OrderSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid;

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);
  const [dishAccessories, setDishAccessories] = useState<Record<string, string[]>>({});

  // ===== LISTENERS (single set for entire app) =====
  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'orderSettings', 'main');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      setMapping(d.mapping || {});
      setIgnored(d.ignored || []);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'orderSettings', 'categoryConfig');
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      const config = {
        items: d.items || {},
        itemMapping: d.itemMapping || {},
      };
      setCategoryConfig(config);
      // 🔧 עדכון המשתנה הגלובלי לשימוש ב-OrderCard
      setGlobalCategoryConfig(config);
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'orderSettings', 'recipeLinks');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setRecipeLinks(d.links || {});
      } else {
        setRecipeLinks({});
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'orderSettings', 'prices');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setPrices(d.prices || {});
      } else {
        setPrices({});
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'orderSettings', 'dishAccessories');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setDishAccessories(d.accessories || {});
      } else {
        setDishAccessories({});
      }
    });
    return () => unsub();
  }, [userId]);

  // ===== HELPERS =====
  const setDocIfChanged = useCallback(async (ref: ReturnType<typeof doc>, fieldObj: Record<string, any>) => {
    const snap = await getDoc(ref);
    const prev: Record<string, any> = snap.exists() ? (snap.data() as Record<string, any>) : {};

    const prune = (o: Record<string, any>) => {
      const c = { ...(o || {}) };
      delete (c as any).updatedAt;
      return c;
    };

    const nextFull = { ...prev, ...fieldObj };
    if (deepEqual(prune(prev), prune(nextFull))) return;

    await setDoc(ref, { ...fieldObj, updatedAt: serverTimestamp() }, { merge: true });
  }, []);

  // ===== MUTATIONS =====
  const updateMapping = useCallback(async (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    const ref = doc(db, 'orderSettings', 'main');
    await setDocIfChanged(ref, { mapping: newMapping });
  }, [setDocIfChanged]);

  const updateIgnored = useCallback(async (newIgnored: string[]) => {
    setIgnored(newIgnored);
    const ref = doc(db, 'orderSettings', 'main');
    await setDocIfChanged(ref, { ignored: newIgnored });
  }, [setDocIfChanged]);

  const updateCategoryConfig = useCallback(async (newConfig: CategoryConfig) => {
    setCategoryConfig(newConfig);
    const ref = doc(db, 'orderSettings', 'categoryConfig');
    await setDocIfChanged(ref, { ...newConfig });
  }, [setDocIfChanged]);

  const updateRecipeLinks = useCallback(async (newLinks: Record<string, string>) => {
    setRecipeLinks(newLinks);
    const ref = doc(db, 'orderSettings', 'recipeLinks');
    await setDocIfChanged(ref, { links: newLinks });
  }, [setDocIfChanged]);

  const updatePrices = useCallback(async (newPrices: Record<string, number>) => {
    setPrices(newPrices);
    const ref = doc(db, 'orderSettings', 'prices');
    await setDocIfChanged(ref, { prices: newPrices });
  }, [setDocIfChanged]);

  const updateDishAccessories = useCallback(async (newAccessories: Record<string, string[]>) => {
    setDishAccessories(newAccessories);
    const ref = doc(db, 'orderSettings', 'dishAccessories');
    await setDocIfChanged(ref, { accessories: newAccessories });
  }, [setDocIfChanged]);

  return (
    <OrderSettingsContext.Provider
      value={{
        mapping,
        ignored,
        recipeLinks,
        prices,
        categoryConfig,
        dishAccessories,
        updateMapping,
        updateIgnored,
        updateCategoryConfig,
        updateRecipeLinks,
        updatePrices,
        updateDishAccessories,
      }}
    >
      {children}
    </OrderSettingsContext.Provider>
  );
}

export function useOrderSettingsContext() {
  return useContext(OrderSettingsContext);
}
