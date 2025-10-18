"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";

import { useIngredientDict } from "@/hooks/useIngredientDict";
import { useCategoryDict } from "@/hooks/useCategoryDict";
import { useUnitDict } from "@/hooks/useUnitDict";

// Components
import Header from "@/components/home/Header";
import SearchBar from "@/components/home/SearchBar";
import RecipeForm from "@/components/home/RecipeForm";
import Categories from "@/components/home/Categories";
import WeighingBar from "@/components/home/WeighingBar";

// Types
type Ingredient = { id: string; name: string; qty: string; unit: string };
type IngredientGroup = { id: string; groupName: string; items: Ingredient[] };
type Step = { id: string; text: string };

type Recipe = {
  id: string;
  title: string;
  category: string;
  note?: string | null;
  imageDataUrl?: string | null;
  ingredients: IngredientGroup[];
  steps: Step[];
  createdAt?: any;
};

type CategoryDoc = {
  id: string;
  key: string;
  name: string;
  imageDataUrl?: string | null;
  color?: string | null;
  order?: number | null;
  active?: boolean | null;
};

export default function HomeContent({
  isManager,
  user,
  displayName,
}: {
  isManager: boolean;
  user: import("firebase/auth").User;
  displayName?: string;
}) {
  const router = useRouter();

  // Dictionaries
  const { names: ingredientDict } = useIngredientDict();
  const { names: categoryDict } = useCategoryDict();
  const { names: unitDict } = useUnitDict();

  // State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [catsDocs, setCatsDocs] = useState<CategoryDoc[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [weighSel, setWeighSel] = useState<Record<string, { title: string }>>({});

  // Load recipes
  useEffect(() => {
    const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
      setRecipes(list);
    });
    return () => unsub();
  }, []);

  // Load categories
  useEffect(() => {
    const qCol = query(collection(db, "categories"));
    const unsub = onSnapshot(qCol, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CategoryDoc[];
      setCatsDocs(list);
    });
    return () => unsub();
  }, []);

  // Process categories
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      let c = (r.category || "").trim();
      if (!c) c = "ללא קטגוריה";
      const key = c.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const map: Record<
      string,
      {
        key: string;
        label: string;
        count: number;
        imageDataUrl?: string | null;
        order?: number | null;
        active?: boolean | null;
      }
    > = {};

    for (const [key, count] of counts.entries()) {
      map[key] = { key, label: key === "ללא קטגוריה" ? "ללא קטגוריה" : key, count };
    }

    for (const cd of catsDocs) {
      const k = (cd.key || cd.name || "").toLowerCase().trim();
      if (!k) continue;
      if (!map[k]) map[k] = { key: k, label: cd.name || k, count: 0 };
      map[k].label = cd.name || map[k].label;
      map[k].imageDataUrl = cd.imageDataUrl ?? map[k].imageDataUrl;
      map[k].order = cd.order ?? map[k].order;
      map[k].active = cd.active ?? true;
    }

    let arr = Object.values(map).filter((x) => x.active !== false);
    arr.sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (b.count || 0) - (a.count || 0);
    });
    arr = arr.filter((c) => c.key !== "ללא קטגוריה");
    return arr;
  }, [recipes, catsDocs]);

  // Search suggestions
  // Search suggestions
const suggestions = useMemo(() => {
  const qq = q.trim().toLowerCase();
  if (!qq) return [];

  return recipes
    .filter((r) => {
      // חיפוש בשם המתכון (עדיפות ראשונה)
      const titleMatch = r.title?.toLowerCase().includes(qq);
      
      // חיפוש בקטגוריה (עדיפות שנייה)
      const categoryMatch = r.category?.toLowerCase().includes(qq);
      
      // חיפוש במצרכים (עדיפות שלישית)
      const ingredientsMatch = r.ingredients?.some((group) =>
        group.items?.some((item) => item.name?.toLowerCase().includes(qq))
      );
      
      return titleMatch || categoryMatch || ingredientsMatch;
    })
    .sort((a, b) => {
      // תעדוף: שם מתכון > קטגוריה > מצרכים
      const aTitle = a.title?.toLowerCase().includes(qq) ? 0 : 1;
      const bTitle = b.title?.toLowerCase().includes(qq) ? 0 : 1;
      
      if (aTitle !== bTitle) return aTitle - bTitle;
      
      const aCat = a.category?.toLowerCase().includes(qq) ? 0 : 1;
      const bCat = b.category?.toLowerCase().includes(qq) ? 0 : 1;
      
      return aCat - bCat;
    })
    .slice(0, 6);
}, [q, recipes]);

  // Weighing selection
  function addToWeigh(id: string, title: string) {
    setWeighSel((m) => ({ ...m, [id]: { title } }));
  }

  function removeFromWeigh(id: string) {
    setWeighSel((m) => {
      const n = { ...m };
      delete n[id];
      return n;
    });
  }

  // Save recipe
  async function handleSaveRecipe(recipe: {
    title: string;
    category: string;
    note: string;
    imageDataUrl?: string;
    groups: IngredientGroup[];
    steps: Step[];
  }) {
    const created = await addDoc(collection(db, "recipes"), {
      title: recipe.title,
      category: recipe.category,
      note: recipe.note || null,
      imageDataUrl: recipe.imageDataUrl || null,
      ingredients: recipe.groups,
      steps: recipe.steps,
      createdAt: serverTimestamp(),
    });

    setShowForm(false);
    setQ("");
    router.push(`/recipes/${created.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50" dir="rtl" lang="he">
      {/* Header */}
      <Header
        displayName={displayName}
        userEmail={user.email || undefined}
        isManager={isManager}
      />

      {/* Search Bar */}
      <SearchBar
        query={q}
        onQueryChange={setQ}
        suggestions={suggestions}
        onAddToWeigh={addToWeigh}
        isManager={isManager}
        onToggleForm={() => {
          setShowForm((v) => !v);
          setQ("");
        }}
      />

      {/* Recipe Form */}
      {isManager && showForm && (
        <RecipeForm
          ingredientDict={ingredientDict}
          categoryDict={categoryDict}
          unitDict={unitDict}
          onSave={handleSaveRecipe}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Categories */}
      <Categories categories={categories} isManager={isManager} />

      {/* Weighing Bar */}
      <WeighingBar
        selectedRecipes={weighSel}
        onRemove={removeFromWeigh}
        onClear={() => setWeighSel({})}
      />
    </div>
  );
}