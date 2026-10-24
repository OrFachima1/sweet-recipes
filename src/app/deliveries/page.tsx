'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteField, FieldPath,
} from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { useClientsContext } from '@/contexts/ClientsContext';
import { useOrderSettingsContext } from '@/contexts/OrderSettingsContext';
import LoadingScreen from '@/components/LoadingScreen';
import HomeButton from '@/components/HomeButton';
import { displayFont } from '@/lib/fonts';
import { fmtYMD, addDays } from '@/utils/orders';
import type { IngestJsonOrder } from '@/types/orders';

// ─── Firebase: מסמך אחד ליום, orderStates/verification_YYYY-MM-DD ────────────
// { orders: { [orderId]: { checks: { [entryKey]: 'ok' | 'missing' }, doneAt?, doneBy? } } }
type CheckValue = 'ok' | 'missing';
interface OrderVerification {
  checks?: Record<string, CheckValue>;
  doneAt?: number;
  doneBy?: string | null;
}

interface CategoryConfig {
  items: Record<string, { color: string; order: number }>;
  itemMapping: Record<string, string>;
}

interface Entry {
  key: string;
  title: string;
  qty: number;
  unit?: string | null;
  note?: string | null;
  sub?: string;          // לנלווים: בשביל אילו מנות
  section: string;
  color: string;
  isAccessory: boolean;
}

const ACCESSORIES_SECTION = 'נלווים להזמנה';
const ROSE = '#A3204A';
const GREEN = '#1E6B37';
const RED = '#B3261E';

const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDateHebrew = (s: string) =>
  parseYMD(s).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const formatTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const isPickup = (o: IngestJsonOrder) => o.deliveryMethod !== 'delivery';
const methodLabel = (o: IngestJsonOrder) => (isPickup(o) ? 'איסוף' : 'משלוח');

function getOrderNotes(order: IngestJsonOrder): string[] {
  const raw = order.orderNotes;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(n => String(n).trim()).filter(Boolean);
}

// כל מה שצריך לוודא בהזמנה: מנות לפי קטגוריה ואז נלווים מאוחדים
function buildEntries(
  order: IngestJsonOrder,
  dishAccessories: Record<string, string[]>,
  categoryConfig: CategoryConfig | null
): Entry[] {
  const categoryOf = (title: string) => categoryConfig?.itemMapping?.[title] || 'אחר';
  const colorOf = (cat: string) => categoryConfig?.items?.[cat]?.color || '#E5E0DE';
  const catOrder = (cat: string) => categoryConfig?.items?.[cat]?.order ?? Number.MAX_SAFE_INTEGER;

  const items: Entry[] = (order.items || []).map((item, idx) => {
    const section = categoryOf(item.title);
    return {
      key: `i:${idx}:${item.title}`,
      title: item.title,
      qty: Number(item.qty) || 1,
      unit: item.unit,
      note: item.notes,
      section,
      color: colorOf(section),
      isAccessory: false,
    };
  });
  items.sort((a, b) => catOrder(a.section) - catOrder(b.section));

  // נלווים: איחוד מכל המנות, כמו במסך הקודם (כולל מגש וכפפות לכל הזמנה עם סלט)
  const acc = new Map<string, { dishes: string[]; qty: number }>();
  for (const item of order.items || []) {
    for (const name of dishAccessories[item.title] || []) {
      const a = acc.get(name) ?? { dishes: [], qty: 0 };
      a.dishes.push(item.title);
      a.qty += Number(item.qty) || 1;
      acc.set(name, a);
    }
  }
  const salads = (order.items || []).filter(i => i.title.startsWith('סלט')).map(i => i.title);
  if (salads.length) {
    for (const name of ['מגש אלומיניום', 'כפפות']) {
      if (!acc.has(name)) acc.set(name, { dishes: salads, qty: 1 });
    }
  }
  const accessories: Entry[] = [...acc.entries()].map(([name, a]) => ({
    key: `a:${name}`,
    title: name,
    qty: a.qty,
    sub: `בשביל ${[...new Set(a.dishes)].join(' ו')}`,
    section: ACCESSORIES_SECTION,
    color: '#F2EAE7',
    isAccessory: true,
  }));

  return [...items, ...accessories];
}

function summarize(entries: Entry[], v?: OrderVerification) {
  const checks = v?.checks || {};
  let ok = 0;
  let missing = 0;
  for (const e of entries) {
    if (checks[e.key] === 'ok') ok++;
    else if (checks[e.key] === 'missing') missing++;
  }
  const total = entries.length;
  return { ok, missing, decided: ok + missing, total, complete: total > 0 && ok + missing === total };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const router = useRouter();
  const { user, loading: userLoading, role, displayName } = useAuth();
  const { getClientColor } = useClientsContext();
  const { dishAccessories, categoryConfig } = useOrderSettingsContext();

  const today = fmtYMD(new Date());
  const tomorrow = fmtYMD(addDays(new Date(), 1));

  const [selectedDate, setSelectedDate] = useState(today);
  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<Record<string, OrderVerification>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [justDone, setJustDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const isAuthorized = role === 'manager' || role === 'senior_worker' || role === 'worker';

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (role == null) return;
    if (!isAuthorized) router.replace('/no-access');
  }, [userLoading, user, role, isAuthorized, router]);

  // הזמנות היום הנבחר — טווח ולא שוויון, כי eventDate נשמר גם כ-"YYYY-MM-DDTHH:MM:SS"
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const nextDay = fmtYMD(addDays(parseYMD(selectedDate), 1));
    const unsub = onSnapshot(
      query(collection(db, 'orders'), where('eventDate', '>=', selectedDate), where('eventDate', '<', nextDay)),
      (snap) => {
        const list = snap.docs
          .map(d => ({ __id: d.id, ...(d.data() as Omit<IngestJsonOrder, '__id'>) }))
          .map(o => ({ ...o, items: o.items || [] }));
        list.sort((a, b) => {
          if (!a.estimatedTime) return 1;
          if (!b.estimatedTime) return -1;
          return a.estimatedTime.localeCompare(b.estimatedTime);
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => { console.error('Failed loading orders', err); setLoading(false); }
    );
    return () => unsub();
  }, [user, selectedDate]);

  const verificationRef = useMemo(() => doc(db, 'orderStates', `verification_${selectedDate}`), [selectedDate]);
  useEffect(() => {
    if (!user) return;
    setVerification({});
    const unsub = onSnapshot(
      verificationRef,
      (snap) => setVerification((snap.data()?.orders as Record<string, OrderVerification>) || {}),
      (err) => console.error('Failed loading verification', err)
    );
    return () => unsub();
  }, [user, verificationRef]);

  useEffect(() => {
    setSelectedId(null);
    setJustDone(null);
  }, [selectedDate]);

  const entriesById = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const o of orders) map[o.__id!] = buildEntries(o, dishAccessories, categoryConfig);
    return map;
  }, [orders, dishAccessories, categoryConfig]);

  const summaries = useMemo(() => {
    const map: Record<string, ReturnType<typeof summarize>> = {};
    for (const o of orders) map[o.__id!] = summarize(entriesById[o.__id!], verification[o.__id!]);
    return map;
  }, [orders, entriesById, verification]);

  // במחשב: פותחים ישר את ההזמנה הראשונה שלא נבדקה
  useEffect(() => {
    if (selectedId || loading || !orders.length) return;
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 768px)').matches) return;
    const first = orders.find(o => !summaries[o.__id!]?.complete) ?? orders[0];
    setSelectedId(first.__id!);
  }, [selectedId, loading, orders, summaries]);

  const setCheck = useCallback(async (orderId: string, key: string, value: CheckValue | null) => {
    setError(null);
    const entries = entriesById[orderId] || [];
    const nextChecks = { ...(verification[orderId]?.checks || {}) };
    if (value) nextChecks[key] = value; else delete nextChecks[key];
    const wasComplete = summaries[orderId]?.complete;
    const nowComplete = summarize(entries, { checks: nextChecks }).complete;
    try {
      if (value) {
        await setDoc(verificationRef, { orders: { [orderId]: { checks: { [key]: value } } } }, { merge: true });
      } else {
        await updateDoc(verificationRef, new FieldPath('orders', orderId, 'checks', key), deleteField());
      }
      if (nowComplete && !wasComplete) {
        await setDoc(
          verificationRef,
          { orders: { [orderId]: { doneAt: Date.now(), doneBy: displayName || user?.email || null } } },
          { merge: true }
        );
        setJustDone(orderId);
        try { navigator.vibrate?.([30, 50, 90]); } catch {}
      } else if (!nowComplete && wasComplete) {
        await updateDoc(verificationRef, new FieldPath('orders', orderId, 'doneAt'), deleteField());
        setJustDone(null);
      } else {
        try { navigator.vibrate?.(12); } catch {}
      }
    } catch (e) {
      console.error(e);
      setError('הסימון לא נשמר. בדקו את החיבור ונסו שוב.');
    }
  }, [entriesById, verification, summaries, verificationRef, displayName, user]);

  const markAllOk = useCallback(async (orderId: string) => {
    setError(null);
    const checks: Record<string, CheckValue> = {};
    for (const e of entriesById[orderId] || []) checks[e.key] = verification[orderId]?.checks?.[e.key] || 'ok';
    try {
      await setDoc(
        verificationRef,
        { orders: { [orderId]: { checks, doneAt: Date.now(), doneBy: displayName || user?.email || null } } },
        { merge: true }
      );
      setJustDone(orderId);
      try { navigator.vibrate?.([30, 50, 90]); } catch {}
    } catch (e) {
      console.error(e);
      setError('הסימון לא נשמר. בדקו את החיבור ונסו שוב.');
    }
  }, [entriesById, verification, verificationRef, displayName, user]);

  const restart = useCallback(async (orderId: string) => {
    setError(null);
    try {
      await updateDoc(verificationRef, new FieldPath('orders', orderId), deleteField());
      setJustDone(null);
    } catch (e) {
      console.error(e);
      setError('האיפוס לא נשמר. בדקו את החיבור ונסו שוב.');
    }
  }, [verificationRef]);

  if (userLoading || !user || role == null) return <LoadingScreen />;
  if (!isAuthorized) return null;

  const visible = orders.filter(o => {
    const s = summaries[o.__id!];
    if (statusFilter === 'todo' && s?.complete) return false;
    if (statusFilter === 'done' && !s?.complete) return false;
    if (typeFilter === 'delivery' && isPickup(o)) return false;
    if (typeFilter === 'pickup' && !isPickup(o)) return false;
    return true;
  });
  const doneCount = orders.filter(o => summaries[o.__id!]?.complete).length;
  const selected = orders.find(o => o.__id === selectedId) || null;

  const seg = (on: boolean) =>
    `h-10 flex-1 rounded-[10px] px-2 text-[15px] ${on ? 'bg-white font-bold text-[#231C1C]' : 'text-[#4D4342]'}`;
  const chip = (on: boolean) =>
    `h-9 rounded-full px-3.5 text-sm ${on ? 'bg-[#231C1C] font-semibold text-white' : 'border border-[#E3D8DC] bg-white text-[#4D4342]'}`;

  return (
    <div className="vf-page min-h-screen bg-[#F7F3F1] text-[#231C1C]" dir="rtl">
      <HomeButton />
      <div className="md:grid md:min-h-screen md:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">

        {/* Queue */}
        <aside
          aria-label="הזמנות היום"
          className={`${selected ? 'hidden md:flex' : 'flex'} flex-col gap-4 px-4 pb-8 pt-16 md:border-l md:border-[#EAE1DE]`}
        >
          <div className="flex flex-col gap-0.5">
            <div className="text-[15px] text-[#6E6260]">{formatDateHebrew(selectedDate)}</div>
            <h1 className={`${displayFont.className} text-balance text-[32px] font-semibold leading-tight`}>וידוא הזמנות</h1>
            <div className="text-base tabular-nums text-[#4D4342]">
              {loading
                ? 'טוען הזמנות…'
                : orders.length === 0
                  ? 'אין הזמנות ביום הזה'
                  : doneCount === orders.length
                    ? `כל ${orders.length} ההזמנות נבדקו`
                    : `נשארו לבדוק ${orders.length - doneCount} מתוך ${orders.length}`}
            </div>
          </div>

          <div className="flex gap-1 rounded-[14px] bg-[#EDE5E2] p-1">
            <button aria-pressed={selectedDate === today} onClick={() => setSelectedDate(today)} className={seg(selectedDate === today)}>היום</button>
            <button aria-pressed={selectedDate === tomorrow} onClick={() => setSelectedDate(tomorrow)} className={seg(selectedDate === tomorrow)}>מחר</button>
            <label className={`relative flex h-10 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[#4D4342] ${selectedDate !== today && selectedDate !== tomorrow ? 'bg-white' : ''}`}>
              <span className="sr-only">תאריך אחר</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                onClick={() => { try { dateInputRef.current?.showPicker(); } catch {} }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <div role="group" aria-label="סינון לפי מצב" className="flex gap-1 rounded-[14px] bg-[#EDE5E2] p-1">
              {([['all', 'הכל'], ['todo', 'לבדיקה'], ['done', 'נבדקו']] as const).map(([v, l]) => (
                <button key={v} aria-pressed={statusFilter === v} onClick={() => setStatusFilter(v)} className={seg(statusFilter === v)}>{l}</button>
              ))}
            </div>
            <div role="group" aria-label="סינון לפי סוג" className="flex gap-1.5">
              {([['all', 'כל הסוגים'], ['delivery', 'משלוחים'], ['pickup', 'איסופים']] as const).map(([v, l]) => (
                <button key={v} aria-pressed={typeFilter === v} onClick={() => setTypeFilter(v)} className={chip(typeFilter === v)}>{l}</button>
              ))}
            </div>
          </div>

          {!loading && visible.length === 0 && orders.length > 0 && (
            <p className="py-6 text-center text-[15px] text-[#6E6260]">אין הזמנות שמתאימות לסינון</p>
          )}

          <ol className="flex flex-col gap-1">
            {visible.map(o => {
              const s = summaries[o.__id!];
              const current = o.__id === selectedId;
              return (
                <li key={o.__id}>
                  <button
                    onClick={() => { setSelectedId(o.__id!); setJustDone(null); }}
                    aria-current={current}
                    className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition-colors hover:bg-[#F0E8E5] ${
                      current ? 'bg-white shadow-[0_0_0_2px_#A3204A] hover:bg-white' : ''
                    }`}
                  >
                    <span className={`${displayFont.className} w-[52px] flex-shrink-0 text-xl font-semibold tabular-nums ${s?.complete ? 'text-[#8C807E]' : ''}`}>
                      {o.estimatedTime || '—'}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: o.clientColor || getClientColor(o.clientName) }} />
                        <span className="truncate text-[17px] font-semibold">{o.clientName}</span>
                      </span>
                      <span className="text-sm text-[#6E6260]">{methodLabel(o)}</span>
                      {s && s.decided > 0 && !s.complete && (
                        <span aria-hidden="true" className="block h-1 overflow-hidden rounded-sm bg-[#E3D9D6]">
                          <span className="block h-1 rounded-sm" style={{ width: `${Math.round((s.decided / s.total) * 100)}%`, backgroundColor: ROSE }} />
                        </span>
                      )}
                    </span>
                    {s?.complete ? (
                      <span
                        className={`${displayFont.className} flex-shrink-0 -rotate-6 rounded-full border-2 border-current px-2.5 py-px text-sm font-semibold`}
                        style={{ color: s.missing ? RED : ROSE }}
                      >
                        {s.missing ? `חסר ${s.missing}` : 'נבדקה'}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-sm tabular-nums text-[#4D4342]">{s ? `${s.decided} מתוך ${s.total}` : ''}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Detail */}
        <main className={`${selected ? 'block' : 'hidden md:block'} min-w-0 bg-white`}>
          {!selected ? (
            <div className="flex min-h-[60vh] items-center justify-center p-6 text-center text-[17px] text-[#6E6260]">
              {loading ? 'טוען…' : orders.length ? 'בחרו הזמנה מהרשימה כדי לבדוק אותה' : 'אין הזמנות לבדוק ביום הזה'}
            </div>
          ) : (
            <VerificationPanel
              key={selected.__id}
              order={selected}
              entries={entriesById[selected.__id!] || []}
              verification={verification[selected.__id!]}
              justDone={justDone === selected.__id}
              error={error}
              nextOrder={(() => {
                const idx = orders.indexOf(selected);
                return orders.slice(idx + 1).concat(orders.slice(0, idx)).find(o => !summaries[o.__id!]?.complete) || null;
              })()}
              onBack={() => { setSelectedId(null); setJustDone(null); }}
              onNext={(id) => { setSelectedId(id); setJustDone(null); }}
              onCheck={(key, value) => setCheck(selected.__id!, key, value)}
              onAllOk={() => markAllOk(selected.__id!)}
              onRestart={() => restart(selected.__id!)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Verification panel ───────────────────────────────────────────────────────

function VerificationPanel({
  order, entries, verification, justDone, error, nextOrder, onBack, onNext, onCheck, onAllOk, onRestart,
}: {
  order: IngestJsonOrder;
  entries: Entry[];
  verification?: OrderVerification;
  justDone: boolean;
  error: string | null;
  nextOrder: IngestJsonOrder | null;
  onBack: () => void;
  onNext: (id: string) => void;
  onCheck: (key: string, value: CheckValue | null) => void;
  onAllOk: () => void;
  onRestart: () => void;
}) {
  const checks = verification?.checks || {};
  const s = summarize(entries, verification);
  const notes = getOrderNotes(order);
  const sections: Array<{ name: string; color: string; entries: Entry[] }> = [];
  for (const e of entries) {
    const last = sections[sections.length - 1];
    if (last && last.name === e.section) last.entries.push(e);
    else sections.push({ name: e.section, color: e.color, entries: [e] });
  }
  const missingEntries = entries.filter(e => checks[e.key] === 'missing');
  const thin = entries.length > 30;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-5 px-5 pb-10 pt-16 md:pt-6">
      <div className="flex flex-col gap-1">
        <button onClick={onBack} className="-mt-2 flex h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-[#4D4342] md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          כל ההזמנות
        </button>
        <h2 className={`${displayFont.className} text-balance break-words text-[34px] font-semibold leading-tight`}>{order.clientName}</h2>
        <div className="text-base text-[#4D4342]">
          {methodLabel(order)}{order.estimatedTime ? ` בשעה ${order.estimatedTime}` : ''}
        </div>
      </div>

      {notes.length > 0 && (
        <div className="rounded-2xl bg-[#FBF6E6] px-4 py-3 text-base leading-relaxed">
          <div className="mb-0.5 text-[13px] font-bold text-[#6E5A1E]">הערה להזמנה</div>
          <div className="whitespace-pre-line">{notes.join('\n')}</div>
        </div>
      )}

      {error && <div role="alert" className="rounded-2xl bg-[#FBEAE8] px-4 py-3 text-[15px] text-[#8B1E16]">{error}</div>}

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span aria-live="polite" className={`${displayFont.className} text-[22px] font-semibold tabular-nums`}>
            {s.complete
              ? s.missing ? 'נבדקה, עם חוסרים' : `הכל קיים, ${s.total} מתוך ${s.total}`
              : `${s.decided} מתוך ${s.total} נבדקו`}
          </span>
          {s.missing > 0 ? (
            <span className="text-[15px] font-bold tabular-nums" style={{ color: RED }}>
              {s.missing === 1 ? 'פריט אחד חסר' : `${s.missing} פריטים חסרים`}
            </span>
          ) : !s.complete && s.total > 0 ? (
            <button onClick={onAllOk} className="h-10 rounded-[10px] bg-[#F2EAE7] px-3 text-[15px] font-semibold text-[#4D4342]">
              הכל קיים
            </button>
          ) : null}
        </div>
        <div aria-hidden="true" className={`flex ${thin ? 'gap-px' : 'gap-[3px]'}`}>
          {entries.map((e, i) => {
            const v = checks[e.key];
            return (
              <span
                key={e.key}
                className={`h-2.5 flex-1 rounded-[3px] transition-colors duration-300 ${s.complete && justDone ? 'vf-wave' : ''}`}
                style={{
                  animationDelay: `${i * (thin ? 12 : 28)}ms`,
                  backgroundColor: v === 'missing' ? RED : v === 'ok' ? (s.complete ? GREEN : ROSE) : '#EDE5E2',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Checklist */}
      {sections.map(sec => (
        <section key={sec.name} aria-label={sec.name} className="flex flex-col">
          <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-[#4D4342]">
            <span
              aria-hidden="true"
              className={`h-3 w-3 ${sec.name === ACCESSORIES_SECTION ? 'rounded-full border-2' : 'rounded'}`}
              style={sec.name === ACCESSORIES_SECTION ? { borderColor: ROSE } : { backgroundColor: sec.color }}
            />
            {sec.name}
          </h3>
          {sec.entries.map(e => {
            const v = checks[e.key];
            const ok = v === 'ok';
            const missing = v === 'missing';
            return (
              <div
                key={e.key}
                className={`-mx-3 flex items-center gap-2 rounded-2xl px-3 py-1 transition-colors ${ok ? 'bg-[#F1F7F2]' : missing ? 'bg-[#FCEBE9]' : ''}`}
              >
                <button
                  onClick={() => onCheck(e.key, ok ? null : 'ok')}
                  aria-pressed={ok}
                  className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3.5 rounded-xl text-right hover:opacity-90 active:scale-[.99]"
                >
                  <span
                    aria-hidden="true"
                    className={`box-border flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full ${ok || missing ? '' : 'border-[2.5px] border-[#B8ABA8]'}`}
                    style={ok ? { backgroundColor: GREEN } : missing ? { backgroundColor: RED } : undefined}
                  >
                    {ok && (
                      <svg className="vf-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                    )}
                    {missing && (
                      <svg className="vf-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-lg ${ok ? 'text-[#6E6260]' : 'font-medium'}`}>{e.title}</span>
                    {e.note && (
                      <span className="self-start rounded-lg bg-[#FBF6E6] px-2 py-0.5 text-sm text-[#6E5A1E]">{e.note}</span>
                    )}
                    {e.sub && <span className="text-sm text-[#6E6260]">{e.sub}</span>}
                  </span>
                  <span className={`${displayFont.className} flex-shrink-0 text-xl font-semibold tabular-nums ${ok ? 'text-[#8C807E]' : ''}`}>
                    × {e.qty}{e.unit ? ` ${e.unit}` : ''}
                  </span>
                </button>
                <button
                  onClick={() => onCheck(e.key, missing ? null : 'missing')}
                  aria-pressed={missing}
                  aria-label={`סימון ${e.title} כחסר`}
                  className={`h-10 flex-shrink-0 rounded-xl px-3 text-sm font-bold ${
                    missing ? 'text-white' : 'bg-white shadow-[inset_0_0_0_1.5px_#F0C3BE]'
                  }`}
                  style={missing ? { backgroundColor: RED } : { color: RED }}
                >
                  חסר
                </button>
              </div>
            );
          })}
        </section>
      ))}

      {s.total === 0 && <p className="text-center text-[15px] text-[#6E6260]">אין פריטים בהזמנה הזו</p>}

      {/* Done */}
      {s.complete && (
        <div className="flex flex-col items-center gap-4 pt-1">
          <div
            role="img"
            aria-label={s.missing ? 'ההזמנה נבדקה עם חוסרים' : 'ההזמנה נבדקה, הכל קיים'}
            className={`${displayFont.className} ${justDone ? 'vf-stamp' : ''} flex h-[136px] w-[136px] -rotate-[9deg] flex-col items-center justify-center rounded-full border-[5px] border-current leading-none`}
            style={{ color: s.missing ? RED : ROSE, boxShadow: 'inset 0 0 0 5px #fff, inset 0 0 0 8px currentColor' }}
          >
            <span className="text-[30px] font-bold">{s.missing ? `חסר ${s.missing}` : 'נבדקה'}</span>
            <span className="mt-1 text-sm font-medium tabular-nums">
              {s.missing ? 'להשלים' : verification?.doneAt ? formatTime(verification.doneAt) : ''}
            </span>
          </div>

          {missingEntries.length > 0 && (
            <div className={`${justDone ? 'vf-rise' : ''} flex w-full flex-col gap-1 rounded-[20px] bg-[#FCEBE9] px-4 py-3.5`}>
              <div className="text-[15px] font-bold text-[#8E1F18]">חסר בהזמנה, צריך להשלים לפני שהיא יוצאת</div>
              {missingEntries.map(e => (
                <div key={e.key} className="flex min-h-[48px] items-center justify-between gap-2 border-t border-[#F6D4D0]">
                  <span className="text-[17px] font-semibold">
                    {e.title} <span className="font-medium tabular-nums text-[#6E3A35]">× {e.qty}</span>
                  </span>
                  <button onClick={() => onCheck(e.key, 'ok')} className="h-10 rounded-xl bg-white px-3 text-[15px] font-semibold" style={{ color: GREEN }}>
                    נמצא, קיים
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={`${justDone ? 'vf-rise' : ''} flex w-full flex-col gap-2`}>
            {nextOrder ? (
              <button
                onClick={() => onNext(nextOrder.__id!)}
                className="flex h-[62px] items-center justify-center gap-2.5 rounded-[20px] bg-[#231C1C] text-lg font-bold text-white transition-transform active:scale-[.97]"
              >
                להזמנה הבאה: {nextOrder.clientName}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
            ) : (
              <div className={`${displayFont.className} py-1.5 text-center text-[22px] font-semibold`} style={{ color: GREEN }}>
                כל ההזמנות של היום נבדקו
              </div>
            )}
            <button
              onClick={() => { if (window.confirm('לבדוק את ההזמנה מחדש? כל הסימונים שלה יימחקו.')) onRestart(); }}
              className="h-11 rounded-xl text-[15px] font-semibold text-[#4D4342] hover:bg-[#F2EAE7]"
            >
              בדיקה מחדש
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
