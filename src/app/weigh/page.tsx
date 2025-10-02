"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db, ensureAnonAuth } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/** המרה של כמויות + הכפלה לתצוגה */
const VULGAR: Record<string, number> = { "¼":0.25,"½":0.5,"¾":0.75,"⅓":1/3,"⅔":2/3,"⅛":0.125,"⅜":0.375,"⅝":0.625,"⅞":0.875 };
function parseQtyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let total = 0, used = false;
  for (const ch of Object.keys(VULGAR)) if (s.includes(ch)) { total += VULGAR[ch]; s = s.replaceAll(ch, " "); used = true; }
  for (const t of s.split(/\s+/).filter(Boolean)) {
    if (/^\d+\/\d+$/.test(t)) { const [a,b]=t.split("/").map(Number); if (b) { total += a/b; used = true; continue; } }
    const num = Number(t.replace(",", ".")); if (!Number.isNaN(num)) { total += num; used = true; continue; }
    return null;
  }
  return used ? total : null;
}
function fmtQty(n: number) { return Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(Math.round(n*100)/100); }
function lineWithScale(it: { name?: string; qty?: string; unit?: string }, scale: number) {
  const n = parseQtyToNumber(it.qty);
  const showQty = n == null ? (it.qty || "") : fmtQty(n * scale);
  return [it.name, [showQty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
}

export default function WeighPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const ids = useMemo(() => (sp.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean), [sp]);

  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const snaps = await Promise.all(ids.map(id => getDoc(doc(db, "recipes", id))));
      const data = snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...(s.data() as any) }));
      setRecipes(data);
      setLoading(false);
    })();
  }, [ids]);

  // scale + checked לכל מתכון
  const [scales, setScales] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, Record<string, boolean>>>({});
  useEffect(() => {
    const s: Record<string, number> = {};
    const c: Record<string, Record<string, boolean>> = {};
    recipes.forEach(r => {
      s[r.id] = 1;
      const map: Record<string, boolean> = {};
      (r.ingredients || []).forEach((g: any) => (g.items || []).forEach((it: any) => map[it.id] = false));
      c[r.id] = map;
    });
    setScales(s);
    setChecked(c);
  }, [recipes.length]);

  function toggle(recipeId: string, itemId: string) {
    setChecked(m => ({ ...m, [recipeId]: { ...m[recipeId], [itemId]: !m[recipeId]?.[itemId] } }));
  }

  if (!ids.length) {
    return (
      <div className="max-w-6xl mx-auto p-4" dir="rtl" lang="he">
        <button onClick={() => router.push("/")} className="px-3 py-2 rounded-xl border bg-white mb-4">⬅ חזרה</button>
        לא נבחרו מתכונים. חזרו לדף הבית ובחרו מתכונים למצב שקילה.
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4" dir="rtl" lang="he">
      <div className="mb-4 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="px-3 py-2 rounded-xl border bg-white">⬅ חזרה</button>
          <div className="text-sm text-gray-600">מצב שקילה — {ids.length} מתכונים</div>
        </div>
        <button onClick={() => router.push("/")} className="px-3 py-2 rounded-xl bg-pink-500 text-white">למסך הבית</button>
      </div>

      {loading ? (
        <div>טוען…</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
          {recipes.map((r) => {
            const scale = scales[r.id] ?? 1;
            const cMap = checked[r.id] ?? {};
            const total = Object.keys(cMap).length;
            const done = Object.values(cMap).filter(Boolean).length;
            return (
              <section key={r.id} className="bg-white rounded-2xl shadow p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold truncate" title={r.title}>{r.title}</h2>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-gray-600">כפול</span>
                    <input
                      type="number" step={0.25} min={0.1} dir="ltr" value={scale}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setScales((m) => ({ ...m, [r.id]: !Number.isFinite(v) || v <= 0 ? 1 : v }));
                      }}
                      className="w-16 rounded-lg border bg-white px-2 py-1 text-left"
                    />
                  </div>
                </div>
                {r.category && <div className="text-xs text-gray-500 mt-0.5">{r.category}</div>}
                <div className="text-xs text-gray-500 mt-0.5">{done}/{total} סומנו</div>

                <div className="mt-2 space-y-3">
                  {(r.ingredients || []).map((g: any, gi: number) => (
                    <div key={gi}>
                      {g.groupName && <div className="font-semibold mb-1">{g.groupName}</div>}
                      <ul className="space-y-1">
                        {(g.items || []).map((it: any) => {
                          const line = lineWithScale(it, scale);
                          const checkedNow = !!cMap[it.id];
                          return (
                            <li key={it.id}>
                              <label className="flex items-center gap-2 p-1 rounded-md hover:bg-pink-50 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={checkedNow}
                                  onChange={() => toggle(r.id, it.id)}
                                  className="h-5 w-5 accent-pink-500"
                                />
                                <span className={checkedNow ? "line-through text-gray-400" : ""}>{line}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
