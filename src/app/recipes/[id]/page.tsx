"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, ensureAnonAuth } from "../../../lib/firebase";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import HomeButton from "../../../components/HomeButton";
import FloatingCalculator from "../../../components/FloatingCalculator";
import NoSleep from "nosleep.js";
import { useAuth } from "@/contexts/AuthContext";
import ScaleControl from "../../../components/ScaleControl";
import { updateDoc, serverTimestamp } from "firebase/firestore";
import LoadingScreen from "@/components/LoadingScreen";

// ---- Utilities ----
const LS_CHECKED = (id: string) => `recipe_${id}_checked_map_v1`;
const LS_UNLOCK = (id: string) => `recipe_${id}_steps_unlocked_v1`;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRich(s?: string | null) {
  if (!s) return "";
  let t = escapeHtml(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__(.+?)__/g, "<u>$1</u>");
  t = t.replace(/\n/g, "<br/>");
  return t;
}

const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

function parseQtyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let total = 0;
  let used = false;

  for (const ch of Object.keys(VULGAR)) {
    if (s.includes(ch)) {
      total += VULGAR[ch];
      s = s.replaceAll(ch, " ");
      used = true;
    }
  }

  const tokens = s.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (/^\d+\/\d+$/.test(t)) {
      const [a, b] = t.split("/").map(Number);
      if (b) {
        total += a / b;
        used = true;
        continue;
      }
    }
    const num = Number(t.replace(",", "."));
    if (!Number.isNaN(num)) {
      total += num;
      used = true;
      continue;
    }
    return null;
  }
  return used ? total : null;
}

function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  const out = Math.round(n * 100) / 100;
  return String(out);
}

function lineWithScale(
  it: { name?: string; qty?: string; unit?: string },
  scale: number
) {
  const n = parseQtyToNumber(it.qty);
  const showQty = n == null ? (it.qty || "") : formatQty(n * scale);
  return [it.name, [showQty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" – ");
}

function useKeepAwake(active: boolean) {
  useEffect(() => {
    let enabled = false;
    async function on() {
      try {
        const mod = await import("nosleep.js");
        const NoSleep = mod.default;
        (window as any).__nosleep ||= new NoSleep();
        (window as any).__nosleep.enable();
        enabled = true;
      } catch {}
    }
    function off() {
      try { (window as any).__nosleep?.disable?.(); } catch {}
      enabled = false;
    }
    if (active) on(); else off();
    const onVis = () => { if (active && document.visibilityState === "visible") on(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      off();
    };
  }, [active]);
}

function PartyOverlay({
  onDone,
  gif = "/minions.gif",
  redirectTo = "/",
}: {
  onDone?: () => void;
  gif?: string;
  redirectTo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    let raf = 0;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;

    function resize() {
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const N = 180;
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#f06595", "#ffa94d"];
    const parts = Array.from({ length: N }).map(() => ({
      x: Math.random() * cvs.width,
      y: -20 - Math.random() * cvs.height,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[(Math.random() * colors.length) | 0],
      vy: 2 + Math.random() * 3,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI,
      vr: -0.1 + Math.random() * 0.2,
    }));

    const t0 = performance.now();
    function tick(t: number) {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > cvs.height + 20) {
          p.y = -20;
          p.x = Math.random() * cvs.width;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      raf = requestAnimationFrame(tick);

      if (t - t0 > 3500) {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        try { onDone?.(); } catch {}
        router.push(redirectTo);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [onDone, redirectTo, router]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <img
        src={gif}
        alt=""
        className="absolute inset-x-0 bottom-6 mx-auto h-32 md:h-40 lg:h-48 object-contain select-none"
        draggable={false}
      />
    </div>
  );
}

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading, role } = useAuth();
  const isManager = role === "manager";
  const canEdit = role === "manager" || role === "senior_worker";
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [scale, setScale] = useState(1);
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

  const [party, setParty] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      setLoading(true);
      if (!user) {
        try {
          await ensureAnonAuth();
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
        }
      }
      const ref = doc(db, "recipes", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setData({ id: snap.id, ...(snap.data() as any) });
      } else {
        setData(null);
      }
      setLoading(false);
    })();
  }, [id, user, authLoading]);

  const items = useMemo(() => {
    const arr: { id: string; text: string }[] = [];
    const groups = (data?.ingredients || []) as any[];
    groups.forEach((g) => {
      (g.items || []).forEach((it: any) => {
        const line = [it.name, [it.qty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" – ");
        arr.push({ id: it.id, text: line });
      });
    });
    return arr;
  }, [data]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (!id || items.length === 0) return;
    try {
      const raw = localStorage.getItem(LS_CHECKED(id));
      const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      const merged: Record<string, boolean> = {};
      items.forEach((it) => (merged[it.id] = !!map[it.id]));
      setChecked(merged);
    } catch {
      const empty: Record<string, boolean> = {};
      items.forEach((it) => (empty[it.id] = false));
      setChecked(empty);
    }
    setUnlocked(localStorage.getItem(LS_UNLOCK(id)) === "1");
  }, [id, items.length]);

  useEffect(() => {
    if (!id) return;
    localStorage.setItem(LS_CHECKED(id), JSON.stringify(checked));
  }, [checked, id]);

  const total = items.length;
  const done = Object.values(checked).filter(Boolean).length;
  const allDone = total > 0 && done === total;
  const progress = total > 0 ? (done / total) * 100 : 0;

  useEffect(() => {
    if (allDone && !unlocked) setAskOpen(true);
  }, [allDone, unlocked]);

  // עדכון unlocked כשמנקים הכל - חוזר למצב נעול
  useEffect(() => {
    if (!allDone && unlocked) {
      setUnlocked(false);
      if (id) localStorage.setItem(LS_UNLOCK(id), "0");
    }
  }, [allDone, unlocked, id]);

  function onToggle(itemId: string) {
    setChecked((m) => ({ ...m, [itemId]: !m[itemId] }));
    try { navigator.vibrate?.(12); } catch {}
  }
  
  function setAllChecked(val: boolean) {
    const map: Record<string, boolean> = {};
    (data.ingredients || []).forEach((g: any) =>
      (g.items || []).forEach((it: any) => (map[it.id] = val))
    );
    setChecked(map);
    try { navigator.vibrate?.(18); } catch {}
  }

  function confirmOpenSteps() {
    if (!id) return;
    setUnlocked(true);
    localStorage.setItem(LS_UNLOCK(id), "1");
    setAskOpen(false);
  }

  function cancelOpenSteps() {
    setAskOpen(false);
  }

  async function handleDelete() {
    if (!confirm("למחוק את המתכון?")) return;
    await ensureAnonAuth();
    await deleteDoc(doc(db, "recipes", id));
    router.push("/");
  }

  if (loading) return <LoadingScreen />;
  
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">😢</div>
          <div className="text-2xl font-bold text-gray-800 mb-2">המתכון לא נמצא</div>
          <button 
            onClick={() => router.push("/")}
            className="mt-4 px-6 py-3 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}} />
      
      {/* Background with animated gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 -z-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-rose-200 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-40 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <div className="relative min-h-screen">
        <div className="max-w-7xl mx-auto p-4 md:p-6 text-[18px] md:text-[20px]" dir="rtl" lang="he">
          <HomeButton />
          <FloatingCalculator />
          
          {/* Top Navigation Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <button 
              onClick={() => router.back()} 
              className="group flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/70 backdrop-blur-md shadow-md shadow-rose-200/30 hover:shadow-lg hover:bg-white transition-all hover:scale-105 border border-white/50"
            >
              <span className="text-lg group-hover:-translate-x-1 transition-transform">➡</span>
            </button>
            
            {(canEdit || isManager) && (
              <div className="flex gap-2">
                {canEdit && (
                  <button
                    onClick={() => router.push(`/recipes/${id}/edit`)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white text-sm font-semibold shadow-md shadow-rose-300/30 hover:shadow-lg transition-all hover:scale-105"
                  >
                    ✏️ ערוך
                  </button>
                )}
                {isManager && (
                  <button
                    onClick={handleDelete}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-red-400 to-rose-500 text-white text-sm font-semibold shadow-md shadow-red-300/30 hover:shadow-lg transition-all hover:scale-105"
                  >
                    🗑️ מחק
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hero Header with Image */}
          <div className="relative mb-4 rounded-2xl overflow-hidden bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl shadow-xl shadow-rose-200/20 border border-white/50">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-pink-500/5 to-orange-500/5"></div>
            
            <div className="relative p-4 sm:p-5">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                <div className="flex-1 w-full">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 leading-tight break-words">
                    <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 bg-clip-text text-transparent drop-shadow-sm">
                      {data.title}
                    </span>
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-400 to-pink-500 text-white text-xs font-bold shadow-sm">
                      <span>📁</span>
                      {data.category}
                    </span>
                    
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer shadow-sm hover:shadow-md transition-all hover:scale-105 text-xs font-bold bg-white/80">
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={workMode}
                        onChange={handleWorkModeToggle}
                      />
                      <span className={`w-2.5 h-2.5 rounded-full transition-all ${workMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                      <span className={workMode ? 'text-green-700' : 'text-gray-700'}>
                        {workMode ? 'מצב עבודה פעיל' : 'מצב עבודה כבוי'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                <button
                onClick={() => router.push(`/weigh?ids=${id}`)}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-400 to-indigo-500 text-white text-xl shadow-md hover:shadow-lg transition-all hover:scale-110"
                title="מצב שקילה מרובה"
              >
                ⚖️
              </button>
              <ScaleControl value={scale} onChange={setScale} />
            </div>
              </div>

              {data.note && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 shadow-inner">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <div className="flex-1 text-xs sm:text-sm text-amber-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatRich(data.note) }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left Column: Ingredients */}
            <div className="lg:col-span-2 space-y-3">
              
              {/* Progress Bar Header + Buttons */}
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-4 border border-white/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                  <h2 className="text-lg sm:text-xl font-black bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                    🛒 מצרכים
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600">{done}/{total}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setAllChecked(true)}
                    disabled={allDone}
                    className="flex-1 px-3 py-2 text-sm rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold shadow-md hover:shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    ✓ סמן הכל
                  </button>
                  <button
                    onClick={() => setAllChecked(false)}
                    disabled={done === 0}
                    className="flex-1 px-3 py-2 text-sm rounded-xl bg-white border-2 border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition-all hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    ✗ נקה הכל
                  </button>
                </div>
              </div>
              
              {/* Ingredients List */}
              <div className="space-y-3">
                {(data.ingredients || []).map((g: any, idx: number) => (
                  <div key={idx} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-3 sm:p-4 border border-white/50">
                    {g.groupName && (
                      <h3 className="text-base sm:text-lg font-bold mb-2 text-rose-700">
                        {g.groupName}
                      </h3>
                    )}

                    <ul className="space-y-2" style={{ touchAction: "pan-y" }}>
                      {(g.items || []).map((it: any) => {
                        const html = formatRich(lineWithScale(it, scale));
                        const isChecked = !!checked[it.id];

                        return (
                          <li key={it.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isChecked}
                              onClick={() => onToggle(it.id)}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                  e.preventDefault();
                                  onToggle(it.id);
                                }
                              }}
                              className={`
                                group w-full flex items-center gap-3 p-3 rounded-xl 
                                transition-all duration-300 min-h-[52px]
                                ${isChecked 
                                  ? 'bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 shadow-md scale-[0.98] border-2 border-rose-300' 
                                  : 'bg-white hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 shadow-sm hover:shadow-md hover:scale-[1.02] border-2 border-rose-100'
                                }
                              `}
                            >
                              <div className={`
                                relative shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg transition-all duration-300
                                ${isChecked 
                                  ? 'bg-gradient-to-br from-rose-400 to-pink-500 scale-110 rotate-12' 
                                  : 'bg-white border-2 border-rose-300 group-hover:border-rose-400'
                                }
                              `}>
                                {isChecked && (
                                  <svg className="absolute inset-0 w-full h-full p-0.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>

                              <span
                                className={`flex-1 text-right text-sm sm:text-base leading-relaxed transition-all ${
                                  isChecked ? 'text-rose-900 font-medium' : 'text-gray-800'
                                }`}
                                dangerouslySetInnerHTML={{ __html: html }}
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Image + Progress Bar */}
            {!data.imageDataUrl && (
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-6">
                  {/* Just Progress Bar */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-4 border border-white/50">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-12 h-12 rounded-full border-3 border-rose-200 relative">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={`${progress} 100`}
                            style={{
                              stroke: progress === 100 ? '#10b981' : `url(#gradient)`
                            }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-rose-700">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 bg-rose-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-400 via-pink-500 to-orange-400 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {data.imageDataUrl && (
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-6 space-y-3">
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-3 border border-white/50 overflow-hidden">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-orange-500/10 rounded-xl"></div>
                      <AutoFit src={data.imageDataUrl} height={320} />
                    </div>
                  </div>
                  
                  {/* Just Progress Bar under image */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-4 border border-white/50">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-12 h-12 rounded-full border-3 border-rose-200 relative">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={`${progress} 100`}
                            style={{
                              stroke: progress === 100 ? '#10b981' : `url(#gradient)`
                            }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-rose-700">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>

                    <div className="h-2 bg-rose-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-400 via-pink-500 to-orange-400 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Steps Section */}
          <div className="mt-4 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-rose-200/20 p-4 sm:p-5 border border-white/50">
            <h2 className="text-xl sm:text-2xl font-black mb-3 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">👨‍🍳</span>
              <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">
                שלבי ההכנה
              </span>
            </h2>

            {!unlocked ? (
              <div className="relative p-6 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-100 via-pink-100 to-orange-100 opacity-50"></div>
                <div className="absolute inset-0 border-4 border-dashed border-rose-300 rounded-xl"></div>
                <div className="relative text-center">
                  <div className="text-4xl sm:text-5xl mb-3 animate-bounce">🔒</div>
                  <div className="text-lg sm:text-xl font-bold text-rose-900 mb-2">כמעט שם!</div>
                  <div className="text-sm sm:text-base text-rose-700">
                    סמנו את כל המצרכים כדי לפתוח את השלבים ✨
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {(data.steps || []).map((s: any, i: number) => (
                  <div key={i} className="group flex gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-white to-rose-50/50 hover:from-rose-50 hover:to-pink-50 transition-all shadow-sm hover:shadow-md border border-rose-100">
                    <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white font-bold flex items-center justify-center text-sm sm:text-base shadow-md">
                      {i + 1}
                    </div>
                    <div 
                      className="flex-1 text-sm sm:text-base leading-relaxed text-gray-800"
                      dangerouslySetInnerHTML={{ __html: formatRich(s.text) }} 
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 text-center">
              <button
                onClick={() => setParty(true)}
                className="group relative inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 text-white text-base sm:text-lg font-black shadow-lg hover:shadow-xl transition-all hover:scale-110 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className="relative text-xl sm:text-2xl">🎉</span>
                <span className="relative">סיימתי את המתכון!</span>
              </button>
            </div>
          </div>

          {/* Confirmation Modal */}
          {askOpen && !unlocked && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 text-center transform animate-scaleIn border-2 border-rose-200">
                <div className="text-4xl sm:text-5xl mb-3">🎯</div>
                <h3 className="text-lg sm:text-xl font-black mb-2 bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                  רגע לפני שממשיכים!
                </h3>
                <p className="text-gray-700 text-sm sm:text-base mb-4 leading-relaxed">
                  בטוח/ה ששקלת את <strong className="text-rose-600">כל</strong> המרכיבים? 
                  <br/>זה חשוב להצלחת המתכון! 🌟
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={confirmOpenSteps}
                    className="flex-1 px-4 py-3 text-sm rounded-xl bg-gradient-to-r from-rose-400 via-pink-500 to-orange-400 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    ✓ כן, אני מוכן/ה!
                  </button>
                  <button
                    onClick={cancelOpenSteps}
                    className="flex-1 px-4 py-3 text-sm rounded-xl bg-white border-2 border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition-all hover:scale-105 shadow-md"
                  >
                    רגע, עוד לא
                  </button>
                </div>
              </div>
            </div>
          )}

          {party && (
            <PartyOverlay
              onDone={() => setParty(false)}
              gif="/minions.gif"
              redirectTo="/"
            />
          )}
        </div>
      </div>
    </>
  );
}

function AutoFit({ src, height }: { src: string; height: number }) {
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <div
      className="relative inline-block w-full overflow-hidden rounded-2xl"
      style={ratio ? ({ height, aspectRatio: String(ratio) } as any) : ({ height } as any)}
    >
      <img
        src={src}
        alt=""
        onLoad={(e) => {
          const im = e.currentTarget;
          if (im.naturalWidth && im.naturalHeight) {
            setRatio(im.naturalWidth / im.naturalHeight);
          }
        }}
        className="w-full h-full object-cover"
      />
    </div>
  );
}