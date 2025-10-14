import React, { useRef, useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  emoji: string;
}

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const rafRef = useRef<number | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const velocityHistory = useRef<number[]>([]); // שמירת היסטוריית מהירויות

  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSwipeStarted, setIsSwipeStarted] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showUndoBar, setShowUndoBar] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(4);
  const [showMenu, setShowMenu] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const MAX_REVEAL = 120;
  const RELEASE_THRESHOLD = MAX_REVEAL * 2; // 90 פיקסלים
  const SNAP_BACK_EASING = "cubic-bezier(.22,.9,.1,1)";
  const TRANSITION_MS = 220;
  const UNDO_TIMEOUT = 4000;
  const MIN_SWIPE_DISTANCE = 25; // מרחק מינימלי להתחלת סוויפ - הגדלתי ל-25
  const VELOCITY_THRESHOLD = 1500; // סף מהירות גבוה יותר

  const onPointerDown = (e: React.PointerEvent) => {
    if (isRemoving || showUndoBar) return;
    (e.target as Element).setPointerCapture((e as any).pointerId);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
    velocityHistory.current = []; // איפוס היסטוריה
    setIsDragging(true);

    if (containerRef.current) {
      containerRef.current.style.transition = "none";
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isRemoving || showUndoBar) return;
    const x = e.clientX;
    const dx = x - startX.current;
    
    // בדיקת כיוון - רק ימינה
    if (dx < 0) {
      return;
    }
    
    // אם עדיין לא התחלנו סוויפ, בודקים אם עברנו את הסף המינימלי
    if (!isSwipeStarted && dx < MIN_SWIPE_DISTANCE) {
      return;
    }
    
    // אם עברנו את הסף, מסמנים שהסוויפ התחיל
    if (!isSwipeStarted) {
      setIsSwipeStarted(true);
    }
    
    const now = performance.now();
    const dt = Math.max(16, now - lastT.current); // מינימום 16ms (60fps) למנוע spikes
    
    // חישוב מהירות מוחלק
    const instantVelocity = (x - lastX.current) / dt;
    velocityHistory.current.push(instantVelocity);
    
    // שמירת רק 5 הערכים האחרונים
    if (velocityHistory.current.length > 5) {
      velocityHistory.current.shift();
    }
    
    // ממוצע של המהירויות לחלקות
    velocity.current = velocityHistory.current.reduce((a, b) => a + b, 0) / velocityHistory.current.length;
    
    lastX.current = x;
    lastT.current = now;

    // עכשיו ה-offset מתחיל לספור מהנקודה שעברנו את הסף
    let target = Math.max(0, dx);
    if (target > MAX_REVEAL) {
      const extra = target - MAX_REVEAL;
      target = MAX_REVEAL + Math.sqrt(extra) * 10;
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
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        if (containerRef.current) containerRef.current.style.transition = "";
      }, duration + 10);
    });
  };

  const slideOutThenCollapse = (slideDuration = 260) => {
    if (!containerRef.current) return;
    setIsRemoving(true);

    const offscreenX = window.innerWidth + 200;
    containerRef.current.style.transition = `transform ${slideDuration}ms ${SNAP_BACK_EASING}, opacity ${Math.min(
      slideDuration,
      220
    )}ms ${SNAP_BACK_EASING}`;
    setOffset(offscreenX);
    containerRef.current.style.opacity = "0";

    setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.style.transition = `height ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, margin ${TRANSITION_MS}ms ${SNAP_BACK_EASING}, padding ${TRANSITION_MS}ms ${SNAP_BACK_EASING}`;
      const h = containerRef.current.offsetHeight;
      containerRef.current.style.height = `${h}px`;
      containerRef.current.offsetHeight;
      containerRef.current.style.height = "0px";
      containerRef.current.style.marginTop = "0px";
      containerRef.current.style.marginBottom = "0px";
      containerRef.current.style.paddingTop = "0px";
      containerRef.current.style.paddingBottom = "0px";
      containerRef.current.style.overflow = "hidden";
      containerRef.current.style.borderWidth = "0px";
    }, slideDuration + 8);

    setTimeout(() => {
      setShowUndoBar(true);
      setIsRemoving(false);
      setIsDeleted(true);
      setUndoCountdown(4);
      
      const countdownInterval = setInterval(() => {
        setUndoCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      undoTimeoutRef.current = setTimeout(() => {
        clearInterval(countdownInterval);
        setShowUndoBar(false);
        onDelete?.();
      }, UNDO_TIMEOUT);
    }, slideDuration + TRANSITION_MS + 40);
  };

  const handleUndo = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setShowUndoBar(false);
    setIsRemoving(false);
    setIsDeleted(false);
    setOffset(0);
    setUndoCountdown(4);
    if (containerRef.current) {
      containerRef.current.style.height = "";
      containerRef.current.style.margin = "";
      containerRef.current.style.padding = "";
      containerRef.current.style.overflow = "";
      containerRef.current.style.opacity = "1";
      containerRef.current.style.borderWidth = "";
      containerRef.current.style.transition = "all 0.3s ease";
    }
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    if (!isDragging || isRemoving || showUndoBar) return;
    setIsDragging(false);
    
    const wasSwipeStarted = isSwipeStarted;
    setIsSwipeStarted(false);

    try {
      (e?.target as Element)?.releasePointerCapture?.((e as any)?.pointerId);
    } catch (err) {}

    // מחיקה רק אם:
    // 1. הסוויפ באמת התחיל (עברנו MIN_SWIPE_DISTANCE)
    // 2. וגם עברנו את סף המרחק או המהירות (אבל לא רק מהירות!)
    const v_px_s = velocity.current * 1000;
    const passedDistanceThreshold = offset > RELEASE_THRESHOLD;
    const passedVelocityThreshold = v_px_s > VELOCITY_THRESHOLD && offset > RELEASE_THRESHOLD * 0.5;
    
    const shouldDelete = wasSwipeStarted && (passedDistanceThreshold || passedVelocityThreshold);

    if (shouldDelete) {
      slideOutThenCollapse(260);
    } else {
      animateSetOffset(0, TRANSITION_MS);
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  if (isDeleted && !showUndoBar) {
    return null;
  }

  const showAction = offset > 0;
  const dangerLabel = offset > RELEASE_THRESHOLD ? "שחרר למחיקה" : "החלק ימינה";
  
  const getBackgroundColor = () => {
    if (offset === 0) return "#fca5a5";
    const progress = Math.min(offset / RELEASE_THRESHOLD, 1);
    const lightR = 252, lightG = 165, lightB = 165;
    const darkR = 239, darkG = 68, darkB = 68;
    
    const r = Math.round(lightR + (darkR - lightR) * progress);
    const g = Math.round(lightG + (darkG - lightG) * progress);
    const b = Math.round(lightB + (darkB - lightB) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDarkerColor = () => {
    if (offset === 0) return "#ef4444";
    const progress = Math.min(offset / RELEASE_THRESHOLD, 1);
    const lightR = 239, lightG = 68, lightB = 68;
    const darkR = 185, darkG = 28, darkB = 28;
    
    const r = Math.round(lightR + (darkR - lightR) * progress);
    const g = Math.round(lightG + (darkG - lightG) * progress);
    const b = Math.round(lightB + (darkB - lightB) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const filteredCategories = categories.filter((c) => c.id !== "all");
  const categoryEmoji = categories.find((c) => c.id === currentCategory)?.emoji;
  const showCategoryEmoji = selectedCategory === "all" && categoryEmoji;

  return (
    <>
      {/* Undo Bar */}
      {showUndoBar && (
        <div 
          className="mb-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 shadow-lg"
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
              <div>
                <div className="font-bold">הפריט נמחק</div>
                <div className="text-sm opacity-90">מחיקה סופית בעוד {undoCountdown} שניות</div>
              </div>
            </div>
            <button
              onClick={handleUndo}
              className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      <div
        className="relative mb-2"
        style={{ 
          zIndex: showMenu ? 100 : "auto", 
          touchAction: "pan-y",
          visibility: isDeleted ? 'hidden' : 'visible',
          height: isDeleted ? 0 : 'auto',
          overflow: isDeleted ? 'hidden' : 'visible',
          marginBottom: isDeleted ? 0 : undefined
        }}
      >
        {/* רקע מגניב עם gradient אנימציה */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, 
              ${getBackgroundColor()} 0%, 
              ${getDarkerColor()} 50%, 
              ${getBackgroundColor()} 100%)`,
            backgroundSize: '200% 200%',
            backgroundPosition: `${offset / 2}px center`,
            transition: isDragging ? "none" : "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: showAction ? 1 : 0,
            transform: `scale(${showAction ? 1 : 0.95})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: "20px",
            direction: 'ltr',
            boxShadow: showAction ? 'inset 0 2px 20px rgba(0,0,0,0.3)' : 'none'
          }}
        >
          {/* אייקון מסתובב */}
          <span 
            style={{ 
              fontSize: 24 + (offset / 5), 
              marginRight: '8px',
              transform: `rotate(${offset * 2}deg) scale(${1 + offset / 200})`,
              transition: isDragging ? "none" : "all 200ms ease-out",
              filter: offset > RELEASE_THRESHOLD ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : 'none'
            }}
          >
            🗑️
          </span>
          
          {/* טקסט עם אפקט זוהר */}
          <span 
            style={{ 
              color: "white", 
              fontWeight: 700, 
              fontSize: 16 + (offset / 15), 
              whiteSpace: 'nowrap',
              textShadow: offset > RELEASE_THRESHOLD 
                ? '0 0 20px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6)' 
                : '0 2px 8px rgba(0,0,0,0.3)',
              transform: `translateX(${offset / 10}px)`,
              transition: isDragging ? "none" : "all 200ms ease-out",
              letterSpacing: offset > RELEASE_THRESHOLD ? '1px' : '0px'
            }}
          >
            {dangerLabel}
          </span>
          
          {/* חלקיקים מרחפים */}
          {offset > 40 && (
            <>
              <div 
                style={{
                  position: 'absolute',
                  left: '10%',
                  top: '20%',
                  width: '8px',
                  height: '8px',
                  background: 'rgba(255,255,255,0.5)',
                  borderRadius: '50%',
                  animation: 'float1 2s ease-in-out infinite',
                  opacity: Math.min(offset / 100, 0.7)
                }}
              />
              <div 
                style={{
                  position: 'absolute',
                  left: '25%',
                  top: '60%',
                  width: '6px',
                  height: '6px',
                  background: 'rgba(255,255,255,0.4)',
                  borderRadius: '50%',
                  animation: 'float2 2.5s ease-in-out infinite',
                  opacity: Math.min(offset / 100, 0.6)
                }}
              />
              <div 
                style={{
                  position: 'absolute',
                  left: '40%',
                  top: '35%',
                  width: '5px',
                  height: '5px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  animation: 'float3 3s ease-in-out infinite',
                  opacity: Math.min(offset / 100, 0.5)
                }}
              />
            </>
          )}
          
          {/* קו זוהר בקצה */}
          <div 
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.8), transparent)',
              opacity: offset > RELEASE_THRESHOLD ? 1 : 0,
              transition: 'opacity 200ms ease-out',
              boxShadow: '0 0 15px rgba(255,255,255,0.8)'
            }}
          />
        </div>

        <div
          ref={containerRef}
          role="listitem"
          tabIndex={0}
          className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 ${isChecked ? "opacity-60" : ""}`}
          style={{
            transform: `translateX(${offset}px)`,
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
              <div className="flex-1 flex items-center justify-between gap-3">
                <div className={`font-medium ${isChecked ? "line-through text-gray-500" : "text-gray-900"}`}>
                  {name}
                  {isManual && <span className="text-xs text-rose-500 mr-2">(ידני)</span>}
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {qty} {unit}
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
                            slideOutThenCollapse(260);
                            setShowMenu(false);
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

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes float1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            25% { transform: translate(10px, -15px) scale(1.2); }
            50% { transform: translate(5px, -25px) scale(0.9); }
            75% { transform: translate(-5px, -15px) scale(1.1); }
          }
          
          @keyframes float2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(-15px, 10px) scale(1.3); }
            66% { transform: translate(-8px, 20px) scale(0.8); }
          }
          
          @keyframes float3 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            40% { transform: translate(12px, -18px) scale(1.1); }
            80% { transform: translate(6px, -8px) scale(0.95); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}} />
      </div>
    </>
  );
}