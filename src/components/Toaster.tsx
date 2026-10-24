'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from '@/lib/toast';

const EMPTY: ToastItem[] = [];

function ToastRow({ t }: { t: ToastItem }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  const icon =
    t.tone === 'success' ? (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7FD39A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
    ) : t.tone === 'error' ? (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9A8F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
    ) : (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9BFBD" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" /></svg>
    );

  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      className="toast-in pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-[#231C1C] py-2 pl-2 pr-4 text-white shadow-[0_10px_30px_rgba(35,28,28,0.28)]"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 whitespace-pre-line py-1.5 text-[15px] leading-snug">{t.message}</span>
      {t.action && (
        <button
          onClick={() => { t.action!.onClick(); dismissToast(t.id); }}
          className="h-10 flex-shrink-0 rounded-xl px-3 text-[15px] font-bold text-[#FFB4C8] hover:bg-white/10"
        >
          {t.action.label}
        </button>
      )}
      <button
        onClick={() => dismissToast(t.id)}
        aria-label="סגירת ההודעה"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

// מוצג פעם אחת ב-layout. הודעות נוצרות דרך toast.success / toast.error / toast.info
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  return (
    <div
      dir="rtl"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center gap-2 px-4"
      // --toast-offset: מסכים עם פס קבוע בתחתית מרימים את ההודעות מעליו
      style={{ paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + var(--toast-offset, 0px))' }}
    >
      <div className="flex w-full max-w-md flex-col gap-2">
        {toasts.map(t => <ToastRow key={t.id} t={t} />)}
      </div>
    </div>
  );
}
