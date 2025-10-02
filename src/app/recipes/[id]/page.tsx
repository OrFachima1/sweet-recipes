"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, ensureAnonAuth } from "../../../lib/firebase";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import HomeButton from "../../../components/HomeButton";
import FloatingCalculator from "../../../components/FloatingCalculator";
import NoSleep from "nosleep.js";
import { useUser, useRole } from "../../../lib/auth";


// ---- Utilities: שמירה לוקאלית ----
const LS_CHECKED = (id: string) => `recipe_${id}_checked_map_v1`;
const LS_UNLOCK = (id: string) => `recipe_${id}_steps_unlocked_v1`;

// ---- Rich text: **בולד** + __קו__ + שורות ----
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

// ---- Scaling (כפול) לכמויות בתצוגה ----
const VULGAR: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseQtyToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let total = 0;
  let used = false;

  // שברי יוניקוד (½ וכד')
  for (const ch of Object.keys(VULGAR)) {
    if (s.includes(ch)) {
      total += VULGAR[ch];
      s = s.replaceAll(ch, " ");
      used = true;
    }
  }

  // טוקנים ברווחים: מספרים, שברים כמו 1/2, או טקסט (מפסיק)
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
    const num = Number(t.replace(",", ".")); // גם פסיק עשרוני
    if (!Number.isNaN(num)) {
      total += num;
      used = true;
      continue;
    }
    // נתקלנו בטקסט (למשל "מעט") ⇒ לא מכפילים בכלל
    return null;
  }

  return used ? total : null;
}

function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  const out = Math.round(n * 100) / 100; // שתי ספרות
  return String(out);
}

function lineWithScale(
  it: { name?: string; qty?: string; unit?: string },
  scale: number
) {
  const n = parseQtyToNumber(it.qty);
  const showQty = n == null ? (it.qty || "") : formatQty(n * scale);
  return [it.name, [showQty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
}
/* ========= Wake Lock (השארת המסך דולק) ========= */
// בלי imports למעלה – לא מייבאים nosleep.js גלובלי
function useKeepAwake(active: boolean) {
  useEffect(() => {
    let enabled = false;

    async function on() {
      try {
        const mod = await import("nosleep.js");
        const NoSleep = mod.default;
        // שמור מופע יחיד גלובלי
        (window as any).__nosleep ||= new NoSleep();
        (window as any).__nosleep.enable();
        enabled = true;
      } catch {
        // מתעלמים בשקט
      }
    }
    function off() {
      try { (window as any).__nosleep?.disable?.(); } catch {}
      enabled = false;
    }

    if (active) on(); else off();

    // אם חזרנו לפורגרונד, נוודא שוב שהוא פעיל
    const onVis = () => { if (active && document.visibilityState === "visible") on(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      off();
    };
  }, [active]);
}


/* ========= אנימציית חגיגה ========= */
function PartyOverlay({
  onDone,
  gif = "/minions.gif",     // ← שנה כאן אם שם הקובץ שלך שונה
  redirectTo = "/",          // ← יעד הניווט אחרי הסיום
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

    // קונפטי
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
        router.push(redirectTo); // ← חזרה לדף הבית
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
      {/* ה-GIF למטה במרכז */}
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
  const { user } = useUser();
  const { role } = useRole(user?.uid);
  const isManager = role === "manager";
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Scaling state ---
// --- Scaling state ---
const [scale, setScale] = useState<number>(1);

// --- Work Mode (שומר מסך דולק) ---
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

// --- Party overlay ---
const [party, setParty] = useState(false);

  // טעינת מתכון
  useEffect(() => {
    (async () => {
      setLoading(true);
      await ensureAnonAuth();
      const ref = doc(db, "recipes", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setData({ id: snap.id, ...(snap.data() as any) });
      } else {
        setData(null);
      }
      setLoading(false);
    })();
  }, [id]);

  // רשימת רכיבים שטוחים (עם מזהים) – משמשת ל־checked map
  const items = useMemo(() => {
    const arr: { id: string; text: string }[] = [];
    const groups = (data?.ingredients || []) as any[];
    groups.forEach((g) => {
      (g.items || []).forEach((it: any) => {
        const line = [it.name, [it.qty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
        arr.push({ id: it.id, text: line });
      });
    });
    return arr;
  }, [data]);

  // מצב צ'קבוקסים + פתיחת שלבים
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [askOpen, setAskOpen] = useState(false); // מודל שאלה


  // לאתחל מה־localStorage
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

  // שמירה לוקאלית
  useEffect(() => {
    if (!id) return;
    localStorage.setItem(LS_CHECKED(id), JSON.stringify(checked));
  }, [checked, id]);

  const total = items.length;
  const done = Object.values(checked).filter(Boolean).length;
  const allDone = total > 0 && done === total;

  // ברגע שכולם מסומנים – אם עוד לא נפתח, פתח מודל
  useEffect(() => {
    if (allDone && !unlocked) setAskOpen(true);
  }, [allDone, unlocked]);

  function onToggle(itemId: string) {
  setChecked((m) => ({ ...m, [itemId]: !m[itemId] }));
  // רטט עדין (אם נתמך)
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

  if (loading) return <div className="p-6">טוען…</div>;
  if (!data) return <div className="p-6">המתכון לא נמצא.</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 text-[18px] md:text-[20px]" dir="rtl" lang="he">
      <HomeButton />
      <FloatingCalculator />
      {/* כותרת עליונה + פעולות */}
      <div className="flex items-center justify-between mb-3">
        
        <button onClick={() => router.back()} className="text-sm underline">
          ⬅ חזרה
        </button>
        <div className="flex gap-2">
          {isManager && (
            <>
              <button onClick={() => router.push(`/recipes/${id}/edit`)} className="px-3 py-2 rounded-xl bg-neutral-200 text-sm">
                ערוך
              </button>
              <button onClick={handleDelete} className="px-3 py-2 rounded-xl bg-red-500 text-white text-sm">
                מחק
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header – שם + בקר סקיילינג + קטגוריה/הערה */}
      <header className="bg-white rounded-2xl shadow p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          {/* שם המוצר (שמאל) */}
          <h1 className="text-2xl md:text-3xl font-extrabold truncate">{data.title}</h1>
          {/* מצב עבודה (לא מכבה מסך) */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-pink-500"
              checked={workMode}
              onChange={handleWorkModeToggle}
            />
            מצב עבודה 
          </label>
          {/* בקר סקיילינג (ימין) */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">כפול</span>

            <input
              type="number"
              step={0.1}
              min={0.1}
              dir="ltr"
              value={scale}
              onChange={(e) => {
                const v = Number(e.target.value);
                setScale(!Number.isFinite(v) || v < 0 ? 1 : v);
              }}
              className="w-20 rounded-xl border bg-white px-3 py-2 text-left"
              title="מקדם הכפלה"
            />

            <div className="flex gap-1">
              {[0.5, 2, 3].map((v) => (
                <button
                  key={v}
                  onClick={() => setScale(v)}
                  className={`px-2 py-1 rounded-lg border text-sm ${
                    scale === v ? "bg-pink-100 border-pink-300" : "bg-white"
                  }`}
                >
                  {v}×
                </button>
              ))}
              <button
                onClick={() => setScale(1)}
                className={`px-2 py-1 rounded-lg border text-sm ${
                  scale === 1 ? "bg-pink-100 border-pink-300" : "bg-white"
                }`}
                title="איפוס"
              >
                איפוס
              </button>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">{data.category}</div>
        {data.note && (
          <div className="mt-2" dangerouslySetInnerHTML={{ __html: formatRich(data.note) }} />
        )}
      </header>

      {/* שני טורים: מצרכים + תמונה */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* מצרכים + צ'קבוקסים */}
       <section className="bg-white rounded-2xl shadow p-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold">מצרכים</h2>
    <div className="text-sm text-gray-600">{done}/{total} סומנו</div>
  </div>

  {/* קבוצות ורכיבים */}
  <div className="mt-3 space-y-4">
    {(data.ingredients || []).map((g: any, idx: number) => (
      <div key={idx}>
        {g.groupName && <div className="font-semibold mb-1">{g.groupName}</div>}

        {/* חשוב לטאצ' – גלילה חלקה */}
        <ul className="space-y-2 select-none" style={{ touchAction: "pan-y" }}>
          {(g.items || []).map((it: any) => {
            const html = formatRich(
              [it.name, [it.qty, it.unit].filter(Boolean).join(" ")].filter(Boolean).join(" — ")
            );
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
                  className={[
                    "w-full text-right flex items-center gap-3",
                    "min-h-[48px] p-3 rounded-xl border bg-white",
                    "hover:bg-pink-50 active:scale-[0.99] transition",
                  ].join(" ")}
                >
                  {/* תיבה ויזואלית נוחה לטאצ' */}
                  <span
                    aria-hidden="true"
                    className={[
                      "inline-grid place-items-center shrink-0",
                      "h-6 w-6 rounded-md border",
                      isChecked ? "bg-pink-500 border-pink-500 text-white" : "bg-white border-gray-300",
                    ].join(" ")}
                  >
                    {isChecked ? "✓" : ""}
                  </span>

                  <span
                    className="text-[18px] leading-8"
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

  {/* כפתורי סיום – פעם אחת בתחתית כל המצרכים */}
  <div className="mt-4 flex items-center justify-end gap-2">
    <button
      onClick={() => setAllChecked(false)}
      className="px-3 py-2 rounded-xl border bg-white hover:bg-neutral-50"
    >
      נקה הכול
    </button>
    <button
      onClick={() => setAllChecked(true)}
      className="px-3 py-2 rounded-xl border bg-white hover:bg-neutral-50"
    >
      סמן הכול
    </button>
  </div>
</section>


        {/* תמונה לצד המצרכים */}
        {data.imageDataUrl && (
          <aside className="bg-white rounded-2xl shadow p-3 flex items-center justify-center">
            <div className="inline-block max-w-full">
              <AutoFit src={data.imageDataUrl} height={320} />
            </div>
          </aside>
        )}
      </div>

      {/* שלבים – נחשפים רק אחרי סימון הכול */}
      <section className="mt-6 bg-white rounded-2xl shadow p-4">
        <h2 className="text-xl font-bold">איך מכינים</h2>

        {!unlocked ? (
          <div className="mt-3 p-4 rounded-xl bg-pink-50 text-pink-900">
            סמנו את כל המצרכים כדי להציג את שלבי ההכנה.
          </div>
        ) : (
          <ol className="mt-3 list-decimal pr-5 space-y-2 text-lg md:text-xl leading-8">
            {(data.steps || []).map((s: any, i: number) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: formatRich(s.text) }} />
            ))}
          </ol>
        )}
        <div className="mt-5 text-center">
          <button
            onClick={() => setParty(true)}
            className="px-5 py-3 rounded-2xl bg-green-500 text-white font-bold shadow hover:shadow-md active:scale-[0.98]"
            title="כל הכבוד! סיום מתכון"
          >
            ✓ סיום מתכון
          </button>
        </div>
      </section>

      {/* מודל אישור כשכולם מסומנים */}
      {askOpen && !unlocked && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 text-center">
            <div className="text-lg font-bold mb-2">בדיקה לפני התחלה</div>
            <div className="text-sm text-gray-700">
              בטוח/ה ששקלת את <strong>כל</strong> המרכיבים?
            </div>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                onClick={confirmOpenSteps}
                className="px-4 py-2 rounded-xl bg-pink-500 text-white font-semibold"
              >
                כן, המשך/י
              </button>
              <button
                onClick={cancelOpenSteps}
                className="px-4 py-2 rounded-xl bg-white border"
              >
                עדיין לא
              </button>
            </div>
          </div>
        </div>
      )}
       {/* כאן בדיוק לשים את החגיגה */}
      {party && (
        <PartyOverlay
          onDone={() => setParty(false)}
          gif="/minions.gif"     // שנה אם שם הקובץ שונה
          redirectTo="/"         // אפשר לשנות ליעד אחר
        />
      )}
    </div>
  );
}

/** תצוגת תמונה: גובה קבוע, רוחב לפי יחס האמיתי (בלי חיתוך) */
function AutoFit({ src, height }: { src: string; height: number }) {
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <div
      className="inline-block max-w-full bg-neutral-100 overflow-hidden rounded-2xl"
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
        className="w-full h-full object-contain object-center"
      />
      
    </div>
    
  );
}
