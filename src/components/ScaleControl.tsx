"use client";
import { useRef } from "react";

export default function ScaleControl({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectAll = () => setTimeout(() => inputRef.current?.select(), 0);
  const step = (d: number) => {
    const next = Math.max(0, Math.round((value + d) * 100) / 100); // קפיצות וקלמפ ל-0
    onChange(next);
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <BumpButton color="green" label="הוסף 0.25" onClick={() => step(+0.25)}>
        <IconPlus />
      </BumpButton>

      <input
        ref={inputRef}
        inputMode="decimal"
        type="text"
        dir="ltr"
        value={String(Math.round(value * 100) / 100)}
        onFocus={selectAll}
        onClick={selectAll}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          const v = Number(raw);
          onChange(!Number.isFinite(v) || v < 0 ? 0 : v);
        }}
        className="h-9 w-12 rounded-xl text-center font-mono text-base leading-none px-2
                   border border-black/5 bg-white/90
                   shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
        title="מקדם הכפלה"
        aria-label="מקדם הכפלה"
      />

      <BumpButton color="red" label="הפחת 0.25" onClick={() => step(-0.25)}>
        <IconMinus />
      </BumpButton>
    </div>
  );
}

function BumpButton({
  onClick, label, color = "green", children,
}: {
  onClick: () => void;
  label: string;
  color?: "green" | "red";
  children: React.ReactNode;
}) {
  const palette =
    color === "green"
      ? {
          ring: "focus-visible:ring-emerald-400",
          grad: "from-emerald-50 to-emerald-100",
          border: "border-emerald-200",
          text: "text-emerald-700",
          shadow: "shadow-[0_2px_4px_rgba(16,185,129,0.15),0_10px_20px_rgba(16,185,129,0.15)]",
          hover: "hover:from-emerald-50 hover:to-emerald-200",
        }
      : {
          ring: "focus-visible:ring-rose-400",
          grad: "from-rose-50 to-rose-100",
          border: "border-rose-200",
          text: "text-rose-700",
          shadow: "shadow-[0_2px_4px_rgba(244,63,94,0.15),0_10px_20px_rgba(244,63,94,0.15)]",
          hover: "hover:from-rose-50 hover:to-rose-200",
        };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "relative h-9 w-9 shrink-0 rounded-2xl",
        `bg-gradient-to-b ${palette.grad} border ${palette.border}`,
        palette.shadow,
        palette.text,
        "transition-all duration-150 active:translate-y-[1px] active:shadow-[0_1px_2px_rgba(0,0,0,0.20)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        palette.ring,
        palette.hover,
      ].join(" ")}
    >
      <span className="pointer-events-none absolute inset-px rounded-2xl bg-gradient-to-b from-white/70 to-white/0" />
      <span className="relative grid place-items-center">{children}</span>
    </button>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconMinus() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
