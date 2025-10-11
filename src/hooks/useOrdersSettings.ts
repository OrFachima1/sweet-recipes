import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import deepEqual from 'fast-deep-equal';

export function useOrdersSettings(userId?: string) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [categoryConfig, setCategoryConfig] = useState<{
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  } | null>(null);

  // ===== LISTENERS (קריאה בלבד) =====
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
      setCategoryConfig({
        items: d.items || {},
        itemMapping: d.itemMapping || {},
      });
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

  // ===== HELPERS (כתיבה בטוחה עם Guard) =====
  const setDocIfChanged = async (ref: ReturnType<typeof doc>, fieldObj: Record<string, any>) => {
    const snap = await getDoc(ref);
    const prev: Record<string, any> = snap.exists() ? (snap.data() as Record<string, any>) : {};

    // אל נשווה updatedAt
    const prune = (o: Record<string, any>) => {
      const c = { ...(o || {}) };
      delete (c as any).updatedAt;
      return c;
    };

    const nextFull = { ...prev, ...fieldObj };
    if (deepEqual(prune(prev), prune(nextFull))) return;

    await setDoc(ref, { ...fieldObj, updatedAt: serverTimestamp() }, { merge: true });
  };

  // ===== MUTATIONS (כותבים רק אם יש שינוי אמיתי) =====
  const updateMapping = async (newMapping: Record<string, string>) => {
    setMapping(newMapping); // UI מיד
    const ref = doc(db, 'orderSettings', 'main');
    await setDocIfChanged(ref, { mapping: newMapping });
  };

  const updateIgnored = async (newIgnored: string[]) => {
    setIgnored(newIgnored); // UI מיד
    const ref = doc(db, 'orderSettings', 'main');
    await setDocIfChanged(ref, { ignored: newIgnored });
  };

  const updateCategoryConfig = async (newConfig: {
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  }) => {
    setCategoryConfig(newConfig); // UI מיד
    const ref = doc(db, 'orderSettings', 'categoryConfig');
    await setDocIfChanged(ref, { ...newConfig });
  };

  const updateRecipeLinks = async (newLinks: Record<string, string>) => {
    setRecipeLinks(newLinks); // UI מיד
    const ref = doc(db, 'orderSettings', 'recipeLinks');
    await setDocIfChanged(ref, { links: newLinks });
  };

  return {
    mapping,
    ignored,
    recipeLinks,
    categoryConfig,
    updateMapping,
    updateIgnored,
    updateCategoryConfig,
    updateRecipeLinks,
  };
}
