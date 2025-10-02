"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Op = "+" | "-" | "*" | "/" | null;

export default function FloatingCalculator({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  // מיקום החלון (נגרר)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 96, y: 96 });
  const drag = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
  const panelRef = useRef<HTMLDivElement | null>(null);

  function clamp(x: number, y: number) {
    const w = panelRef.current?.offsetWidth ?? 280;
    const h = panelRef.current?.offsetHeight ?? 360;
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1000) - w - 8;
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 1000) - h - 8;
    return { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) };
  }

  // לוגיקת המחשבון
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true); // התחלת מספר חדש

  function fmt(n: number) {
    // הצגה עד 10 ספרות משמעותיות
    const s = Math.abs(n) >= 1e10 ? n.toExponential(6) : String(Math.round(n * 1e10) / 1e10);
    return s;
  }
  function toNum(s: string) {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function apply(a: number, b: number, o: Exclude<Op, null>) {
    if (o === "+") return a + b;
    if (o === "-") return a - b;
    if (o === "*") return a * b;
    return b === 0 ? NaN : a / b;
  }

  function inputDigit(d: string) {
    setDisplay((prev) => {
      if (fresh || prev === "0") {
        setFresh(false);
        return d;
      }
      setFresh(false);
      return prev + d;
    });
  }
  function dot() {
    setDisplay((prev) => {
      if (fresh) {
        setFresh(false);
        return "0.";
      }
      if (prev.includes(".")) return prev;
      return prev + ".";
    });
  }
  function clear() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  }
  function back() {
    setDisplay((prev) => (fresh ? prev : prev.length > 1 ? prev.slice(0, -1) : "0"));
  }
  function setOperator(next: Exclude<Op, null>) {
    const cur = toNum(display);
    if (acc == null) {
      setAcc(cur);
    } else if (!fresh && op) {
      const r = apply(acc, cur, op);
      setAcc(r);
      setDisplay(fmt(r));
    }
    setOp(next);
    setFresh(true);
  }
  function equals() {
    const cur = toNum(display);
    if (acc != null && op) {
      const r = apply(acc, cur, op);
      setDisplay(fmt(r));
      setAcc(null);
      setOp(null);
      setFresh(true);
    }
  }
  function percent() {
    const cur = toNum(display);
    if (acc != null && op) {
      // אחוז יחסי לאגרגט הקודם (כמו במחשבון)
      const r = apply(acc, acc * (cur / 100), op);
      setDisplay(fmt(r));
      setAcc(null);
      setOp(null);
      setFresh(true);
    } else {
      setDisplay(fmt(cur / 100));
      setFresh(true);
    }
  }

  // תמיכה במקלדת כשפתוח
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const k = e.key;
      if (/\d/.test(k)) inputDigit(k);
      else if (k === "." || k === ",") dot();
      else if (k === "+" || k === "-" || k === "*" || k === "/") setOperator(k as any);
      else if (k === "Enter" || k === "=") { e.preventDefault(); equals(); }
      else if (k === "Backspace") back();
      else if (k === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, acc, op, display, fresh]);

  // גרירה של הכותרת
  function onDragStart(e: React.PointerEvent) {
    drag.current.active = true;
    drag.current.dx = e.clientX - pos.x;
    drag.current.dy = e.clientY - pos.y;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const { x, y } = clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy);
    setPos({ x, y });
  }
  function onDragEnd(e: React.PointerEvent) {
    drag.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  }

  return (
    <>
      {/* כפתור פתיחה ליד בית */}
      <button
        type="button"
        aria-label="מחשבון"
        onClick={() => setOpen((v) => !v)}
        className={`fixed left-16 top-3 md:left-20 md:top-4 z-50
                    h-11 w-11 md:h-12 md:w-12 rounded-2xl border shadow
                    bg-white/90 hover:bg-white active:scale-95
                    grid place-items-center backdrop-blur ${className} no-print`}
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* אייקון מחשבון */}
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-pink-600" aria-hidden="true">
          <path fill="currentColor" d="M7 2h10a3 3 0 013 3v14a3 3 0 01-3 3H7a3 3 0 01-3-3V5a3 3 0 013-3zm0 2a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H7zm2 3h6v3H9V7zm0 6h2v2H9v-2zm0 3h2v2H9v-2zm4-3h2v2h-2v-2zm0 3h2v2h-2v-2z"/>
        </svg>
      </button>

      {/* חלון המחשבון */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 no-print rounded-2xl shadow-2xl border bg-white overflow-hidden"
          style={{ left: pos.x, top: pos.y, width: 300 }}
        >
          {/* כותרת – ידית גרירה */}
          <div
            className="cursor-grab active:cursor-grabbing bg-pink-100/80 px-3 py-2 flex items-center justify-between select-none"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="font-semibold text-pink-900">מחשבון</div>
            <button
                className="h-8 w-8 grid place-items-center rounded-xl hover:bg-pink-200/80"
                aria-label="סגור מחשבון"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onMouseDown={(e) => { e.stopPropagation(); }}
                onTouchStart={(e) => { e.stopPropagation(); }}
                >
                ✕
                </button>
          </div>

          {/* תצוגה */}
          <div className="px-3 py-4 text-right">
            <div className="text-3xl font-mono break-all">{display}</div>
            {op && acc != null && (
              <div className="text-xs text-gray-500 mt-1">{fmt(acc)} {op}</div>
            )}
          </div>

          {/* מקשים */}
          <div className="grid grid-cols-4 gap-2 p-3 pt-0">
            <CalcBtn onClick={clear} variant="ghost">C</CalcBtn>
            <CalcBtn onClick={back} variant="ghost">⌫</CalcBtn>
            <CalcBtn onClick={percent} variant="ghost">%</CalcBtn>
            <CalcBtn onClick={() => setOperator("/")} variant="accent">÷</CalcBtn>

            {["7","8","9"].map(n => <CalcBtn key={n} onClick={() => inputDigit(n)}>{n}</CalcBtn>)}
            <CalcBtn onClick={() => setOperator("*")} variant="accent">×</CalcBtn>

            {["4","5","6"].map(n => <CalcBtn key={n} onClick={() => inputDigit(n)}>{n}</CalcBtn>)}
            <CalcBtn onClick={() => setOperator("-")} variant="accent">−</CalcBtn>

            {["1","2","3"].map(n => <CalcBtn key={n} onClick={() => inputDigit(n)}>{n}</CalcBtn>)}
            <CalcBtn onClick={() => setOperator("+")} variant="accent">+</CalcBtn>

            <CalcBtn onClick={() => inputDigit("0")} className="col-span-2">0</CalcBtn>
            <CalcBtn onClick={dot}>.</CalcBtn>
            <CalcBtn onClick={equals} variant="primary">=</CalcBtn>
          </div>
        </div>
      )}
    </>
  );
}

function CalcBtn({
  children,
  onClick,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  variant?: "default" | "accent" | "primary" | "ghost";
}) {
  const base =
    "h-12 rounded-xl text-lg font-semibold select-none active:scale-[0.98] transition";
  const styles: Record<string, string> = {
    default: "bg-neutral-100 hover:bg-neutral-200",
    accent: "bg-pink-100 hover:bg-pink-200 text-pink-900",
    primary: "bg-pink-500 hover:bg-pink-600 text-white",
    ghost: "bg-white hover:bg-neutral-100 border",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}
