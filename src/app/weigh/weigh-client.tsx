"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, startTransition, useDeferredValue } from "react";
import { db, ensureAnonAuth } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
    return null; // טקסט חופשי → לא מכפילים
  }
  return used ? total : null;
}
function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/* ===== Colors (בולטים) ===== */
const PALETTE = [
  "#fecaca", "#bfdbfe", "#bbf7d0", "#ddd6fe", "#fde68a",
  "#fca5a5", "#93c5fd", "#86efac", "#c4b5fd", "#fcd34d",
];
const BG_ALPHA   = 0.75;
const BAR_ALPHA  = 1.00;
const OUTL_ALPHA = 0.28;

const norm = (s: string) => (s || "").trim().toLowerCase();
function hexToRgba(hex: string, alpha = 1) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
// אינדקס צבע דטרמיניסטי לפי שם רכיב – אין צורך ב-state
function colorIdxFor(key: string) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) + key.charCodeAt(i);
  return Math.abs(h) % PALETTE.length;
}

/* ===== Focus Drawer ===== */
function FocusDrawer({
  ingredients, selected, toggleKey, clearAll, open, setOpen,
}: {
  ingredients: { key: string; label: string }[];
  selected: Set<string>;
  toggleKey: (key: string) => void;
  clearAll: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const disabled = selected.size === 0;

  return (
    <>
      {/* hot-zone לפתיחה בהובר (דסקטופ) */}
      <div className="fixed inset-x-0 bottom-0 h-4 z-[60] hidden md:block" onPointerEnter={() => setOpen(true)} />
      {/* ידית פתיחה למובייל/טאץ' */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-1/2 -translate-x-1/2 bottom-3 z-[61] px-3 h-8 rounded-full border bg-white shadow"
          title="מיקוד"
        >
          מיקוד ▴
        </button>
      )}

      {/* המגירה (ללא backdrop-blur לשיפור ביצועים) */}
      <div
        className="fixed inset-x-3 bottom-3 z-[62] transition-transform duration-200"
        style={{ transform: open ? "translateY(0)" : "translateY(calc(100% + 16px))" }}
      >
        <div className="rounded-2xl border bg-white shadow-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* נקה הכול */}
            <button
              onClick={clearAll}
              disabled={disabled}
              className={`mr-auto h-9 px-3 rounded-xl border text-sm ${
                disabled ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                         : "bg-white hover:bg-neutral-100"
              }`}
              title="נקה הכול"
            >
              נקה הכול
            </button>

            {/* רכיבים (toggle) */}
            <div className="flex items-center gap-2 flex-wrap max-h-40 overflow-auto">
              {ingredients.map(({ key, label }) => {
                const isOn = selected.has(key);
                const idx = colorIdxFor(key);
                const bg = isOn ? hexToRgba(PALETTE[idx], BG_ALPHA) : "white";
                const fg = isOn ? "#222" : "#111";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleKey(key)}
                    className="h-9 px-3 rounded-full border text-sm shadow-sm active:scale-95"
                    style={{ backgroundColor: bg, color: fg, borderColor: isOn ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.08)" }}
                    title={label}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: isOn ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.2)" }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* סגור */}
            <button
              onClick={() => setOpen(false)}
              className="ml-2 h-9 w-9 grid place-items-center rounded-xl border bg-white hover:bg-neutral-100"
              aria-label="סגור מיקוד"
              title="סגור"
            >
              ▾
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function WeighClient() {
  const sp = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").filter(Boolean);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  /* === scale per recipe === */
  const [scales, setScales] = useState<Record<string, number>>({});
  const getScale = (id: string) => scales[id] ?? 1;
  const setScaleFor = (id: string, v: number) =>
    setScales(s => ({ ...s, [id]: !Number.isFinite(v) || v < 0 ? 1 : v }));

  /* === Focus mode (סט יעיל) === */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deferredSelected = useDeferredValue(selected); // מרכך רצף לחיצות
  const toggleKey = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const clearAll = () => startTransition(() => setSelected(new Set()));
  const [focusOpen, setFocusOpen] = useState(false);

  /* === איחוד רכיבים מכל המתכונים (פעם אחת לכל שינוי מתכונים) === */
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

  /* === בסיס כמות פר־שורה (מוחשב פעם אחת; לא תלוי בבחירה) === */
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const arr: Recipe[] = [];
      for (const id of ids) {
        const snap = await getDoc(doc(db, "recipes", id));
        if (snap.exists()) arr.push({ id, ...(snap.data() as any) });
      }
      setRecipes(arr);
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
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xl font-bold truncate">{r.title}</div>
              <ScaleControl value={getScale(r.id)} onChange={(v) => setScaleFor(r.id, v)} />
            </div>

            {(r.ingredients || []).map((g: any, gi: number) => (
              <div key={gi} className="mb-3">
                {g.groupName ? <div className="font-semibold mb-1">{g.groupName}</div> : null}
                <ul className="space-y-1">
                  {(g.items || []).map((it: any) => {
                    const k = norm(it.name);
                    const raw = baseQty.get(it.id);
                    const showQty = raw == null ? (it.qty || "") : formatQty(raw * getScale(r.id));

                    const on  = deferredSelected.has(k);
                    const idx = colorIdxFor(k);
                    const col = on ? {
                      bg:  hexToRgba(PALETTE[idx], BG_ALPHA),
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

      {/* מגירת מיקוד */}
      <FocusDrawer
        ingredients={allIngredients}
        selected={selected}
        toggleKey={toggleKey}
        clearAll={clearAll}
        open={focusOpen}
        setOpen={setFocusOpen}
      />
    </div>
  );
}
