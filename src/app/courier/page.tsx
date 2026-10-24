'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteField, FieldPath,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useClientsContext } from '@/contexts/ClientsContext';
import { logout } from '@/lib/auth';
import { fmtYMD, addDays } from '@/utils/orders';
import LoadingScreen from '@/components/LoadingScreen';
import { displayFont as display } from '@/lib/fonts';
import type { IngestJsonOrder } from '@/types/orders';

const ROSE = '#A3204A';
const GREEN = '#2E8B4E';
const TRACK = '#E3D9D6';
const UNDO_MS = 6000;

// סימון "נמסר" — מסמך אחד ליום: orderStates/deliveries_YYYY-MM-DD
// (לא orderStates/current: מסך ההכנה כותב אותו מחדש בשלמותו)
interface DeliveryMark {
  at: number;
  by: string;
  byName: string | null;
}

const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function formatDateHebrew(dateStr: string): string {
  return parseYMD(dateStr).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const money = (v: number) => `₪${Math.round(v).toLocaleString('he-IL')}`;

// orderNotes נשמר כמחרוזת או כמערך שורות
function getOrderNotes(order: IngestJsonOrder): string[] {
  const raw = order.orderNotes;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(n => String(n).trim()).filter(Boolean);
}

// יתרה לגבייה: null כשאין סכום להזמנה
function getBalance(order: IngestJsonOrder): number | null {
  if (order.totalSum == null) return null;
  return order.totalSum - (order.deposit ?? 0);
}

function cityOf(address?: string | null) {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : address;
}

// סימוני "הועמס לרכב" נשמרים במכשיר של השליח
function useLoadedItems(orderId: string) {
  const key = `courier.loaded.${orderId}`;
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setLoaded(raw ? JSON.parse(raw) : {});
    } catch {
      setLoaded({});
    }
  }, [key]);
  const toggle = (idx: number) => {
    setLoaded(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return { loaded, toggle };
}

function ItemsChecklist({ order }: { order: IngestJsonOrder }) {
  const { loaded, toggle } = useLoadedItems(order.__id!);
  const count = order.items.filter((_, i) => loaded[i]).length;
  return (
    <div className="flex flex-col">
      <div className="pb-1 text-sm tabular-nums text-[#6E6260]">
        {count} מתוך {order.items.length} הועמסו לרכב
      </div>
      {order.items.map((item, idx) => {
        const on = !!loaded[idx];
        return (
          <button
            key={idx}
            onClick={() => toggle(idx)}
            aria-pressed={on}
            className="flex min-h-[50px] w-full items-center gap-3 border-t border-[#F0E8E5] text-right"
          >
            <span
              aria-hidden="true"
              className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg border-2 ${
                on ? 'border-[#1E6B37] bg-[#1E6B37]' : 'border-[#B8ABA8]'
              }`}
            >
              {on && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              )}
            </span>
            <span className={`flex-1 text-[17px] ${on ? 'text-[#8C807E] line-through' : 'font-medium text-[#231C1C]'}`}>
              {item.title}
              {item.notes && <span className="block text-sm text-[#6E6260] no-underline">{item.notes}</span>}
            </span>
            <span className="text-base font-bold tabular-nums text-[#4D4342]">
              × {item.qty}{item.unit ? ` ${item.unit}` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Current / open stop ──────────────────────────────────────────────────────

function OpenStop({
  order, color, onDelivered,
}: { order: IngestJsonOrder; color: string; onDelivered: () => void }) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const notes = getOrderNotes(order);
  const balance = getBalance(order);
  const phones = [
    order.phone1 && { number: order.phone1, name: order.phone1Name },
    order.phone2 && { number: order.phone2, name: order.phone2Name },
  ].filter(Boolean) as Array<{ number: string; name?: string | null }>;
  const [mainPhone, ...otherPhones] = phones;

  return (
    <section aria-label={order.clientName} className="mt-0.5 flex flex-col gap-3.5 rounded-[22px] bg-white p-4 shadow-[0_1px_0_#E7DDDA]">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <h2 className={`${display.className} text-[27px] font-semibold leading-tight`}>{order.clientName}</h2>
        </div>
        <div className="text-[17px] leading-snug">{order.address || 'אין כתובת להזמנה'}</div>
        <div className="text-[15px] text-[#6E6260]">{order.items.length} מנות בהזמנה</div>
      </div>

      {balance != null && balance > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-[#FFF1DE] px-3.5 py-2.5">
          <span className="text-base text-[#6B3A00]">לגבות מהלקוח</span>
          <span className={`${display.className} text-2xl font-semibold tabular-nums text-[#8A4B00]`}>{money(balance)}</span>
        </div>
      )}
      {balance != null && balance <= 0 && (
        <div className="text-base font-semibold text-[#1E6B37]">שולם מראש, אין מה לגבות</div>
      )}

      {notes.length > 0 && (
        <div className="rounded-2xl bg-[#FBF6E6] px-3.5 py-2.5 text-base leading-relaxed">
          <div className="mb-0.5 text-[13px] font-bold text-[#6E5A1E]">הערה להזמנה</div>
          <div className="whitespace-pre-line">{notes.join('\n')}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {order.address ? (
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(order.address)}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`ניווט אל ${order.address}`}
            className="flex h-[54px] items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-white"
            style={{ backgroundColor: ROSE }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z" /></svg>
            ניווט
          </a>
        ) : (
          <span className="flex h-[54px] items-center justify-center rounded-2xl bg-[#F2EAE7] text-[15px] text-[#6E6260]">אין כתובת</span>
        )}
        {mainPhone ? (
          <a
            href={`tel:${mainPhone.number}`}
            aria-label={`חיוג אל ${mainPhone.name || mainPhone.number}`}
            className="flex h-[54px] min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#F2EAE7] px-2 text-[17px] font-semibold"
          >
            <svg className="flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z" /></svg>
            <span className="truncate">{mainPhone.name || 'חיוג'}</span>
          </a>
        ) : (
          <span className="flex h-[54px] items-center justify-center rounded-2xl bg-[#F2EAE7] text-[15px] text-[#6E6260]">אין טלפון</span>
        )}
      </div>
      {otherPhones.map(p => (
        <a key={p.number} href={`tel:${p.number}`} className="-mt-1.5 flex min-h-[44px] items-center gap-2 text-base" style={{ color: ROSE }}>
          טלפון נוסף{p.name ? `: ${p.name}` : ''} <span dir="ltr" className="tabular-nums">{p.number}</span>
        </a>
      ))}

      {itemsOpen && <ItemsChecklist order={order} />}

      <div className="flex gap-2">
        <button
          onClick={() => setItemsOpen(v => !v)}
          aria-expanded={itemsOpen}
          className="h-14 rounded-2xl bg-[#F2EAE7] px-3.5 text-[15px] font-semibold text-[#4D4342]"
        >
          {itemsOpen ? 'הסתרת פריטים' : 'פריטים'}
        </button>
        <button
          onClick={onDelivered}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1E6B37] text-lg font-bold text-white active:bg-[#17552B]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          נמסר ללקוח
        </button>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CourierPage() {
  const router = useRouter();
  const { user, loading: authLoading, role, displayName } = useAuth();
  const { getClientColor } = useClientsContext();

  const today = fmtYMD(new Date());
  const tomorrow = fmtYMD(addDays(new Date(), 1));

  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [marks, setMarks] = useState<Record<string, DeliveryMark>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (role === null) return;
    if (role !== 'courier' && role !== 'manager' && role !== 'senior_worker') {
      router.replace('/no-access');
    }
  }, [authLoading, user, role, router]);

  // משלוחים של היום הנבחר.
  // טווח ולא שוויון: eventDate נשמר גם כ-"YYYY-MM-DDTHH:MM:SS"
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const nextDay = fmtYMD(addDays(parseYMD(selectedDate), 1));
    const unsub = onSnapshot(
      query(collection(db, 'orders'), where('eventDate', '>=', selectedDate), where('eventDate', '<', nextDay)),
      (snap) => {
        const list = snap.docs
          .map(d => ({ __id: d.id, ...(d.data() as Omit<IngestJsonOrder, '__id'>) }))
          .filter(o => o.deliveryMethod === 'delivery')
          .map(o => ({ ...o, items: o.items || [] }));
        list.sort((a, b) => {
          if (!a.estimatedTime) return 1;
          if (!b.estimatedTime) return -1;
          return a.estimatedTime.localeCompare(b.estimatedTime);
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, [user, selectedDate]);

  // סימוני "נמסר" של היום הנבחר
  const marksRef = useMemo(() => doc(db, 'orderStates', `deliveries_${selectedDate}`), [selectedDate]);
  useEffect(() => {
    if (!user) return;
    setMarks({});
    const unsub = onSnapshot(
      marksRef,
      (snap) => setMarks((snap.data()?.deliveries as Record<string, DeliveryMark>) || {}),
      (err) => console.error('Failed loading delivery marks', err)
    );
    return () => unsub();
  }, [user, marksRef]);

  useEffect(() => {
    setOpenId(null);
    setToast(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const markDelivered = useCallback(async (order: IngestJsonOrder) => {
    if (!user || !order.__id) return;
    setError(null);
    const mark: DeliveryMark = { at: Date.now(), by: user.uid, byName: displayName || user.email || null };
    try {
      await setDoc(marksRef, { deliveries: { [order.__id]: mark } }, { merge: true });
      setOpenId(null);
      setToast({ id: order.__id, name: order.clientName });
    } catch (e) {
      console.error(e);
      setError('הסימון לא נשמר. בדקו את החיבור ונסו שוב.');
    }
  }, [user, displayName, marksRef]);

  const unmark = useCallback(async (orderId: string) => {
    setError(null);
    try {
      await updateDoc(marksRef, new FieldPath('deliveries', orderId), deleteField());
      setToast(null);
      setOpenId(orderId);
    } catch (e) {
      console.error(e);
      setError('ביטול הסימון לא נשמר. בדקו את החיבור ונסו שוב.');
    }
  }, [marksRef]);

  if (authLoading || !user || role === null) return <LoadingScreen />;

  const pending = orders.filter(o => !marks[o.__id!]);
  const firstPending = pending[0];
  const activeId = openId && orders.some(o => o.__id === openId) ? openId : firstPending?.__id ?? null;
  const collectLeft = pending.reduce((sum, o) => sum + Math.max(0, getBalance(o) ?? 0), 0);
  const total = orders.length;
  const dayWord = selectedDate === today ? 'היום' : selectedDate === tomorrow ? 'מחר' : 'ביום הזה';

  const headline =
    total === 0 ? `אין משלוחים ${dayWord}`
      : pending.length === 0 ? 'אין עוד עצירות'
      : pending.length === 1 ? `עוד עצירה אחת, מתוך ${total}`
      : `עוד ${pending.length} עצירות, מתוך ${total}`;

  const tab = (on: boolean) =>
    `h-10 rounded-[10px] px-[18px] text-base ${on ? 'bg-white font-bold text-[#231C1C]' : 'text-[#4D4342]'}`;

  return (
    <div className="min-h-screen bg-[#F7F3F1] text-[#231C1C]" dir="rtl">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <header className="flex flex-col gap-3.5 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-[14px] bg-[#EDE5E2] p-1">
              <button aria-pressed={selectedDate === today} onClick={() => setSelectedDate(today)} className={tab(selectedDate === today)}>היום</button>
              <button aria-pressed={selectedDate === tomorrow} onClick={() => setSelectedDate(tomorrow)} className={tab(selectedDate === tomorrow)}>מחר</button>
              <label
                className={`relative flex h-10 w-11 cursor-pointer items-center justify-center rounded-[10px] ${
                  selectedDate !== today && selectedDate !== tomorrow ? 'bg-white' : ''
                } text-[#4D4342]`}
              >
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
            <div className="flex items-center gap-1">
              {role !== 'courier' && (
                <button
                  onClick={() => router.back()}
                  aria-label="חזרה"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4D4342] hover:bg-[#EDE5E2]"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              )}
              <button
                onClick={() => logout()}
                aria-label="התנתקות"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4D4342] hover:bg-[#EDE5E2]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 01-2-2V5a2 2 0 012-2h6" /></svg>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[15px] text-[#6E6260]">{formatDateHebrew(selectedDate)}</div>
            <h1 className="text-2xl font-bold leading-snug">{loading ? 'טוען משלוחים…' : headline}</h1>
            {!loading && collectLeft > 0 && (
              <div className="text-base text-[#4D4342]">
                לגבות {dayWord} עוד <span className="font-bold tabular-nums text-[#8A4B00]">{money(collectLeft)}</span>
              </div>
            )}
          </div>
        </header>

        {toast && (
          <div role="status" className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-[14px] bg-[#231C1C] py-1.5 pl-1.5 pr-4 text-white">
            <span className="text-[15px]">{toast.name} סומן כנמסר</span>
            <button onClick={() => unmark(toast.id)} className="h-11 rounded-[10px] px-3.5 text-[15px] font-bold text-[#FFB4C8]">ביטול</button>
          </div>
        )}
        {error && (
          <div role="alert" className="mx-4 mb-3 rounded-[14px] bg-[#FBEAE8] px-4 py-3 text-[15px] text-[#8B1E16]">{error}</div>
        )}

        {/* Route */}
        {!loading && total === 0 && selectedDate === today && (
          <div className="px-4">
            <button
              onClick={() => setSelectedDate(tomorrow)}
              className="h-12 w-full rounded-2xl bg-white text-base font-semibold"
              style={{ color: ROSE }}
            >
              להצגת המשלוחים של מחר
            </button>
          </div>
        )}

        {!loading && total > 0 && (
          <ol aria-label="מסלול המשלוחים" className="flex flex-col pb-10 pl-3 pr-4">
            {orders.map((o, i) => {
              const id = o.__id!;
              const mark = marks[id];
              const done = !!mark;
              const isOpen = id === activeId;
              const isCurrent = id === firstPending?.__id;
              const prevDone = i > 0 && !!marks[orders[i - 1].__id!];
              const balance = getBalance(o);
              const color = o.clientColor || getClientColor(o.clientName) || '#B8ABA8';
              const nodeSize = done || isOpen ? 22 : 14;
              const doneText = mark ? `נמסר בשעה ${formatTime(mark.at)}${mark.byName ? `, על ידי ${mark.byName}` : ''}` : '';

              return (
                <li key={id} className="grid grid-cols-[52px_28px_minmax(0,1fr)] gap-x-2">
                  <div
                    className={`text-left tabular-nums ${
                      isOpen && !done ? `${display.className} pt-3.5 text-[22px] font-semibold` : 'pt-5 text-[15px] font-semibold'
                    }`}
                    style={{ color: isOpen && !done ? ROSE : done ? '#8C807E' : '#4D4342' }}
                  >
                    {o.estimatedTime || '—'}
                  </div>

                  <div aria-hidden="true" className="relative flex justify-center">
                    <div
                      className="absolute top-0 h-[26px] w-[3px] rounded-sm"
                      style={{ backgroundColor: i === 0 ? 'transparent' : prevDone ? GREEN : TRACK }}
                    />
                    <div
                      className="absolute bottom-0 top-[26px] w-[3px] rounded-sm"
                      style={{ backgroundColor: i === orders.length - 1 ? 'transparent' : done ? GREEN : TRACK }}
                    />
                    <div
                      className="relative box-border flex items-center justify-center rounded-full"
                      style={{
                        marginTop: 26 - nodeSize / 2,
                        width: nodeSize,
                        height: nodeSize,
                        ...(done
                          ? { backgroundColor: GREEN }
                          : isCurrent || isOpen
                            ? { backgroundColor: '#fff', border: `5px solid ${ROSE}` }
                            : { backgroundColor: '#F7F3F1', border: '3px solid #B8ABA8' }),
                      }}
                    >
                      {done && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 pb-3.5">
                    {!isOpen && (
                      <button
                        onClick={() => setOpenId(id)}
                        aria-label={`פתיחת ${o.clientName}`}
                        className="flex min-h-[56px] w-full items-center justify-between gap-2 py-1.5 text-right"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className={`truncate text-[17px] font-semibold ${done ? 'text-[#6E6260]' : ''}`}>{o.clientName}</span>
                          <span className="text-sm text-[#6E6260]">
                            {done ? `נמסר בשעה ${formatTime(mark.at)}` : cityOf(o.address) || 'אין כתובת'}
                          </span>
                        </div>
                        {done ? (
                          <span className="flex-shrink-0 text-sm font-semibold text-[#1E6B37]">נמסר</span>
                        ) : balance != null && balance > 0 ? (
                          <span className="flex-shrink-0 text-sm font-bold tabular-nums text-[#8A4B00]">{money(balance)}</span>
                        ) : null}
                      </button>
                    )}

                    {isOpen && !done && (
                      <OpenStop order={o} color={color} onDelivered={() => markDelivered(o)} />
                    )}

                    {isOpen && done && (
                      <div className="mt-0.5 flex items-center justify-between gap-2 rounded-[18px] bg-white px-3.5 py-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[17px] font-semibold">{o.clientName}</span>
                          <span className="text-sm tabular-nums text-[#6E6260]">{doneText}</span>
                        </div>
                        <button
                          onClick={() => unmark(id)}
                          className="h-11 flex-shrink-0 rounded-xl bg-[#F2EAE7] px-3 text-[15px] font-semibold text-[#4D4342]"
                        >
                          ביטול סימון
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {!loading && total > 0 && pending.length === 0 && (
          <div className="mx-4 mb-10 rounded-[22px] bg-[#E8F4EC] p-5 text-center">
            <div className={`${display.className} text-2xl font-semibold text-[#1E6B37]`}>המסלול הושלם</div>
            <div className="mt-1 text-[15px] text-[#2F5E3D]">כל המשלוחים נמסרו</div>
          </div>
        )}
      </div>
    </div>
  );
}
