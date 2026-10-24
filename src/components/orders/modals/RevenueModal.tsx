'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { fmtYMD, addDays, startOfWeek, isOrderInRange, orderDay, type DayRange } from '@/utils/orders';
import { getItemCategory, getCategoryOrder } from '@/utils/categoryMapping';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface Order {
  __id?: string;
  clientName: string;
  eventDate?: string | null;
  items: Array<{
    title: string;
    qty: number;
    unit?: string | null;
  }>;
}

interface RevenueModalProps {
  show: boolean;
  onClose: () => void;
  orders: Order[];
  prices: Record<string, number>;
  // מדווח לעמוד איזה טווח נדרש, כדי שההזמנות שלו ייטענו מ-Firebase
  onRangeChange?: (range: DayRange | null) => void;
  // פתיחת הגדרות המחירים
  onOpenPrices?: () => void;
}

type PeriodKind = 'week' | 'month' | 'quarter' | 'year' | 'custom';
type Tab = 'products' | 'clients';
type SortBy = 'qty' | 'revenue';

const PERIODS: Array<{ value: PeriodKind; label: string }> = [
  { value: 'week', label: 'שבוע' },
  { value: 'month', label: 'חודש' },
  { value: 'quarter', label: '3 חודשים' },
  { value: 'year', label: 'שנה' },
  { value: 'custom', label: 'טווח' },
];

const ALL_CATEGORIES = 'הכל';
const LABEL_BAND = 36; // גובה שורת התוויות מתחת לעמודות

// במחשב (lg ומעלה): פריסה בשני טורים, גרף גבוה יותר ויותר שורות ברשימה
function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return wide;
}
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const money = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const fmtMoney = (v: number) => `₪${money.format(Math.round(v))}`;
const monthName = (d: Date) => d.toLocaleDateString('he-IL', { month: 'long' });
const monthShort = (d: Date) => d.toLocaleDateString('he-IL', { month: 'short' });
const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

function compactTick(v: number) {
  if (v === 0) return '0';
  if (v >= 1000) return `${Math.round((v / 1000) * 10) / 10}K`;
  return String(v);
}

// צעד "עגול" לסקאלה: 1/2/2.5/5 × 10^k
function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

interface Period {
  range: DayRange;
  prev: DayRange;
  title: string;
  subtitle: string;
  compareLabel: string;
  stepLabel: string;
}

function buildPeriod(kind: PeriodKind, offset: number, customStart: string, customEnd: string): Period | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (kind) {
    case 'week': {
      const start = addDays(startOfWeek(today, 0), offset * 7);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      return {
        range: { start: fmtYMD(start), end: fmtYMD(end) },
        prev: { start: fmtYMD(addDays(start, -7)), end: fmtYMD(addDays(end, -7)) },
        title: offset === 0 ? 'השבוע' : offset === -1 ? 'שבוע שעבר' : `שבוע ${start.getDate()}.${start.getMonth() + 1}`,
        subtitle: sameMonth
          ? `${start.getDate()}–${end.getDate()} ב${monthName(end)} ${end.getFullYear()}`
          : `${start.getDate()} ב${monthName(start)} – ${end.getDate()} ב${monthName(end)}`,
        compareLabel: 'לעומת השבוע הקודם',
        stepLabel: 'שבוע',
      };
    }
    case 'month': {
      const start = new Date(y, m + offset, 1);
      const end = new Date(y, m + offset + 1, 0);
      const prevStart = new Date(y, m + offset - 1, 1);
      return {
        range: { start: fmtYMD(start), end: fmtYMD(end) },
        prev: { start: fmtYMD(prevStart), end: fmtYMD(new Date(y, m + offset, 0)) },
        title: `${monthName(start)} ${start.getFullYear()}`,
        subtitle: `1–${end.getDate()} ב${monthName(start)}`,
        compareLabel: `לעומת ${monthName(prevStart)}`,
        stepLabel: 'חודש',
      };
    }
    case 'quarter': {
      const start = new Date(y, m + offset * 3 - 2, 1);
      const end = new Date(y, m + offset * 3 + 1, 0);
      return {
        range: { start: fmtYMD(start), end: fmtYMD(end) },
        prev: { start: fmtYMD(new Date(y, m + offset * 3 - 5, 1)), end: fmtYMD(new Date(y, m + offset * 3 - 2, 0)) },
        title: `${monthShort(start)} – ${monthShort(end)} ${end.getFullYear()}`,
        subtitle: `${monthName(start)} עד ${monthName(end)}`,
        compareLabel: 'לעומת 3 החודשים הקודמים',
        stepLabel: '3 חודשים',
      };
    }
    case 'year': {
      const year = y + offset;
      return {
        range: { start: `${year}-01-01`, end: `${year}-12-31` },
        prev: { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
        title: String(year),
        subtitle: `ינואר–דצמבר ${year}`,
        compareLabel: `לעומת ${year - 1}`,
        stepLabel: 'שנה',
      };
    }
    case 'custom': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd) || customStart > customEnd) {
        return null;
      }
      const start = parseYMD(customStart);
      const end = parseYMD(customEnd);
      const len = daysBetween(start, end) + 1;
      return {
        range: { start: customStart, end: customEnd },
        prev: { start: fmtYMD(addDays(start, -len)), end: fmtYMD(addDays(start, -1)) },
        title: `${start.toLocaleDateString('he-IL')} – ${end.toLocaleDateString('he-IL')}`,
        subtitle: `${len} ימים`,
        compareLabel: `לעומת ${len} הימים שלפני`,
        stepLabel: '',
      };
    }
  }
}

interface Bucket {
  start: string;
  end: string;
  label: string;
  aria: string;
}

// עמודות הגרף: ימים לשבוע/טווח קצר, שבועות לחודש/רבעון, חודשים לשנה/טווח ארוך
function buildBuckets(range: DayRange): { buckets: Bucket[]; unit: string } {
  const start = parseYMD(range.start);
  const end = parseYMD(range.end);
  const days = daysBetween(start, end) + 1;
  const buckets: Bucket[] = [];

  if (days <= 14) {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const ymd = fmtYMD(d);
      buckets.push({
        start: ymd,
        end: ymd,
        label: days <= 7 ? `${WEEKDAYS[d.getDay()]} ${d.getDate()}` : `${d.getDate()}`,
        aria: d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }),
      });
    }
    return { buckets, unit: 'לפי יום' };
  }

  if (days <= 100) {
    for (let s = startOfWeek(start, 0); s <= end; s = addDays(s, 7)) {
      const bs = s < start ? start : s;
      const e = addDays(s, 6);
      const be = e > end ? end : e;
      buckets.push({
        start: fmtYMD(bs),
        end: fmtYMD(be),
        label: days <= 31 ? `${bs.getDate()}–${be.getDate()}` : `${bs.getDate()}.${bs.getMonth() + 1}`,
        aria: `${bs.toLocaleDateString('he-IL')} עד ${be.toLocaleDateString('he-IL')}`,
      });
    }
    return { buckets, unit: 'לפי שבוע' };
  }

  for (let s = new Date(start.getFullYear(), start.getMonth(), 1); s <= end; s = new Date(s.getFullYear(), s.getMonth() + 1, 1)) {
    const bs = s < start ? start : s;
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
    const be = e > end ? end : e;
    buckets.push({
      start: fmtYMD(bs),
      end: fmtYMD(be),
      label: monthShort(s),
      aria: `${monthName(s)} ${s.getFullYear()}`,
    });
  }
  return { buckets, unit: 'לפי חודש' };
}

export default function RevenueModal({ show, onClose, orders, prices, onRangeChange, onOpenPrices }: RevenueModalProps) {
  const [kind, setKind] = useState<PeriodKind>('month');
  const [offset, setOffset] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [sortBy, setSortBy] = useState<SortBy>('qty');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [showAll, setShowAll] = useState(false);
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [selected, setSelected] = useState<{ key: string; idx: number } | null>(null);
  const isWide = useIsWide();
  const PLOT_HEIGHT = isWide ? 220 : 140;
  const TOP_ROWS = isWide ? 12 : 8;

  const period = useMemo(
    () => buildPeriod(kind, offset, customStart, customEnd),
    [kind, offset, customStart, customEnd]
  );
  const rangeKey = period ? `${period.range.start}_${period.range.end}` : '';

  // טעינת ההזמנות של התקופה ושל התקופה הקודמת (להשוואה) כל עוד החלון פתוח
  const requestStart = period?.prev.start;
  const requestEnd = period?.range.end;
  useEffect(() => {
    onRangeChange?.(show && requestStart && requestEnd ? { start: requestStart, end: requestEnd } : null);
  }, [onRangeChange, show, requestStart, requestEnd]);

  useEffect(() => {
    setShowAll(false);
  }, [rangeKey, tab, category, sortBy]);

  const data = useMemo(() => {
    if (!period || !Array.isArray(orders)) return null;
    const todayYmd = fmtYMD(new Date());
    const priceOf = (title: string) => (prices[title] > 0 ? prices[title] : 0);
    const orderRevenue = (o: Order) =>
      (o.items || []).reduce((sum, it) => sum + priceOf(it.title) * (Number(it.qty) || 0), 0);

    const current = orders.filter(o => isOrderInRange(o.eventDate, period.range));
    const previous = orders.filter(o => isOrderInRange(o.eventDate, period.prev));

    let total = 0;
    let upcoming = 0;
    const byClient = new Map<string, { revenue: number; orders: number }>();
    const byProduct = new Map<string, { qty: number; revenue: number; orders: number; priced: boolean }>();
    const unpriced = new Map<string, Set<string>>();

    current.forEach((o, i) => {
      const rev = orderRevenue(o);
      total += rev;
      if ((orderDay(o.eventDate) ?? '') > todayYmd) upcoming += rev;

      const c = byClient.get(o.clientName) ?? { revenue: 0, orders: 0 };
      c.revenue += rev;
      c.orders += 1;
      byClient.set(o.clientName, c);

      const seen = new Set<string>();
      for (const it of o.items || []) {
        const qty = Number(it.qty) || 0;
        const price = priceOf(it.title);
        const p = byProduct.get(it.title) ?? { qty: 0, revenue: 0, orders: 0, priced: price > 0 };
        p.qty += qty;
        p.revenue += price * qty;
        if (!seen.has(it.title)) {
          p.orders += 1;
          seen.add(it.title);
        }
        byProduct.set(it.title, p);
        if (!price) {
          const set = unpriced.get(it.title) ?? new Set<string>();
          set.add(o.__id ?? String(i));
          unpriced.set(it.title, set);
        }
      }
    });

    let prevTotal = 0;
    const prevQty = new Map<string, number>();
    for (const o of previous) {
      prevTotal += orderRevenue(o);
      for (const it of o.items || []) prevQty.set(it.title, (prevQty.get(it.title) ?? 0) + (Number(it.qty) || 0));
    }

    const unpricedOrders = new Set<string>();
    unpriced.forEach(ids => ids.forEach(id => unpricedOrders.add(id)));

    // גרף
    const { buckets, unit } = buildBuckets(period.range);
    const values = buckets.map(() => 0);
    for (const o of current) {
      const day = orderDay(o.eventDate);
      if (!day) continue;
      const idx = buckets.findIndex(b => day >= b.start && day <= b.end);
      if (idx >= 0) values[idx] += orderRevenue(o);
    }
    const maxVal = Math.max(0, ...values);
    const step = niceStep(maxVal / 3);
    const plotMax = maxVal > 0 ? step * 3 : 1;
    const todayIdx = buckets.findIndex(b => todayYmd >= b.start && todayYmd <= b.end);
    let lastWithValue = -1;
    values.forEach((v, i) => { if (v > 0) lastWithValue = i; });

    return {
      total,
      prevTotal,
      upcoming,
      orderCount: current.length,
      clients: [...byClient.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
      products: [...byProduct.entries()].map(([title, p]) => ({
        title,
        ...p,
        category: getItemCategory(title),
        prevQty: prevQty.get(title) ?? 0,
      })),
      unpriced: [...unpriced.entries()]
        .map(([title, ids]) => ({ title, orders: ids.size }))
        .sort((a, b) => b.orders - a.orders),
      unpricedOrderCount: unpricedOrders.size,
      chart: {
        unit,
        bars: buckets.map((b, i) => ({ ...b, value: values[i], planned: b.start > todayYmd })),
        ticks: maxVal > 0 ? [0, step, step * 2, step * 3] : [0],
        plotMax,
        defaultIdx: todayIdx >= 0 ? todayIdx : lastWithValue >= 0 ? lastWithValue : buckets.length - 1,
      },
    };
  }, [period, orders, prices]);

  // הסכום הגדול מתגלגל לערך החדש כשמחליפים תקופה
  const animatedTotal = useAnimatedNumber(data?.total ?? 0);

  if (!show) return null;

  const selectedIdx = data
    ? selected && selected.key === rangeKey ? selected.idx : data.chart.defaultIdx
    : -1;

  // רבי מכר
  const categories = data
    ? [ALL_CATEGORIES, ...getCategoryOrder().filter(c => data.products.some(p => p.category === c))]
    : [ALL_CATEGORIES];
  const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES;
  const productRows = data
    ? data.products
        .filter(p => activeCategory === ALL_CATEGORIES || p.category === activeCategory)
        .sort((a, b) => (sortBy === 'qty' ? b.qty - a.qty : b.revenue - a.revenue || b.qty - a.qty))
    : [];
  const clientRows = data?.clients ?? [];
  const rowCount = tab === 'products' ? productRows.length : clientRows.length;
  const visibleCount = showAll ? rowCount : Math.min(TOP_ROWS, rowCount);

  const delta = data && data.prevTotal > 0 ? Math.round(((data.total - data.prevTotal) / data.prevTotal) * 100) : null;

  const segBtn = (on: boolean) =>
    `h-9 rounded-[9px] text-sm transition-colors ${on ? 'bg-white font-semibold text-[#1F1A1C] shadow-sm' : 'text-[#4A4246]'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revenue-title"
        dir="rtl"
        className="flex h-full w-full flex-col overflow-hidden bg-[#F6F1F2] text-[#1F1A1C] md:h-[90vh] md:max-w-2xl md:rounded-2xl md:shadow-2xl lg:max-w-6xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת */}
        <header className="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#ECE3E6] bg-white pl-2 pr-4">
          <h2 id="revenue-title" className="text-xl font-bold">הכנסות</h2>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4A4246] hover:bg-[#F3ECEE]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {/* תקופה */}
        <section aria-label="תקופה" className="flex flex-shrink-0 flex-col gap-3 border-b border-[#ECE3E6] bg-white px-4 pb-3.5 pt-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-6 lg:py-3">
          <div role="group" aria-label="סוג תקופה" className="grid grid-cols-5 gap-1 rounded-xl bg-[#F3ECEE] p-1 lg:w-[480px] lg:flex-shrink-0">
            {PERIODS.map(p => (
              <button
                key={p.value}
                aria-pressed={kind === p.value}
                onClick={() => { setKind(p.value); setOffset(0); }}
                className={segBtn(kind === p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {kind === 'custom' ? (
            <div className="grid grid-cols-2 gap-2 lg:w-[420px]">
              <label className="flex flex-col gap-1 text-[13px] text-[#6E6569]">
                מתאריך
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[15px] text-[#1F1A1C] focus:border-[#B0234F] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px] text-[#6E6569]">
                עד תאריך
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[15px] text-[#1F1A1C] focus:border-[#B0234F] focus:outline-none"
                />
              </label>
            </div>
          ) : (
            period && (
              <div className="flex items-center justify-between lg:w-[420px]">
                <button
                  onClick={() => setOffset(o => o - 1)}
                  aria-label={`${period.stepLabel} קודם`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ECE3E6] text-[#4A4246] hover:bg-[#F3ECEE]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </button>
                <div className="text-center">
                  <div className="text-[17px] font-semibold">{period.title}</div>
                  <div className="text-[13px] text-[#6E6569]">{period.subtitle}</div>
                </div>
                <button
                  onClick={() => setOffset(o => o + 1)}
                  aria-label={`${period.stepLabel} הבא`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#ECE3E6] text-[#4A4246] hover:bg-[#F3ECEE]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
              </div>
            )
          )}
        </section>

        <div className="flex-1 overflow-y-auto">
          {!period || !data ? (
            <div className="px-6 py-16 text-center text-[15px] text-[#6E6569]">בחרו תאריך התחלה ותאריך סיום</div>
          ) : (
            <main className="flex flex-col gap-3 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:p-6">
              <div className="flex flex-col gap-3 lg:gap-4">
              {/* סיכום */}
              <section aria-label="סיכום" className="flex flex-col gap-3.5 rounded-2xl bg-white p-5">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-[#6E6569]">סה״כ הכנסות</div>
                  <div className="text-5xl font-bold leading-tight tracking-tight" aria-label={fmtMoney(data.total)}>{fmtMoney(animatedTotal)}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {delta !== null ? (
                      <>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${
                            delta > 0 ? 'bg-[#E8F4EC] text-[#1E6B37]' : delta < 0 ? 'bg-[#FBEAE8] text-[#A5281F]' : 'bg-[#F3ECEE] text-[#4A4246]'
                          }`}
                        >
                          {delta > 0 ? '▲' : delta < 0 ? '▼' : ''} {Math.abs(delta)}%
                        </span>
                        <span className="text-[#6E6569]">{period.compareLabel} ({fmtMoney(data.prevTotal)})</span>
                      </>
                    ) : (
                      <span className="text-[#6E6569]">אין הכנסות בתקופה הקודמת להשוואה</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#F0E8EB] pt-3.5">
                  <div>
                    <div className="text-xl font-semibold">{data.orderCount}</div>
                    <div className="text-[13px] text-[#6E6569]">הזמנות</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{data.orderCount ? fmtMoney(data.total / data.orderCount) : '—'}</div>
                    <div className="text-[13px] text-[#6E6569]">ממוצע להזמנה</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{fmtMoney(data.upcoming)}</div>
                    <div className="text-[13px] text-[#6E6569]">בהזמנות קרובות</div>
                  </div>
                </div>
              </section>

              {/* מנות בלי מחיר */}
              {data.unpriced.length > 0 && (
                <section aria-label="אזהרת נתונים" className="flex flex-col gap-2.5 rounded-2xl border border-[#F2DDB0] bg-[#FFF7E6] px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A86A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-shrink-0" role="img" aria-label="אזהרה"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[15px] font-semibold">
                        {data.unpriced.length === 1 ? 'מנה אחת בלי מחיר' : `${data.unpriced.length} מנות בלי מחיר`}
                      </div>
                      <div className="text-sm leading-relaxed text-[#4A4246]">
                        {data.unpriced.length === 1 ? 'מופיעה' : 'מופיעות'}{' '}
                        {data.unpricedOrderCount === 1 ? 'בהזמנה אחת' : `ב-${data.unpricedOrderCount} הזמנות`}
                        {' '}{data.unpriced.length === 1 ? 'ונספרה' : 'ונספרו'} כ-₪0, כך שהסכום בפועל גבוה יותר.
                      </div>
                    </div>
                  </div>
                  {showUnpriced && (
                    <ul className="flex flex-col gap-1.5 pr-[30px] text-sm">
                      {data.unpriced.map(u => (
                        <li key={u.title} className="flex justify-between gap-2">
                          <span>{u.title}</span>
                          <span className="tabular-nums text-[#6E6569]">{u.orders === 1 ? 'הזמנה אחת' : `${u.orders} הזמנות`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 pr-[30px]">
                    <button
                      onClick={() => setShowUnpriced(v => !v)}
                      aria-expanded={showUnpriced}
                      className="h-9 rounded-[10px] bg-[#FBE9C2] px-3 text-sm font-semibold text-[#7A4D00]"
                    >
                      {showUnpriced ? 'הסתרה' : 'אילו מנות?'}
                    </button>
                    {onOpenPrices && (
                      <button
                        onClick={onOpenPrices}
                        className="h-9 rounded-[10px] bg-[#B0234F] px-3 text-sm font-semibold text-white hover:bg-[#8E1B40]"
                      >
                        הוספת מחירים
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* גרף */}
              <section aria-label={`הכנסות ${data.chart.unit}`} className="flex flex-col gap-3 rounded-2xl bg-white px-4 pb-3 pt-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold">{data.chart.unit}</h3>
                  <div className="flex gap-3 text-xs text-[#6E6569]">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#B0234F]" />בוצע</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#E9BFCD]" />מתוכנן</span>
                  </div>
                </div>
                <div className="relative" style={{ height: PLOT_HEIGHT + LABEL_BAND }}>
                  {data.chart.ticks.map(t => (
                    <div
                      key={t}
                      className={`absolute left-0 right-0 border-t ${t === 0 ? 'border-[#D9CFD3]' : 'border-[#F0E8EB]'}`}
                      style={{ top: PLOT_HEIGHT - Math.round((t / data.chart.plotMax) * PLOT_HEIGHT) }}
                    >
                      <span className="absolute -top-2 right-0 bg-white pl-1 text-[11px] tabular-nums text-[#6E6569]">{compactTick(t)}</span>
                    </div>
                  ))}
                  <div
                    className="absolute bottom-0 left-0 right-[34px] top-0 grid"
                    style={{ gridTemplateColumns: `repeat(${data.chart.bars.length}, minmax(0, 1fr))` }}
                  >
                    {data.chart.bars.map((b, i) => {
                      const isSel = i === selectedIdx;
                      const h = b.value > 0 ? Math.max(2, Math.round((b.value / data.chart.plotMax) * PLOT_HEIGHT)) : 0;
                      const showLabel = data.chart.bars.length <= (isWide ? 14 : 7) || i % 2 === 0 || isSel;
                      return (
                        <button
                          key={b.start}
                          onClick={() => setSelected({ key: rangeKey, idx: i })}
                          onMouseEnter={() => setSelected({ key: rangeKey, idx: i })}
                          aria-label={`${b.aria}: ${fmtMoney(b.value)}${b.planned ? ' (מתוכנן)' : ''}`}
                          aria-pressed={isSel}
                          className="flex min-w-0 flex-col items-center justify-end"
                          style={{ height: PLOT_HEIGHT + LABEL_BAND }}
                        >
                          <div className="flex w-full flex-col items-center justify-end gap-1" style={{ height: PLOT_HEIGHT }}>
                            {isSel && (
                              <span className="whitespace-nowrap text-xs font-semibold tabular-nums">{fmtMoney(b.value)}</span>
                            )}
                            <div
                              key={`${rangeKey}-${b.start}`}
                              className={`bar-grow rounded-t ${b.planned ? 'bg-[#E9BFCD]' : 'bg-[#B0234F]'}`}
                              style={{
                                height: h,
                                width: `min(${isWide ? 32 : 24}px, calc(100% - 6px))`,
                                animationDelay: `${i * 18}ms`,
                                boxShadow: isSel && h > 0 ? `0 0 0 2px #fff, 0 0 0 4px ${b.planned ? '#C98DA2' : '#7E1739'}` : undefined,
                              }}
                            />
                          </div>
                          <div className={`flex h-9 items-center whitespace-nowrap text-[11px] lg:text-xs ${isSel ? 'font-semibold text-[#1F1A1C]' : 'text-[#6E6569]'}`}>
                            {showLabel ? b.label : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
              </div>

              {/* פירוט */}
              <section aria-label="פירוט" className="flex flex-col gap-1 rounded-2xl bg-white p-4">
                <div role="tablist" aria-label="פירוט לפי" className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-[#F3ECEE] p-1">
                  <button role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')} className={`${segBtn(tab === 'products')} h-10 text-[15px]`}>רבי מכר</button>
                  <button role="tab" aria-selected={tab === 'clients'} onClick={() => setTab('clients')} className={`${segBtn(tab === 'clients')} h-10 text-[15px]`}>לקוחות</button>
                </div>

                {tab === 'products' && (
                  <div className="mb-1 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-[#6E6569]">מיון לפי</span>
                      <div role="group" aria-label="מיון" className="flex gap-1 rounded-[10px] bg-[#F3ECEE] p-[3px]">
                        <button aria-pressed={sortBy === 'qty'} onClick={() => setSortBy('qty')} className={`${segBtn(sortBy === 'qty')} h-8 px-3.5`}>כמות</button>
                        <button aria-pressed={sortBy === 'revenue'} onClick={() => setSortBy('revenue')} className={`${segBtn(sortBy === 'revenue')} h-8 px-3.5`}>הכנסה</button>
                      </div>
                    </div>
                    {categories.length > 2 && (
                      <div role="group" aria-label="קטגוריה" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                        {categories.map(c => (
                          <button
                            key={c}
                            aria-pressed={activeCategory === c}
                            onClick={() => setCategory(c)}
                            className={`h-9 flex-shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm ${
                              activeCategory === c
                                ? 'bg-[#1F1A1C] font-semibold text-white'
                                : 'border border-[#E3D8DC] bg-white text-[#4A4246]'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-[#6E6569]">השינוי בכמות מחושב {period.compareLabel}</p>
                  </div>
                )}

                {rowCount === 0 && (
                  <div className="py-6 text-center text-sm text-[#6E6569]">
                    {tab === 'products' && activeCategory !== ALL_CATEGORIES ? 'אין מכירות בקטגוריה הזו בתקופה' : 'אין הזמנות בתקופה הזו'}
                  </div>
                )}

                {tab === 'products'
                  ? productRows.slice(0, visibleCount).map((p, i) => {
                      const top = sortBy === 'qty' ? productRows[0].qty : productRows[0].revenue;
                      const val = sortBy === 'qty' ? p.qty : p.revenue;
                      const diff = p.qty - p.prevQty;
                      return (
                        <div key={p.title} className="flex items-start gap-2.5 border-b border-[#F3ECEE] py-2.5 last:border-b-0">
                          <span className="w-[22px] flex-shrink-0 pt-px text-sm font-semibold tabular-nums text-[#6E6569]">{i + 1}</span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-[15px] font-medium">{p.title}</span>
                                {!p.priced && (
                                  <span className="flex-shrink-0 rounded-full bg-[#FFF1D6] px-2 py-px text-xs font-semibold text-[#7A4D00]">אין מחיר</span>
                                )}
                              </div>
                              <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums">
                                {sortBy === 'qty' ? `${p.qty} יח׳` : p.priced ? fmtMoney(p.revenue) : '—'}
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-sm bg-[#F3ECEE]">
                              <div className="h-1 rounded-sm bg-[#B0234F]" style={{ width: `${top > 0 ? Math.round((val / top) * 100) : 0}%` }} />
                            </div>
                            <div className="flex justify-between gap-2 text-[13px] text-[#6E6569]">
                              <span className="truncate">
                                {p.category} · {sortBy === 'qty' ? (p.priced ? fmtMoney(p.revenue) : 'אין מחיר') : `${p.qty} יח׳`}
                              </span>
                              <span
                                className={`whitespace-nowrap tabular-nums ${
                                  p.prevQty === 0 ? 'text-[#4A4246]' : diff > 0 ? 'text-[#1E6B37]' : diff < 0 ? 'text-[#A5281F]' : ''
                                }`}
                              >
                                {p.prevQty === 0 ? 'חדש' : diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${Math.abs(diff)}` : 'ללא שינוי'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  : clientRows.slice(0, visibleCount).map(([name, c], i) => (
                      <div key={name} className="flex items-start gap-2.5 border-b border-[#F3ECEE] py-2.5 last:border-b-0">
                        <span className="w-[22px] flex-shrink-0 pt-px text-sm font-semibold tabular-nums text-[#6E6569]">{i + 1}</span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[15px] font-medium">{name}</span>
                            <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums">{fmtMoney(c.revenue)}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-sm bg-[#F3ECEE]">
                            <div
                              className="h-1 rounded-sm bg-[#B0234F]"
                              style={{ width: `${clientRows[0][1].revenue > 0 ? Math.round((c.revenue / clientRows[0][1].revenue) * 100) : 0}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[13px] text-[#6E6569]">
                            <span>{c.orders === 1 ? 'הזמנה אחת' : `${c.orders} הזמנות`}</span>
                            <span className="tabular-nums">
                              {data.total > 0 ? `${Math.round((c.revenue / data.total) * 1000) / 10}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                {rowCount > TOP_ROWS && (
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="mt-2 h-11 rounded-xl border border-[#ECD3DC] text-[15px] font-semibold text-[#B0234F] hover:bg-[#FBF3F6]"
                  >
                    {showAll
                      ? 'הצגת פחות'
                      : tab === 'products'
                        ? `כל ${rowCount} המוצרים`
                        : `כל ${rowCount} הלקוחות`}
                  </button>
                )}
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
