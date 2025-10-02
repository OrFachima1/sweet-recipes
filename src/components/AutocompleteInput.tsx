"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dictionary: string[];     // מילון הצעות
  className?: string;       // מחלקות ל-input
};

function escapeHtml(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return escapeHtml(text);
  const a = escapeHtml(text.slice(0, i));
  const b = escapeHtml(text.slice(i, i + q.length));
  const c = escapeHtml(text.slice(i + q.length));
  return `${a}<mark>${b}</mark>${c}`;
}

export default function AutocompleteInput({ value, onChange, placeholder, dictionary, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const q = value.trim();
  const list = useMemo(() => {
    if (!q) return [] as string[];
    // קדימות להתחלה-במחרוזת, אחריו מכיל-במחרוזת
    const starts = [] as string[];
    const contains = [] as string[];
    const qlc = q.toLowerCase();
    for (const s of dictionary) {
      const slc = s.toLowerCase();
      if (slc === qlc) continue; // אותו דבר – אין צורך להציע
      if (slc.startsWith(qlc)) starts.push(s);
      else if (slc.includes(qlc)) contains.push(s);
      if (starts.length + contains.length >= 8) break; // עד 8 הצעות
    }
    return [...starts, ...contains];
  }, [q, dictionary]);

  useEffect(() => {
    setActive(0);
    setOpen(list.length > 0);
  }, [list.length]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function accept(idx: number) {
    const s = list[idx];
    if (!s) return;
    onChange(s);
    setOpen(false);
    // קפיצה לסוף
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        const end = s.length;
        el.setSelectionRange(end, end);
      }
    }, 0);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(list.length > 0)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Tab")) {
            // פתח עם ההצעה הראשונה
            if (list.length > 0) setOpen(true);
            return;
          }
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, list.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (list[active]) {
              e.preventDefault();
              accept(active);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-neutral-50 border p-2 ${className}`}
        inputMode="text"
      />
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-2xl border bg-white shadow">
          {list.map((s, idx) => (
            <button
              key={s + idx}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => accept(idx)}
              className={`w-full text-right px-3 py-2 hover:bg-pink-50 ${idx === active ? "bg-pink-50" : ""}`}
              dangerouslySetInnerHTML={{ __html: highlight(s, q) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
