import { useState, useEffect } from "react";
import { db, ensureAnonAuth } from "@/lib/firebase";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import type { Recipe } from "../utils/types";

/**
 * Hook to load and manage recipes
 */
export function useRecipes(initialIds: string[]) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [currentIds, setCurrentIds] = useState<string[]>(initialIds);
  const [loading, setLoading] = useState(true);
  
  // Load initial recipes
  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const arr: Recipe[] = [];
      for (const id of initialIds) {
        const snap = await getDoc(doc(db, "recipes", id));
        if (snap.exists()) arr.push({ id, ...(snap.data() as any) });
      }
      setRecipes(arr);
      setLoading(false);
    })();
  }, [initialIds.join(",")]);

  const addMultipleRecipes = async (ids: string[]) => {
    const newRecipes: Recipe[] = [];
    const newIds: string[] = [];
    
    for (const id of ids) {
      if (!currentIds.includes(id)) {
        const snap = await getDoc(doc(db, "recipes", id));
        if (snap.exists()) {
          newRecipes.push({ id, ...(snap.data() as any) });
          newIds.push(id);
        }
      }
    }
    
    if (newRecipes.length > 0) {
      setRecipes(prev => [...prev, ...newRecipes]);
      setCurrentIds(prev => [...prev, ...newIds]);
    }
  };

  const removeRecipe = (id: string) => {
    setCurrentIds(currentIds.filter(rid => rid !== id));
    setRecipes(recipes.filter(r => r.id !== id));
  };

  return {
    recipes,
    currentIds,
    setCurrentIds,
    loading,
    addMultipleRecipes,
    removeRecipe,
  };
}

/**
 * Hook to load all available recipes for the picker
 */
export function useAllRecipes() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    let unsub: any;
    (async () => {
      await ensureAnonAuth();
      const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qCol, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
        setAllRecipes(list);
      });
    })();
    return () => unsub && unsub();
  }, []);

  return allRecipes;
}