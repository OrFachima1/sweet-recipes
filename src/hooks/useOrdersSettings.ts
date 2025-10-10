import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export function useOrdersSettings(userId?: string) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [recipeLinks, setRecipeLinks] = useState<Record<string, string>>({});
  const [categoryConfig, setCategoryConfig] = useState<{
    items: Record<string, { color: string; order: number }>;
    itemMapping: Record<string, string>;
  } | null>(null);

  // טעינת settings מ-Firestore
  useEffect(() => {
    if (!userId) return;

    const settingsDoc = doc(db, 'orderSettings', 'main');
    const unsub = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMapping(data.mapping || {});
        setIgnored(data.ignored || []);
      }
    });

    return unsub;
  }, [userId]);

  // טעינת categories
  useEffect(() => {
    if (!userId) return;

    const categoryDoc = doc(db, 'orderSettings', 'categoryConfig');
    const unsub = onSnapshot(categoryDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCategoryConfig({
          items: data.items || {},
          itemMapping: data.itemMapping || {},
        });
      }
    });

    return unsub;
  }, [userId]);

  // טעינת recipe links
  useEffect(() => {
    if (!userId) return;

    const recipeDoc = doc(db, 'orderSettings', 'recipeLinks');
    const unsub = onSnapshot(recipeDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRecipeLinks(data.links || {});
      } else {
        setRecipeLinks({});
      }
    });

    return unsub;
  }, [userId]);

  // פונקציות עדכון
  const updateMapping = async (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    await setDoc(doc(db, 'orderSettings', 'main'), { mapping: newMapping }, { merge: true });
  };

  const updateIgnored = async (newIgnored: string[]) => {
    setIgnored(newIgnored);
    await setDoc(doc(db, 'orderSettings', 'main'), { ignored: newIgnored }, { merge: true });
  };

  const updateCategoryConfig = async (newConfig: any) => {
    setCategoryConfig(newConfig);
    await setDoc(doc(db, 'orderSettings', 'categoryConfig'), newConfig);
  };

  const updateRecipeLinks = async (newLinks: Record<string, string>) => {
    setRecipeLinks(newLinks);
    await setDoc(doc(db, 'orderSettings', 'recipeLinks'), { links: newLinks });
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