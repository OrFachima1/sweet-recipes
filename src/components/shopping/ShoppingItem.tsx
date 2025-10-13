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

  // refs & state
  const wrapperRef = useRef<HTMLDivElement | null>(null); // עטיפה חיצונית - נשתמש בה לקריסה מלאה
  const containerRef = useRef<HTMLDivElement | null>(null); // הכרטיס המתגרר
  const bgRef = useRef<HTMLDivElement | null>(null); // רקע האדום שמתחת לכרטיס

  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // constants
  const MAX_REVEAL = 120;
  const RELEASE_THRESHOLD = MAX_REVEAL * 0.66;
  const SNAP_BACK_EASING = "cubic-bezier(.22,.9,.1,1)";
  const TRANSITION_MS = 220;

  // pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (isRemoving) return;
    (e.target as Element).setPointerCapture((e as any).pointerId);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
    setIsDragging(true);
    if (containerRef.current) containerRef.current.style.transition = "none";
    if (bgRef.current) bgRef.current.style.transition = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isRemoving) return;
    const x = e.clientX;
    const dx = x - startX.current;
    const now = performance.now();
    const dt = Math.max(1, now - lastT.current);
    velocity.current = (x - lastX.current) / dt;
    lastX.current = x;
    lastT.current = now;

    // רק ימינה (שינוי אם תרצה שמאל)
    let target = Math.max(0, dx);
    if (target > MAX_REVEAL) {
      const extra = target - MAX_REVEAL;
      target = MAX_REVEAL + Math.sqrt(extra) * 10;
    }
    setOffset(target);

    // עדכון צבע/עוצמת הרקע: יותר תזוזה = גרדיאנט כהה יותר
    if (bgRef.current) {
      const t = Math.min(1, target / MAX_REVEAL);
      // gradient intensity from light to dark
      bgRef.current.style.opacity = `${Math.min(1, 0.45 + t * 0.6)}`;
      // shift gradient by t
      bgRef.current.style.background = `linear-gradient(90deg, rgba(254,202,202,${0.9 * t + 0.1}) 0%, rgba(190,18,60,${0.9 * t + 0.1}) 100%)`;
    }
  };

  // animate transform and cleanup transition after done
  const animateSetOffset = (value: number, duration = TRANSITION_MS) => {
    if (!containerRef.current) {
      setOffset(value);
      return;
    }
    containerRef.current.style.transition = `transform ${duration}ms ${SNAP_BACK_EASING}`;
    setOffset(value);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current) containerRef.current.style.transition = "";
      }, duration + 10);
    });
  };

  // slide out then collapse whole wrapper to avoid any leftover red line
  const slideOutThenCollapse = (slideDuration = 260) => {
    if (!containerRef.current || !wrapperRef.current || !bgRef.current) return;
    setIsRemoving(true);

    const offscreenX = window.innerWidth + 200;
    containerRef.current.style.transition = `transform ${slideDuration}ms ${SNAP_BACK_EASING}, opacity ${Math.min(
      slideDuration,
      220
    )}ms ${SNAP_BACK_EASING}`;
    // also fade the background a bit quicker so nothing remains visible
    bgRef.current.style.transition = `opacity ${Math.min(slideDuration, 180)}ms ${SNAP_BACK_EASING}`;
    setOffset(offscreenX);
    containerRef.current.style.opacity = "0";
    bgRef.current.style.opacity = "0";

    // לאחר ה-slide - קריסה של ה-wrapper (גובה, margin, padding)
    setTimeout(() => {
      if (!wrapperRef.current) return;
      wrapperRef.current.style.transition = `height ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, margin ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, padding ${TRANSITION_MS}ms ${SNAP_BACK_EASING}`;
      const h = wrapperRef.current.offsetHeight;
      wrapperRef.current.style.height = `${h}px`;
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      wrapperRef.current.offsetHeight;
      wrapperRef.current.style.height = "0px";
      wrapperRef.current.style.margin = "0px";
      wrapperRef.current.style.padding = "0px";
      wrapperRef.current.style.overflow = "hidden";
    }, slideDuration + 8);

    // בסוף — קריאה לחיצוני ומחיקה סופית (או הסתרה מלאה)
    setTimeout(() => {
      onDelete?.();
      // לעוד הגנה: הסתר את ה-wrapper לגמרי
      if (wrapperRef.current) wrapperRef.current.style.display = "none";
    }, slideDuration + TRANSITION_MS + 60);
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    if (!isDragging || isRemoving) return;
    setIsDragging(false);
    try {
      (e?.target as Element)?.releasePointerCapture?.((e as any)?.pointerId);
    } catch (err) {}

    const v_px_s = velocity.current * 1000;
    const shouldDelete = offset > RELEASE_THRESHOLD || Math.abs(v_px_s) > 700;

    if (shouldDelete) {
      const remainingPx = Math.max(0, window.innerWidth + 200 - offset);
      let slideDuration = 260;
      if (Math.abs(v_px_s) > 120) {
        const estimate = (remainingPx / Math.abs(v_px_s)) * 1000;
        slideDuration = Math.max(100, Math.min(450, Math.round(estimate)));
      }
      slideOutThenCollapse(slideDuration);
    } else {
      // החזר חזרה; גם "אפסה" את ה-bg לחצי-אופסיטי
      animateSetOffset(0, TRANSITION_MS);
      if (bgRef.current) {
        bgRef.current.style.transition = `background ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, opacity ${TRANSITION_MS}ms ${SNAP_BACK_EASING}`;
        bgRef.current.style.opacity = "0";
      }
    }
  };

  // keyboard support
  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (confirm(`למחוק את "${name}"?`)) {
        slideOutThenCollapse(260);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // don't render if already fully removed (optional safety)
  // note: we rely on parent onDelete to actually remove item from list
  // but wrapperRef.display='none' אמור למנוע כל שאריות ויזהיר את ה-DOM
  return (
    <div ref={wrapperRef} className="relative mb-3" style={{ borderRadius: 16, overflow: "visible" }} onKeyDown={onKey}>
      {/* רקע אדום גרדיאנט מתחת לכרטיס */}
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 16,
          pointerEvents: "none",
          // initial gradient (מעט שקוף) - יתחזק תוך גרירה
          background: "linear-gradient(90deg, rgba(254,202,202,0.2) 0%, rgba(190,18,60,0.35) 100%)",
          opacity: 0,
          transition: "opacity 160ms linear, background 160ms linear",
        }}
      />

      {/* אזור הפעולה - כפתור גלוי */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          width: MAX_REVEAL,
          display: "flex",
          alignItems: "center",
          pointerEvents: offset >= 30 ? "auto" : "none",
          zIndex: 5,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`האם למחוק את "${name}"?`)) slideOutThenCollapse(260);
          }}
          aria-label={`מחק ${name}`}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            background: "linear-gradient(90deg,#ef4444,#b91c1c)",
            color: "white",
            fontWeight: 700,
            boxShadow: "0 6px 14px rgba(185,28,28,0.18)",
            border: "none",
            cursor: "pointer",
          }}
        >
          מחק
        </button>
      </div>

      {/* הכרטיס עצמו */}
      <div
        ref={containerRef}
        role="listitem"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative bg-white rounded-xl shadow-sm border"
        style={{
          transform: `translateX(${offset}px)`,
          willChange: isDragging ? "transform" : "auto",
          zIndex: 10,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          textAlign: "left", // יישור לשמאל כפי שביקשת
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <button
          onClick={onToggleCheck}
          aria-label="toggle"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: isChecked ? "none" : "2px solid rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isChecked ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "white",
          }}
        >
          {isChecked ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12l4 4L19 6" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ width: 12, height: 12 }} />
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: isChecked ? "#8b8b8b" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
            {qty} {unit} {isManual ? "· ידני" : ""}
          </div>
        </div>

        {sources && sources.length > 0 && (
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setShowSources((s) => !s);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: showSources ? "#eef2ff" : "transparent",
              cursor: "pointer",
            }}
            title="מקורות"
          >
            ?
          </button>
        )}

        <div style={{ position: "relative" }}>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setShowMenu((s) => !s);
            }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
            aria-label="אפשרויות"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="12" cy="19" r="1.9" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 40,
                }}
              />

              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  background: "white",
                  borderRadius: 10,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  zIndex: 50,
                  minWidth: 180,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: 8, fontSize: 12, color: "#6b7280", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>העבר לקטגוריה</div>
                <div>
                  {categories.filter((c) => c.id !== "all").map((cat) => (
                    <button
                      key={cat.id}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        onChangeCategory(cat.id);
                        setShowMenu(false);
                      }}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "flex-end",
                        width: "100%",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "right",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 14, color: "#111827" }}>{cat.name}</span>
                    </button>
                  ))}
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.03)" }} />
                <button
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (confirm(`האם למחוק את "${name}"?`)) slideOutThenCollapse(260);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    textAlign: "right",
                    background: "transparent",
                    border: "none",
                    color: "#b91c1c",
                    cursor: "pointer",
                  }}
                >
                  מחק פריט
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* מקורות (expand) */}
      {showSources && sources && sources.length > 0 && (
        <div style={{ marginTop: 8, background: "#eef2ff", padding: 10, borderRadius: 10 }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>מקורות</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {sources.map((s, i) => (
              <li key={i} style={{ color: "#1e293b", fontSize: 13 }}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
