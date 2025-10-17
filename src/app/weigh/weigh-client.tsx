"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, startTransition, useDeferredValue } from "react";
import { db, ensureAnonAuth } from "../../lib/firebase";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import HomeButton from "../../components/HomeButton";
import ScaleControl from "../../components/ScaleControl";

/* ===== Types ===== */
type Recipe = any;

/* ===== Qty helpers ===== */
const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};
function parseQtyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let total = 0, used = false;
  for (const ch of Object.keys(VULGAR)) if (s.includes(ch)) { total += VULGAR[ch]; s = s.replaceAll(ch, " "); used = true; }
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    if (/^\d+\/\d+$/.test(tok)) { const [a,b]=tok.split("/").map(Number); if (b) { total += a/b; used = true; continue; } }
    const num = Number(tok.replace(",", "."));
    if (!Number.isNaN(num)) { total += num; used = true; continue; }
    return null;
  }
  return used ? total : null;
}
function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/* ===== Colors ===== */
const PALETTE = [
  "#fecaca", "#bfdbfe", "#bbf7d0", "#ddd6fe", "#fde68a",
  "#fca5a5", "#93c5fd", "#86efac", "#c4b5fd", "#fcd34d",
];
const BG_ALPHA = 0.75;
const BAR_ALPHA = 1.00;
const OUTL_ALPHA = 0.28;

const norm = (s: string) => (s || "").trim().toLowerCase();
function hexToRgba(hex: string, alpha = 1) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function colorIdxFor(key: string) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) + key.charCodeAt(i);
  return Math.abs(h) % PALETTE.length;
}

/* ===== Focus Drawer with Search ===== */
function FocusDrawer({
  ingredients,
  selected,
  toggleKey,
  clearAll,
  open,
  setOpen,
}: {
  ingredients: { key: string; label: string }[];
  selected: Set<string>;
  toggleKey: (key: string) => void;
  clearAll: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const disabled = selected.size === 0;

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return ingredients
      .filter(ing => ing.label.toLowerCase().includes(term))
      .slice(0, 3);
  }, [ingredients, searchTerm]);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 h-4 z-[60] hidden md:block" onPointerEnter={() => setOpen(true)} />
      
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-1/2 -translate-x-1/2 bottom-3 z-[61] px-3 h-8 rounded-full border bg-white shadow"
          title="מיקוד"
        >
          מיקוד ▴
        </button>
      )}

      <div
        className="fixed inset-x-3 bottom-3 z-[62] transition-transform duration-200"
        style={{ transform: open ? "translateY(0)" : "translateY(calc(100% + 16px))" }}
      >
        <div className="rounded-2xl border bg-white shadow-xl p-3 max-h-[60vh] overflow-auto">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="חפש רכיב למיקוד..."
              className="flex-1 h-9 px-3 rounded-xl border bg-white text-sm"
              autoFocus={open}
            />

            <button
              onClick={clearAll}
              disabled={disabled}
              className={`h-9 px-3 rounded-xl border text-sm ${
                disabled ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                         : "bg-white hover:bg-neutral-100"
              }`}
              title="נקה הכול"
            >
              נקה הכול
            </button>

            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 grid place-items-center rounded-xl border bg-white hover:bg-neutral-100"
              aria-label="סגור מיקוד"
              title="סגור"
            >
              ▾
            </button>
          </div>

          <div className="space-y-1">
            {searchTerm.trim() === "" ? (
              <div className="text-center text-neutral-400 py-4">הקלד כדי לחפש רכיב למיקוד</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-neutral-400 py-4">לא נמצאו רכיבים</div>
            ) : (
              filtered.map(({ key, label }) => {
                const isOn = selected.has(key);
                const idx = colorIdxFor(key);
                const bg = isOn ? hexToRgba(PALETTE[idx], BG_ALPHA) : "white";
                const fg = isOn ? "#222" : "#111";
                const dotColor = hexToRgba(PALETTE[idx], BAR_ALPHA);

                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-neutral-50"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggleKey(key)}
                      className="w-4 h-4"
                    />
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="flex-1">{label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Recipe Picker Modal ===== */
function RecipePicker({
  allRecipes,
  currentIds,
  onAddMultiple,
  onClose,
}: {
  allRecipes: Recipe[];
  currentIds: string[];
  onAddMultiple: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const available = useMemo(() => {
    return allRecipes
      .filter(r => !currentIds.includes(r.id))
      .filter(r => !search || r.title?.toLowerCase().includes(search.toLowerCase()));
  }, [allRecipes, currentIds, search]);

  const toggleRecipe = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    await onAddMultiple(Array.from(selectedIds));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">הוסף מתכונים</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-neutral-100">✕</button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש מתכון..."
            className="w-full h-10 px-3 rounded-lg border mb-2"
            autoFocus
          />
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={addSelected}
                className="flex-1 px-4 py-2 rounded-lg bg-pink-500 text-white font-bold hover:bg-pink-600"
              >
                הוסף {selectedIds.size} מתכונים
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 rounded-lg border hover:bg-neutral-50"
              >
                נקה
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 space-y-2">
          {available.length === 0 ? (
            <div className="text-center text-neutral-400 py-8">לא נמצאו מתכונים זמינים</div>
          ) : (
            available.map(r => {
              const isSelected = selectedIds.has(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'bg-pink-50 border-pink-300' : 'bg-white hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecipe(r.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1 text-right">
                    <div className="font-bold">{r.title}</div>
                    {r.category && <div className="text-sm text-neutral-500">{r.category}</div>}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Main Component ===== */
export default function WeighClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialIds = (sp.get("ids") || "").split(",").filter(Boolean);

  const [currentIds, setCurrentIds] = useState<string[]>(initialIds);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allRecipesForPicker, setAllRecipesForPicker] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const [scales, setScales] = useState<Record<string, number>>({});
  const getScale = (id: string) => scales[id] ?? 1;
  const setScaleFor = (id: string, v: number) =>
    setScales(s => ({ ...s, [id]: !Number.isFinite(v) || v < 0 ? 1 : v }));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deferredSelected = useDeferredValue(selected);
  const toggleKey = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const clearAll = () => startTransition(() => setSelected(new Set()));
  const [focusOpen, setFocusOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'per-recipe' | 'summary'>('per-recipe');

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

  useEffect(() => {
    let unsub: any;
    (async () => {
      await ensureAnonAuth();
      const qCol = query(collection(db, "recipes"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(qCol, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Recipe[];
        setAllRecipesForPicker(list);
      });
    })();
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (currentIds.length > 0) {
      router.replace(`/weigh?ids=${currentIds.join(",")}`, { scroll: false });
    }
  }, [currentIds, router]);

  const allIngredients = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes) {
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          const k = norm(it.name);
          if (!k) continue;
          if (!map.has(k)) map.set(k, it.name || k);
        }
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "he"));
  }, [recipes]);

  const aggregatedIngredients = useMemo(() => {
    const aggregateMap = new Map<string, { name: string; totalQty: number; unit: string; sources: string[] }>();
    
    for (const r of recipes) {
      const scale = getScale(r.id);
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          const k = norm(it.name);
          if (!k) continue;
          
          const qty = parseQtyToNumber(it.qty);
          if (qty === null) continue;
          
          const scaledQty = qty * scale;
          
          if (aggregateMap.has(k)) {
            const existing = aggregateMap.get(k)!;
            existing.totalQty += scaledQty;
            if (!existing.sources.includes(r.title)) {
              existing.sources.push(r.title);
            }
          } else {
            aggregateMap.set(k, {
              name: it.name,
              totalQty: scaledQty,
              unit: it.unit || '',
              sources: [r.title]
            });
          }
        }
      }
    }
    
    return Array.from(aggregateMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [recipes, scales]);

  const baseQty = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of recipes) {
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          m.set(it.id, parseQtyToNumber(it.qty));
        }
      }
    }
    return m;
  }, [recipes]);

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

  if (currentIds.length === 0) {
    return (
      <div className="p-6" dir="rtl" lang="he">
        <HomeButton />
        <div className="text-center py-12">
          <div className="text-xl mb-4">לא נבחרו מתכונים</div>
          <button
            onClick={() => setShowPicker(true)}
            className="px-6 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600"
          >
            הוסף מתכונים
          </button>
        </div>
        {showPicker && (
          <RecipePicker
            allRecipes={allRecipesForPicker}
            currentIds={currentIds}
            onAddMultiple={addMultipleRecipes}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  if (loading) return <div className="p-6">טוען…</div>;

  return (
    <div className="max-w-full mx-auto p-4 pb-24" dir="rtl" lang="he">
      <div className="relative flex justify-center items-center mb-4">
  <div className="absolute right-0">
    <HomeButton />
  </div>
  
  <div className="inline-flex rounded-xl border bg-white p-1">
    <button
      onClick={() => setViewMode('per-recipe')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        viewMode === 'per-recipe' 
          ? 'bg-pink-500 text-white' 
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      פר מתכון
    </button>
    <button
      onClick={() => setViewMode('summary')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        viewMode === 'summary' 
          ? 'bg-pink-500 text-white' 
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      סיכום כללי
    </button>
  </div>

  <div className="absolute left-15">
    <button
      onClick={() => setShowPicker(true)}
      className="px-4 py-2 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600"
    >
      + הוסף מתכון
    </button>
  </div>
</div>

      {viewMode === 'per-recipe' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{recipes.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow p-4 relative">
            <button
              onClick={() => removeRecipe(r.id)}
              className="absolute top-1 right-1 w-4 h-4 rounded-lg bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
              title="הסר מתכון"
            >
              ✕
            </button>

            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xl font-bold truncate">{r.title}</div>
              <ScaleControl value={getScale(r.id)} onChange={(v: number) => setScaleFor(r.id, v)} />
            </div>

            {(r.ingredients || []).map((g: any, gi: number) => (
              <div key={gi} className="mb-3">
                {g.groupName ? <div className="font-semibold mb-1">{g.groupName}</div> : null}
                <ul className="space-y-1">
                  {(g.items || []).map((it: any) => {
                    const k = norm(it.name);
                    const raw = baseQty.get(it.id);
                    const showQty = raw == null ? (it.qty || "") : formatQty(raw * getScale(r.id));

                    const on = deferredSelected.has(k);
                    const idx = colorIdxFor(k);
                    const col = on ? {
                      bg: hexToRgba(PALETTE[idx], BG_ALPHA),
                      bar: hexToRgba(PALETTE[idx], BAR_ALPHA),
                      outline: `rgba(0,0,0,${OUTL_ALPHA})`,
                    } : null;

                    return (
                      <li
                        key={it.id}
                        className="flex gap-2 rounded-md transition-colors"
                        style={on ? {
                          backgroundColor: col!.bg,
                          boxShadow: `inset 4px 0 0 0 ${col!.bar}`,
                          outline: `1px solid ${col!.outline}`,
                        } : undefined}
                      >
                        <span className="flex-1 px-1 py-1">{it.name}</span>
                        <span className="w-20 text-left px-1 py-1">{showQty}</span>
                        <span className="w-12 px-1 py-1">{it.unit}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-2xl font-bold mb-4">סיכום חומרי גלם</h2>
            <div className="space-y-2">
              {aggregatedIngredients.map((item, idx) => {
                const k = norm(item.name);
                const on = deferredSelected.has(k);
                const colorIdx = colorIdxFor(k);
                const col = on ? {
                  bg: hexToRgba(PALETTE[colorIdx], BG_ALPHA),
                  bar: hexToRgba(PALETTE[colorIdx], BAR_ALPHA),
                  outline: `rgba(0,0,0,${OUTL_ALPHA})`,
                } : null;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                    style={on ? {
                      backgroundColor: col!.bg,
                      boxShadow: `inset 4px 0 0 0 ${col!.bar}`,
                      outline: `1px solid ${col!.outline}`,
                    } : { backgroundColor: '#f9fafb' }}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        מתכונים: {item.sources.join(', ')}
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-lg">{formatQty(item.totalQty)}</span>
                      <span className="text-sm text-gray-600 mr-1">{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <FocusDrawer
        ingredients={allIngredients}
        selected={selected}
        toggleKey={toggleKey}
        clearAll={clearAll}
        open={focusOpen}
        setOpen={setFocusOpen}
      />

      {showPicker && (
        <RecipePicker
          allRecipes={allRecipesForPicker}
          currentIds={currentIds}
          onAddMultiple={addMultipleRecipes}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}