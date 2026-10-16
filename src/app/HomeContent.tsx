"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { uploadToStorage } from "@/utils/storageUpload";

import { useRecipesContext } from "@/contexts/RecipesContext";
import { useIngredientDict } from "@/hooks/useIngredientDict";
import { useCategoryDict } from "@/hooks/useCategoryDict";
import { useUnitDict } from "@/hooks/useUnitDict";
import { invalidateRecipesCache } from "@/hooks/useShoppingList";

// Components
import Header from "@/components/home/Header";
import SearchBar from "@/components/home/SearchBar";
import RecipeForm from "@/components/home/RecipeForm";
import Categories from "@/components/home/Categories";
import CategoryCardSkeleton from "@/components/home/CategoryCardSkeleton";
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
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  ingredients: IngredientGroup[];
  steps: Step[];
  createdAt?: any;
};

type CategoryDoc = {
  id: string;
  key: string;
  name: string;
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  color?: string | null;
  order?: number | null;
  active?: boolean | null;
};

export default function HomeContent({
  isManager,
  canAccessShoppingList,
  canAddOrEditRecipes,
  canAccessCourier,
  user,
  displayName,
}: {
  isManager: boolean;
  canAccessShoppingList: boolean;
  canAddOrEditRecipes: boolean;
  canAccessCourier?: boolean;
  user: import("firebase/auth").User;
  displayName?: string;
}) {
  const router = useRouter();

  // Dictionaries
  const { names: ingredientDict } = useIngredientDict();
  const { names: categoryDict } = useCategoryDict();
  const { names: unitDict } = useUnitDict();

  // Shared recipes + categories from context (single listeners)
  const { recipes: rawRecipes, catsDocs: rawCatsDocs, recipesLoading, recipesError } = useRecipesContext();
  const recipes = rawRecipes as Recipe[];
  const catsDocs = rawCatsDocs as CategoryDoc[];

  // State
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [weighSel, setWeighSel] = useState<Record<string, { title: string }>>({});

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
        imageUrl?: string | null;
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
      map[k].imageUrl = cd.imageUrl ?? map[k].imageUrl;
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
      imageUrl: null,
      ingredients: recipe.groups,
      steps: recipe.steps,
      createdAt: serverTimestamp(),
    });

    if (recipe.imageDataUrl) {
      try {
        const imageUrl = await uploadToStorage(
          recipe.imageDataUrl,
          `recipes/${created.id}.webp`
        );
        await updateDoc(doc(db, "recipes", created.id), { imageUrl });
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }

    // 🚀 ניקוי cache של מתכונים כדי שרשימת הקניות תראה את המתכון החדש
    invalidateRecipesCache();
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
        canAccessShoppingList={canAccessShoppingList}
        canAccessCourier={canAccessCourier}
      />

      {/* Search Bar */}
      <SearchBar
        query={q}
        onQueryChange={setQ}
        suggestions={suggestions}
        onAddToWeigh={addToWeigh}
        isManager={isManager}
        canAddRecipes={canAddOrEditRecipes}
        onToggleForm={() => {
          setShowForm((v) => !v);
          setQ("");
        }}
      />

      {/* Recipe Form */}
      {canAddOrEditRecipes && showForm && (
        <RecipeForm
          ingredientDict={ingredientDict}
          categoryDict={categoryDict}
          unitDict={unitDict}
          onSave={handleSaveRecipe}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Categories — loading / error / data */}
      {recipesError ? (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <div>{recipesError}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs underline text-red-500"
          >
            נסה שוב
          </button>
        </div>
      ) : recipesLoading ? (
        <div className="px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="h-8 w-28 rounded-full skeleton-shimmer mb-8" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Categories categories={categories} isManager={isManager} />
      )}

      {/* Weighing Bar */}
      <WeighingBar
        selectedRecipes={weighSel}
        onRemove={removeFromWeigh}
        onClear={() => setWeighSel({})}
      />
    </div>
  );
}