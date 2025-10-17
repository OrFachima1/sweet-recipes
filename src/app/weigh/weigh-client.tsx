"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef, startTransition, useDeferredValue } from "react";
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

/* ===== Hook: Keep Awake ===== */
function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let wakeLock: any = null;
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch (e) {
        console.warn("Wake Lock failed", e);
      }
    })();
    return () => {
      wakeLock?.release?.();
    };
  }, [enabled]);
}

/* ===== Confetti Component ===== */
function ConfettiCelebration({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: any[] = [];
    const colors = ["#ff6b9d", "#c44569", "#f8b500", "#4834df", "#ff6348"];
    
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let raf: number;
    const startTime = Date.now();
    const duration = 3000;

    function tick() {
      if (!canvas || !ctx) return;
      
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        onDone();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-6xl md:text-8xl animate-bounce">🎉</div>
      </div>
    </div>
  );
}

/* ===== Focus Mode Component ===== */
function FocusMode({
  ingredient,
  index,
  total,
  weighed,
  onToggleWeighed,
  onNavigate,
  onClose,
}: {
  ingredient: any;
  index: number;
  total: number;
  weighed: Set<string>;
  onToggleWeighed: (name: string) => void;
  onNavigate: (direction: number) => void;
  onClose: () => void;
}) {
  const isWeighed = weighed.has(ingredient.name);
  const progress = total > 0 ? (weighed.size / total) * 100 : 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNavigate(-1);
      else if (e.key === "ArrowLeft") onNavigate(1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        onToggleWeighed(ingredient.name);
      }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [ingredient.name, onNavigate, onToggleWeighed, onClose]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-50 to-purple-50 flex flex-col z-[80]" dir="rtl">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border hover:bg-gray-50 text-sm font-medium"
          >
            ← חזרה לסיכום
          </button>
          <div className="text-sm font-medium text-gray-600">
            {index + 1} מתוך {total}
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Ingredient Card */}
          <div className={`bg-white rounded-3xl shadow-2xl p-8 text-center transition-all duration-300 ${
            isWeighed ? 'ring-4 ring-green-400' : ''
          }`}>
            <div className="mb-6">
              <div className={`text-8xl transition-all duration-300 ${
                isWeighed ? 'grayscale-0' : 'grayscale'
              }`}>
                ⚖️
              </div>
            </div>

            <h2 className="text-5xl font-bold mb-6 text-gray-800">
              {ingredient.name}
            </h2>

            <div className="mb-8">
              <div className="text-7xl font-black text-pink-600 mb-2">
                {formatQty(ingredient.totalQty)}
              </div>
              <div className="text-3xl text-gray-600">
                {ingredient.unit}
              </div>
            </div>

            {/* Recipe breakdown */}
            <div className="mb-8 space-y-2">
              <div className="text-sm font-semibold text-gray-500 mb-3">פירוט לפי מתכונים:</div>
              {ingredient.items?.map((item: any, idx: number) => {
                const colorIdx = colorIdxFor(item.recipeTitle);
                const bgColor = hexToRgba(PALETTE[colorIdx], 0.3);
                return (
                  <div
                    key={idx}
                    className="px-4 py-2 rounded-xl text-base font-medium"
                    style={{ backgroundColor: bgColor }}
                  >
                    <span className="font-bold">{item.recipeTitle}:</span> {formatQty(item.qty)} {item.unit}
                  </div>
                );
              })}
            </div>

            {/* Weighed Button */}
            <button
              onClick={() => {
                onToggleWeighed(ingredient.name);
                setTimeout(() => {
                  if (index < total - 1 && !isWeighed) {
                    onNavigate(1);
                  }
                }, 300);
              }}
              className={`w-full py-6 rounded-2xl text-2xl font-bold transition-all duration-200 ${
                isWeighed
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600'
              }`}
            >
              {isWeighed ? (
                <span className="flex items-center justify-center gap-3">
                  ✓ שקלתי!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  ⚖️ סמן כשקול
                </span>
              )}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => onNavigate(-1)}
              disabled={index === 0}
              className="flex-1 py-4 rounded-2xl bg-white shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-bold text-lg"
            >
              → הקודם
            </button>
            <button
              onClick={() => onNavigate(1)}
              disabled={index === total - 1}
              className="flex-1 py-4 rounded-2xl bg-white shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors font-bold text-lg"
            >
              הבא ←
            </button>
          </div>

          <div className="text-center mt-4 text-sm text-gray-500">
            💡 טיפ: השתמש במקשי החצים או רווח לניווט מהיר
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Focus Drawer (old one - keep for backwards compatibility) ===== */
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

  const [viewMode, setViewMode] = useState<'per-recipe' | 'summary'>('summary');
  
  // Weighed ingredients tracking + localStorage
  const [weighed, setWeighed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('weigh_progress');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleWeighed = (name: string) => {
    setWeighed(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      try {
        localStorage.setItem('weigh_progress', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Focus mode state
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Work mode (keep screen awake)
  const [workMode, setWorkMode] = useState(false);
  useKeepAwake(workMode);

  async function handleWorkModeToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const on = e.target.checked;
    setWorkMode(on);
    if (on) {
      try {
        const mod = await import("nosleep.js");
        const NoSleep = mod.default;
        (window as any).__nosleep ||= new NoSleep();
        (window as any).__nosleep.enable();
      } catch {}
    } else {
      try { (window as any).__nosleep?.disable?.(); } catch {}
    }
  }

  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevWeighedSize, setPrevWeighedSize] = useState(0);

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
    const aggregateMap = new Map<string, { 
      name: string; 
      totalQty: number; 
      unit: string; 
      sources: string[];
      items: any[];
    }>();
    
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
            existing.items.push({
              ...it,
              qty: scaledQty,
              recipeTitle: r.title,
              recipeId: r.id,
            });
          } else {
            aggregateMap.set(k, {
              name: it.name,
              totalQty: scaledQty,
              unit: it.unit || '',
              sources: [r.title],
              items: [{
                ...it,
                qty: scaledQty,
                recipeTitle: r.title,
                recipeId: r.id,
              }]
            });
          }
        }
      }
    }
    
    return Array.from(aggregateMap.values())
      .sort((a, b) => b.totalQty - a.totalQty);
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

  // Check for completion
  useEffect(() => {
    if (aggregatedIngredients.length === 0) return;
    if (weighed.size > prevWeighedSize && weighed.size === aggregatedIngredients.length) {
      setShowConfetti(true);
    }
    setPrevWeighedSize(weighed.size);
  }, [weighed.size, aggregatedIngredients.length]);

  // Check per-recipe completion
  const recipeProgress = useMemo(() => {
    const progress: Record<string, { completed: number; total: number }> = {};
    
    for (const r of recipes) {
      let completed = 0;
      let total = 0;
      
      for (const g of (r.ingredients || [])) {
        for (const it of (g.items || [])) {
          total++;
          if (weighed.has(it.name)) completed++;
        }
      }
      
      progress[r.id] = { completed, total };
    }
    
    return progress;
  }, [recipes, weighed]);

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

  const openFocusMode = (index: number) => {
    setFocusedIndex(index);
    setFocusModeOpen(true);
  };

  const navigateFocus = (direction: number) => {
    const newIndex = focusedIndex + direction;
    if (newIndex >= 0 && newIndex < aggregatedIngredients.length) {
      setFocusedIndex(newIndex);
    }
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

  // Focus Mode
  if (focusModeOpen && aggregatedIngredients[focusedIndex]) {
    return (
      <FocusMode
        ingredient={aggregatedIngredients[focusedIndex]}
        index={focusedIndex}
        total={aggregatedIngredients.length}
        weighed={weighed}
        onToggleWeighed={toggleWeighed}
        onNavigate={navigateFocus}
        onClose={() => setFocusModeOpen(false)}
      />
    );
  }

  const progress = aggregatedIngredients.length > 0 
    ? (weighed.size / aggregatedIngredients.length) * 100 
    : 0;

  return (
    <div className="max-w-full mx-auto p-4 pb-24" dir="rtl" lang="he">
      {showConfetti && <ConfettiCelebration onDone={() => setShowConfetti(false)} />}
      
      <div className="relative flex justify-between items-center mb-4 gap-4">
        <HomeButton />

        {/* Work Mode Toggle */}
        <label className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-xl shadow border cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            className="h-4 w-4 accent-pink-500"
            checked={workMode}
            onChange={handleWorkModeToggle}
          />
          <span className="font-medium">מצב עבודה</span>
        </label>
        
        <div className="flex-1 flex justify-center">
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
        </div>

        <button
  onClick={() => setShowPicker(true)}
  className="absolute left-20 px-4 py-2 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 whitespace-nowrap"
>
  + הוסף מתכון
</button>
      </div>

      {viewMode === 'per-recipe' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{recipes.map((r) => {
          const recipeColorIdx = Math.abs(r.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % PALETTE.length;
          const recipeColor = PALETTE[recipeColorIdx];
          const { completed, total } = recipeProgress[r.id] || { completed: 0, total: 0 };
          const recipeProgressPercent = total > 0 ? (completed / total) * 100 : 0;
          
          return (
            <div 
              key={r.id} 
              className="bg-white rounded-2xl shadow-lg overflow-hidden"
              style={{ borderTop: `6px solid ${recipeColor}` }}
            >
              <div className="p-4 relative">
                <button
                  onClick={() => removeRecipe(r.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-red-500 text-white hover:bg-red-600 text-xs font-bold flex items-center justify-center z-10"
                  title="הסר מתכון"
                >
                  ✕
                </button>

                <div className="flex items-center justify-between gap-3 mb-2 mt-2">
                  <button
                    onClick={() => router.push(`/recipes/${r.id}`)}
                    className="text-xl font-bold truncate hover:underline cursor-pointer text-right flex-1"
                    title="עבור למתכון"
                  >
                    {r.title}
                  </button>
                  <ScaleControl value={getScale(r.id)} onChange={(v: number) => setScaleFor(r.id, v)} />
                </div>

                {/* Progress bar for recipe */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>התקדמות</span>
                    <span className="font-bold">{completed} / {total}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${recipeProgressPercent}%`,
                        backgroundColor: recipeColor
                      }}
                    />
                  </div>
                </div>

                {(r.ingredients || []).map((g: any, gi: number) => (
                  <div key={gi} className="mb-3">
                    {g.groupName ? <div className="font-semibold mb-1 text-gray-600 text-sm">{g.groupName}</div> : null}
                    <ul className="space-y-2">
                      {(g.items || []).map((it: any) => {
                        const k = norm(it.name);
                        const raw = baseQty.get(it.id);
                        const showQty = raw == null ? (it.qty || "") : formatQty(raw * getScale(r.id));

                        const on = deferredSelected.has(k);
                        const isWeighed = weighed.has(it.name);
                        const idx = colorIdxFor(k);
                        const col = on ? {
                          bg: hexToRgba(PALETTE[idx], BG_ALPHA),
                          bar: hexToRgba(PALETTE[idx], BAR_ALPHA),
                          outline: `rgba(0,0,0,${OUTL_ALPHA})`,
                        } : null;

                        return (
                          <li
                            key={it.id}
                            onClick={() => toggleWeighed(it.name)}
                            className={`flex gap-2 rounded-xl p-2 transition-all cursor-pointer ${
                              isWeighed ? 'bg-green-50 ring-2 ring-green-300' : ''
                            }`}
                            style={on && !isWeighed ? {
                              backgroundColor: col!.bg,
                              boxShadow: `inset 4px 0 0 0 ${col!.bar}`,
                              outline: `1px solid ${col!.outline}`,
                            } : undefined}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                              isWeighed ? 'bg-green-500 text-white' : 'bg-gray-200'
                            }`}>
                              {isWeighed && '✓'}
                            </div>
                            <span className="flex-1 px-1">{it.name}</span>
                            <span className="w-16 text-left font-bold px-1 text-gray-800">
                              {showQty}
                            </span>
                            <span className="w-12 text-sm text-gray-600 px-1">{it.unit}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Progress Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">סיכום חומרי גלם</h2>
              <button
                onClick={() => aggregatedIngredients.length > 0 && openFocusMode(0)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:from-pink-600 hover:to-purple-600 transition-all"
              >
                🎯 התחל מצב פוקוס
              </button>
            </div>
            
            <div className="mb-2">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">התקדמות שקילה</span>
                <span className="font-bold text-lg">
                  {weighed.size} / {aggregatedIngredients.length}
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {weighed.size === aggregatedIngredients.length && aggregatedIngredients.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl text-center">
                <div className="text-2xl mb-2">🎉 כל הכבוד!</div>
                <div className="text-green-800 font-bold">סיימת לשקול את כל המרכיבים!</div>
                <button
                  onClick={() => {
                    setWeighed(new Set());
                    localStorage.removeItem('weigh_progress');
                  }}
                  className="mt-3 px-4 py-2 rounded-lg bg-green-500 text-white font-medium hover:bg-green-600"
                >
                  אפס התקדמות
                </button>
              </div>
            )}
          </div>

          {/* Ingredients List */}
          <div className="space-y-3">
            {aggregatedIngredients.map((item, idx) => {
              const k = norm(item.name);
              const on = deferredSelected.has(k);
              const isWeighed = weighed.has(item.name);
              const colorIdx = colorIdxFor(k);
              const col = on ? {
                bg: hexToRgba(PALETTE[colorIdx], BG_ALPHA),
                bar: hexToRgba(PALETTE[colorIdx], BAR_ALPHA),
                outline: `rgba(0,0,0,${OUTL_ALPHA})`,
              } : null;

              return (
                <div
                  key={idx}
                  onClick={() => toggleWeighed(item.name)}
                  className={`bg-white rounded-2xl shadow-md p-5 cursor-pointer transition-all duration-200 ${
                    isWeighed ? 'ring-2 ring-green-400 bg-green-50' : 'hover:shadow-lg'
                  }`}
                  style={on && !isWeighed ? {
                    backgroundColor: col!.bg,
                    boxShadow: `inset 4px 0 0 0 ${col!.bar}`,
                    outline: `1px solid ${col!.outline}`,
                  } : undefined}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      isWeighed ? 'bg-green-500 scale-110' : 'bg-gray-200'
                    }`}>
                      {isWeighed ? (
                        <span className="text-white text-2xl">✓</span>
                      ) : (
                        <span className="text-gray-400 text-2xl">⚖️</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-gray-800 mb-1">{item.name}</div>
                      <div className="text-sm text-gray-500 truncate">
                        מתכונים: {item.sources.join(', ')}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-4xl font-black text-pink-600">
                        {formatQty(item.totalQty)}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">{item.unit}</div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openFocusMode(idx);
                      }}
                      className="px-4 py-2 rounded-xl bg-pink-100 text-pink-700 hover:bg-pink-200 text-sm font-bold transition-colors flex-shrink-0"
                    >
                      פוקוס 🎯
                    </button>
                  </div>
                </div>
              );
            })}
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