// ShoppingItem.tsx
import React, { useRef, useState, useEffect } from "react";
import type { Category } from "./CategoryManager";

interface ShoppingItemProps {
  name: string;
  qty: number;
  unit: string;
  isManual: boolean;
  isChecked: boolean;
  categories: Category[];
  sources: string[];
  currentCategory?: string;
  selectedCategory: string;
  onToggleCheck: () => void;
  onChangeCategory: (catId: string) => void;
  onDelete?: () => void;
}

export default function ShoppingItem(props: ShoppingItemProps) {
  const {
    name,
    qty,
    unit,
    isManual,
    isChecked,
    categories,
    sources,
    currentCategory,
    selectedCategory,
    onToggleCheck,
    onChangeCategory,
    onDelete,
  } = props;

  // --- מצב ו-refs לשיוט חלק ומהיר --- //
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [offset, setOffset] = useState(0); // px
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [heightCollapsed, setHeightCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // --- קבועים למשנה תנועה --- //
  const MAX_REVEAL = 120; // רוחב אזור הפעולה שמתגלה (למשל כפתור מחיקה)
  const RELEASE_THRESHOLD = MAX_REVEAL * 0.66; // מעל זה -- נחסל
  const SNAP_BACK_EASING = "cubic-bezier(.22,.9,.1,1)"; // תחושה "קפיצית" אך חלקה
  const TRANSITION_MS = 220;

  // --- עזר למדידת מהירות/אינרציה --- //
  const onPointerDown = (e: React.PointerEvent) => {
    if (isRemoving) return;
    (e.target as Element).setPointerCapture((e as any).pointerId);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
    setIsDragging(true);

    // ביטול טרנזישן בזמן גרירה
    if (containerRef.current) {
      containerRef.current.style.transition = "none";
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isRemoving) return;
    const x = e.clientX;
    const dx = x - startX.current; // חיובי = ימינה (RTL: מתאים)
    const now = performance.now();
    const dt = Math.max(1, now - lastT.current);
    // מוערכת מהירות px / ms
    velocity.current = (x - lastX.current) / dt;
    lastX.current = x;
    lastT.current = now;

    // נרשה תזוזה רק בכיוון הרצוי (ימינה)
    let target = Math.max(0, dx);
    // ריפובנד קטן מעל המקסימום (rubberband)
    if (target > MAX_REVEAL) {
      const extra = target - MAX_REVEAL;
      target = MAX_REVEAL + Math.sqrt(extra) * 10; // ריפ-אפקט
    }
    setOffset(target);
  };

  const animateSetOffset = (value: number, duration = TRANSITION_MS) => {
    if (!containerRef.current) {
      setOffset(value);
      return;
    }
    containerRef.current.style.transition = `transform ${duration}ms ${SNAP_BACK_EASING}`;
    setOffset(value);
    // נקפל את הטרנזישן אחרי פרק זמן (מנקה סטייל inline)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current) containerRef.current.style.transition = "";
      }, duration + 10);
    });
  };

  const collapseAndDelete = () => {
    // דחיפת הכרטיס החוצה ולקרוס
    if (!containerRef.current) return;
    setIsRemoving(true);
    // 1. שלח את הכרטיס מחוץ לצג
    containerRef.current.style.transition = `transform ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, opacity ${TRANSITION_MS}ms ${SNAP_BACK_EASING}`;
    setOffset(window.innerWidth); // יוצא למסך לימין
    containerRef.current.style.opacity = "0";
    // 2. אחרי האנימציה, קפוץ לגובה 0 (אנימציה של קריסה)
    setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.style.transition = `height ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, margin ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, padding ${TRANSITION_MS}ms ${SNAP_BACK_EASING}`;
      containerRef.current.style.height = `${containerRef.current.offsetHeight}px`; // ביסוס
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      containerRef.current.offsetHeight;
      containerRef.current.style.height = "0px";
      containerRef.current.style.margin = "0px";
      containerRef.current.style.padding = "0px";
      containerRef.current.style.overflow = "hidden";
    }, TRANSITION_MS + 20);

    setTimeout(() => {
      // קריאה לאבא שימחק בפועל (אפשר להחזיר undo שם)
      onDelete?.();
      setHeightCollapsed(true);
    }, TRANSITION_MS * 2 + 60);
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    if (!isDragging || isRemoving) return;
    setIsDragging(false);

    // שחרור pointer capture
    try {
      (e?.target as Element)?.releasePointerCapture?.((e as any)?.pointerId);
    } catch (err) {}

    const v = velocity.current * 1000; // ממיר ל-px/s (approx)
    const shouldDelete = offset > RELEASE_THRESHOLD || v > 700; // מהירות גבוהה גם מוחקת

    if (shouldDelete) {
      // אנימציה של מחיקה
      collapseAndDelete();
    } else {
      // החזר חזרה
      animateSetOffset(0);
    }
  };

  // תמיכה ב-keyboard accessibility למחיקה
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (confirm(`למחוק את "${name}"?`)) {
        collapseAndDelete();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (heightCollapsed) return null;

  // --- עיצוב רקע שנראה מקצועי --- //
  const showAction = offset > 0;
  const dangerLabel = offset > RELEASE_THRESHOLD ? "שחרר למחיקה" : "החלק ימינה";

  const filteredCategories = categories.filter((c) => c.id !== "all");
  const categoryEmoji = categories.find((c) => c.id === currentCategory)?.emoji;
  const showCategoryEmoji = selectedCategory === "all" && categoryEmoji;

  return (
    <div
      className="relative"
      style={{ zIndex: showMenu ? 100 : "auto", touchAction: "pan-y" }}
      onKeyDown={onKey}
    >
      {/* רקע אדום/וורדרד שנגלה תחת הכרטיס */}
      <div
        className="absolute inset-0 flex items-center justify-start px-4 rounded-2xl pointer-events-none"
        style={{
          background: offset > RELEASE_THRESHOLD ? "#ef4444" : "#fca5a5",
          transition: isDragging ? "none" : "background 160ms linear",
          opacity: showAction ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-3 pl-2">
          <span style={{ fontSize: 22 }}>🗑️</span>
          <span style={{ color: "white", fontWeight: 700 }}>{dangerLabel}</span>
        </div>
      </div>

     
      {/* הכרטיס עצמו — באמצעות pointer events (עבור מגע ועכבר) */}
      <div
        ref={containerRef}
        role="listitem"
        tabIndex={0}
        className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 ${isChecked ? "opacity-60" : ""}`}
        style={{
          transform: `translateX(${offset}px)`,
          // transition inline מנוהל דרך animateSetOffset / during drag
          willChange: isDragging ? "transform" : "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onToggleCheck}
            className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              isChecked
                ? "bg-gradient-to-br from-rose-500 to-pink-500 border-rose-500"
                : "border-gray-300 hover:border-rose-400"
            }`}
          >
            {isChecked && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1">
              <div className={`font-medium ${isChecked ? "line-through text-gray-500" : "text-gray-900"}`}>
                {name}
              </div>
              <div className="text-sm text-gray-500">
                {qty} {unit}
                {isManual && <span className="text-xs text-rose-500 mr-2">(ידני)</span>}
              </div>
            </div>

            {showCategoryEmoji && (
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-xl bg-gray-50 rounded-lg">
                {categoryEmoji}
              </div>
            )}
          </div>

          {sources && sources.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSources(!showSources);
              }}
              className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                showSources ? "bg-blue-500 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-600"
              }`}
              title="הצג מקורות"
            >
              <span className="text-sm font-bold">?</span>
            </button>
          )}

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="flex-shrink-0 w-10 h-10 rounded-xl hover:bg-gray-100 active:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label="אפשרויות"
            >
              <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2.5" />
                <circle cx="12" cy="12" r="2.5" />
                <circle cx="12" cy="19" r="2.5" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-[200]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />

                <div
                  className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-[300] min-w-[200px] max-h-[400px] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-bold text-gray-500 px-4 py-2 border-b border-gray-100">העבר לקטגוריה</div>

                  <div className="py-1">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          onChangeCategory(cat.id);
                          setShowMenu(false);
                        }}
                        className="w-full text-right px-4 py-2.5 hover:bg-rose-50 active:bg-rose-100 transition-colors flex items-center gap-3 group"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">{cat.emoji}</span>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-rose-700">{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  {onDelete && (
                    <>
                      <div className="h-px bg-gray-200 my-1" />
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (confirm(`האם למחוק את "${name}"?`)) collapseAndDelete();
                        }}
                        className="w-full text-right px-4 py-2.5 hover:bg-red-50 active:bg-red-100 transition-colors flex items-center gap-3 text-red-600 group"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🗑️</span>
                        <span className="text-sm font-medium">מחק פריט</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showSources && sources && sources.length > 0 && (
        <div className="mt-2 bg-blue-50 rounded-xl p-3 text-sm">
          <div className="font-semibold text-blue-900 mb-1">מקורות:</div>
          <ul className="text-blue-700 space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{source}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
