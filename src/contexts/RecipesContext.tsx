"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, ensureAnonAuth } from "@/lib/firebase";

export type RecipeDoc = {
  id: string;
  title?: string;
  category?: string | null;
  note?: string | null;
  imageDataUrl?: string | null;
  ingredients?: Array<{ id?: string; groupName?: string; items?: Array<{ id?: string; name?: string; qty?: string; unit?: string | null }> }>;
  steps?: Array<{ id?: string; text?: string }>;
  createdAt?: any;
};

export type CategoryDoc = {
  id: string;
  key?: string;
  name?: string | null;
  imageDataUrl?: string | null;
  color?: string | null;
  order?: number | null;
  active?: boolean | null;
};

type RecipesContextValue = {
  recipes: RecipeDoc[];
  catsDocs: CategoryDoc[];
  recipesLoading: boolean;
  recipesError: string | null;
};

const RecipesContext = createContext<RecipesContextValue>({
  recipes: [],
  catsDocs: [],
  recipesLoading: true,
  recipesError: null,
});

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<RecipeDoc[]>([]);
  const [catsDocs, setCatsDocs] = useState<CategoryDoc[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesError, setRecipesError] = useState<string | null>(null);

  useEffect(() => {
    let unsubRecipes: (() => void) | undefined;
    let unsubCats: (() => void) | undefined;

    (async () => {
      try {
        await ensureAnonAuth();
      } catch { /* proceed anyway */ }

      unsubRecipes = onSnapshot(
        query(collection(db, "recipes"), orderBy("createdAt", "desc")),
        (snap) => {
          setRecipes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
          setRecipesLoading(false);
        },
        (err) => {
          console.error("recipes onSnapshot error:", err);
          setRecipesError("שגיאה בטעינת מתכונים. בדוק חיבור לאינטרנט.");
          setRecipesLoading(false);
        }
      );

      unsubCats = onSnapshot(
        query(collection(db, "categories")),
        (snap) => {
          setCatsDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        },
        (err) => {
          console.error("categories onSnapshot error:", err);
        }
      );
    })();

    return () => {
      unsubRecipes?.();
      unsubCats?.();
    };
  }, []);

  return (
    <RecipesContext.Provider value={{ recipes, catsDocs, recipesLoading, recipesError }}>
      {children}
    </RecipesContext.Provider>
  );
}

export function useRecipesContext() {
  return useContext(RecipesContext);
}
