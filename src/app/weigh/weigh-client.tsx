"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, ensureAnonAuth } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import HomeButton from "../../components/HomeButton";

type Recipe = any;

export default function WeighClient() {
  const params = useSearchParams();
  const router = useRouter();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const list: any[] = [];
      for (const id of ids) {
        const snap = await getDoc(doc(db, "recipes", id));
        if (snap.exists()) list.push({ id, ...(snap.data() as any) });
      }
      setRecipes(list);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  if (ids.length === 0) return <div className="p-6">לא נבחרו מתכונים.</div>;
  if (loading) return <div className="p-6">טוען…</div>;

  return (
    <div className="max-w-full mx-auto p-4" dir="rtl" lang="he">
      <HomeButton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow p-4">
            <div className="text-xl font-bold mb-2">{r.title}</div>

            {(r.ingredients || []).map((g: any, gi: number) => (
              <div key={gi} className="mb-3">
                {g.groupName ? (
                  <div className="font-semibold mb-1">{g.groupName}</div>
                ) : null}
                <ul className="space-y-1">
                  {(g.items || []).map((it: any) => (
                    <li key={it.id} className="flex gap-2">
                      <span className="flex-1">{it.name}</span>
                      <span className="w-20 text-left">{it.qty}</span>
                      <span className="w-12">{it.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
