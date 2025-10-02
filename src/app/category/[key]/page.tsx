"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, ensureAnonAuth } from "../../../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import HomeButton from "../../../components/HomeButton";

type Recipe = {
  id: string;
  title: string;
  category: string;
  imageDataUrl?: string | null;
};

export default function CategoryPage() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    let unsub: any;
    (async () => {
      await ensureAnonAuth();
      const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qCol, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
        setRecipes(list);
      });
    })();
    return () => unsub && unsub();
  }, []);

  const list = useMemo(() => {
    const k = decodeURIComponent(key).toLowerCase();
    return recipes.filter((r) => (r.category || "").trim().toLowerCase() === k);
  }, [recipes, key]);

  const title = useMemo(() => decodeURIComponent(key), [key]);

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl" lang="he">
      <HomeButton />
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="text-sm underline">⬅ חזרה</button>
        <h1 className="text-2xl font-extrabold">קטגוריה: {title}</h1>
        <div />
      </div>

      {list.length === 0 ? (
        <div className="text-gray-600">אין מתכונים בקטגוריה הזאת (עדיין).</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {list.map((r) => (
            <article key={r.id} className="bg-white rounded-2xl shadow overflow-hidden border">
              {r.imageDataUrl && (
                <div className="w-full h-40 bg-neutral-100 overflow-hidden">
                  <img src={r.imageDataUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="font-bold">{r.title}</div>
                <button onClick={() => router.push(`/recipes/${r.id}`)}
                        className="mt-2 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">
                  פתח
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
