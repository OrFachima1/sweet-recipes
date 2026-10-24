// src/lib/toast.ts
// הודעות קצרות שלא חוסמות את המסך (במקום alert). אפשר לקרוא מכל מקום — קומפוננטה, hook או פונקציה.
// מוצגות על ידי <Toaster /> ב-layout.

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastOptions {
  action?: ToastItem['action'];
  duration?: number;
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION: Record<ToastTone, number> = { success: 3000, info: 4000, error: 6000 };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getToasts() {
  return items;
}

export function dismissToast(id: number) {
  const next = items.filter(t => t.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

function show(tone: ToastTone, message: string, opts: ToastOptions = {}) {
  const item: ToastItem = {
    id: nextId++,
    message,
    tone,
    action: opts.action,
    // הודעה עם כפתור (למשל "ביטול") נשארת יותר זמן כדי שיהיה זמן ללחוץ
    duration: opts.duration ?? (opts.action ? 7000 : DEFAULT_DURATION[tone]),
  };
  items = [...items, item].slice(-MAX_VISIBLE);
  emit();
  return item.id;
}

export const toast = {
  success: (message: string, opts?: ToastOptions) => show('success', message, opts),
  error: (message: string, opts?: ToastOptions) => show('error', message, opts),
  info: (message: string, opts?: ToastOptions) => show('info', message, opts),
  dismiss: dismissToast,
};
