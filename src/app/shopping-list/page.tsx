"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, FieldPath, setDoc, updateDoc } from 'firebase/firestore';
import ShoppingListSettings from '@/components/shopping/ShoppingListSettings';
import CategoryManager, { type Category } from '@/components/shopping/CategoryManager';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { displayFont } from '@/lib/fonts';
import { toast } from '@/lib/toast';
import { addDays, fmtYMD, startOfWeek } from '@/utils/orders';
import { useShoppingData } from '@/hooks/useShoppingData';
import { useShoppingLists, listActions, type ShoppingListDoc } from '@/hooks/useShoppingLists';
import { useShortages, type Shortage } from '@/hooks/useShortages';
import { fmtQty, ingredientKey, type ComputedItem } from '@/lib/shopping/compute';

const ROSE = '#A3204A';
const GREEN = '#1E6B37';
const PALETTE = ['#9CC3E6', '#E8C37A', '#9FD39A', '#F2A9A0', '#CFC3E6', '#F4C7D3', '#C9E6C4', '#F6D9A8', '#B9D7D3', '#E6C8B4'];
const UNITS = ['ק״ג', 'גרם', 'ליטר', 'מ״ל', 'יח׳', 'חבילות', 'גלילים', 'קרטונים'];
const RETRY = 'בדקו את החיבור ונסו שוב.';

const parseYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (s: string) => {
  const d = parseYMD(s);
  return `${d.getDate()}.${d.getMonth() + 1}`;
};
const longRange = (start: string, end: string) => {
  const a = parseYMD(start);
  const b = parseYMD(end);
  const fmt = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  return `${fmt(a)} עד ${fmt(b)}`;
};
const timeAgo = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const today = fmtYMD(new Date());
  const day = fmtYMD(d);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (day === today) return `היום ב-${hm}`;
  if (day === fmtYMD(addDays(new Date(), -1))) return `אתמול ב-${hm}`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
};
const categoryColor = (cat: Category | undefined, index: number) =>
  cat?.color?.startsWith('#') ? cat.color : PALETTE[index % PALETTE.length];

interface Row {
  key: string;
  name: string;
  qtyText: string;
  sources: string[];
  category: string;
  extraIds: string[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShoppingListPage() {
  const { user, role, displayName, loading: authLoading } = useAuth();
  const router = useRouter();
  const userName = displayName || user?.email?.split('@')[0] || 'משתמש';

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/');
  }, [authLoading, user, router]);

  if (authLoading || !user || role == null) return <LoadingScreen />;
  if (role === 'manager') return <ManagerView userName={userName} />;
  if (role === 'senior_worker' || role === 'worker') return <ReporterView userName={userName} />;
  return <div className="p-8 text-center text-[#6E6260]">אין לך גישה לעמוד הזה</div>;
}

// ─── Manager ──────────────────────────────────────────────────────────────────

function ManagerView({ userName }: { userName: string }) {
  const router = useRouter();
  const today = fmtYMD(new Date());
  const { lists, loading: listsLoading, createList, deleteList } = useShoppingLists();
  const { shortages, legacyManual, setStatus, removeReport, clearLegacyManual } = useShortages();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const activeLists = lists.filter(l => l.end >= today);
  const pastLists = lists.filter(l => l.end < today);
  const selected = lists.find(l => l.id === selectedId) || null;

  // במחשב: פותחים ישר את הרשימה הפעילה הראשונה
  useEffect(() => {
    if (selectedId || listsLoading || !lists.length) return;
    if (typeof window === 'undefined' || !window.matchMedia('(min-width: 768px)').matches) return;
    setSelectedId((activeLists[0] || lists[0]).id);
  }, [selectedId, listsLoading, lists, activeLists]);

  // הנתונים של הרשימה הפתוחה (ההגדרות נטענות גם בלי רשימה, בשביל חלון ההגדרות)
  const data = useShoppingData(selected ? { start: selected.start, end: selected.end } : null);

  // חוסרים נכנסים לרשימה הפתוחה אם היא פעילה, אחרת לפעילה הראשונה
  const targetList = selected && selected.end >= today ? selected : activeLists[0] || null;
  const openShortages = shortages.filter(s => s.status === 'open');

  const handleCreate = async (name: string, start: string, end: string) => {
    const id = await createList(name, start, end, userName);
    if (id) {
      setSelectedId(id);
      setNewOpen(false);
      toast.success('הרשימה נוצרה');
    }
  };

  const handleDelete = async (list: ShoppingListDoc) => {
    const ok = await deleteList(list);
    if (ok) setSelectedId(null);
  };

  const addShortageToList = async (s: Shortage, categoryId: string | null) => {
    if (!targetList) return;
    const key = ingredientKey(s.name, data.ingredientMappings);
    const actions = listActions(targetList.id);
    // קטגוריה שנבחרה ידנית נשמרת לזיכרון, כדי שבפעם הבאה היא תוצע מראש
    if (categoryId && data.itemCategories[key] !== categoryId) {
      updateDoc(doc(db, 'orderSettings', 'shoppingCategories'), new FieldPath('itemCategories', key), categoryId)
        .catch((e) => console.error(e));
    }
    await actions.addExtra({
      name: s.name, qty: s.qty, unit: s.unit,
      category: categoryId ?? data.itemCategories[key] ?? null,
      source: `דווח על ידי ${s.reportedBy}`,
      addedBy: s.reportedBy,
      shortageId: s.id,
    });
    if (targetList.removed?.[key]) await actions.setRemoved(key, false);
    await setStatus(s, { status: 'added', listId: targetList.id, listName: targetList.name, itemKey: key });
  };

  return (
    <div className="vf-page min-h-screen bg-[#F7F3F1] text-[#231C1C]" dir="rtl">
      <div className="md:grid md:min-h-screen md:grid-cols-[minmax(300px,350px)_minmax(0,1fr)]">

        {/* Lists */}
        <aside
          aria-label="רשימות קניות"
          className={`${selected ? 'hidden md:flex' : 'flex'} flex-col gap-5 px-4 pb-10 pt-4 md:border-l md:border-[#EAE1DE]`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => router.push('/')}
              aria-label="חזרה לדף הבית"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4D4342] hover:bg-[#EDE5E2]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <button
              onClick={() => setNewOpen(v => !v)}
              aria-expanded={newOpen}
              className="flex h-11 items-center gap-1.5 rounded-[14px] px-3.5 text-[15px] font-bold text-white transition-transform active:scale-[.96]"
              style={{ backgroundColor: ROSE }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              רשימה חדשה
            </button>
          </div>
          <h1 className={`${displayFont.className} -mt-2 text-[30px] font-semibold leading-tight`}>רשימות קניות</h1>

          {newOpen && <NewListForm onCreate={handleCreate} />}

          {openShortages.length > 0 && (
            <ShortagesBox
              shortages={openShortages}
              targetList={targetList}
              itemCategories={data.itemCategories}
              ingredientMappings={data.ingredientMappings}
              categories={data.categories}
              compact
              onAdd={addShortageToList}
              onDismiss={(s) => (s.legacy ? removeReport(s) : setStatus(s, { status: 'dismissed' }))}
            />
          )}

          <section aria-label="רשימות פעילות" className="flex flex-col gap-1">
            <h2 className="mb-1 text-sm font-semibold text-[#6E6260]">פעילות</h2>
            {listsLoading ? (
              <p className="text-[15px] text-[#6E6260]">טוען…</p>
            ) : activeLists.length === 0 ? (
              <p className="text-[15px] leading-relaxed text-[#6E6260]">אין רשימה פעילה. רשימה חדשה נבנית מההזמנות של התקופה שבוחרים.</p>
            ) : (
              activeLists.map(l => (
                <ListRow key={l.id} list={l} current={l.id === selectedId} onOpen={() => setSelectedId(l.id)} />
              ))
            )}
          </section>

          {pastLists.length > 0 && (
            <section aria-label="רשימות קודמות" className="flex flex-col gap-0.5">
              <h2 className="mb-1 text-sm font-semibold text-[#6E6260]">רשימות קודמות</h2>
              {pastLists.map(l => (
                <ListRow key={l.id} list={l} past current={l.id === selectedId} onOpen={() => setSelectedId(l.id)} />
              ))}
            </section>
          )}

          <div className="mt-auto flex flex-col gap-1 border-t border-[#EAE1DE] pt-4">
            <button onClick={() => setSettingsOpen(true)} className="flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-[15px] font-semibold text-[#4D4342] hover:bg-[#EDE5E2]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
              הגדרות מתכונים
            </button>
            <button onClick={() => setCategoriesOpen(true)} className="flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-[15px] font-semibold text-[#4D4342] hover:bg-[#EDE5E2]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
              עריכת קטגוריות
            </button>
          </div>
        </aside>

        {/* Selected list */}
        <main className={`${selected ? 'block' : 'hidden md:block'} min-w-0 bg-white`}>
          {!selected ? (
            <div className="flex min-h-[60vh] items-center justify-center p-6 text-center text-[17px] text-[#6E6260]">
              {listsLoading ? 'טוען…' : lists.length ? 'בחרו רשימה כדי לפתוח אותה' : 'צרו רשימה חדשה כדי להתחיל'}
            </div>
          ) : (
            <ListPanel
              key={selected.id}
              list={selected}
              data={data}
              isActive={selected.end >= today}
              shortages={selected.end >= today ? openShortages : []}
              legacyManualCount={selected.end >= today ? legacyManual.length : 0}
              onMigrateLegacy={async () => {
                const actions = listActions(selected.id);
                for (const it of legacyManual) {
                  await actions.addExtra({
                    name: it.name, qty: Number(it.qty) || 1, unit: it.unit || '',
                    category: it.category || null, source: it.addedBy ? `נוסף על ידי ${it.addedBy}` : 'נוסף ידנית', addedBy: it.addedBy || null,
                  });
                }
                await clearLegacyManual();
                toast.success('המצרכים הועברו לרשימה');
              }}
              onAddShortage={addShortageToList}
              onDismissShortage={(s) => (s.legacy ? removeReport(s) : setStatus(s, { status: 'dismissed' }))}
              onBack={() => setSelectedId(null)}
              onDelete={() => handleDelete(selected)}
              userName={userName}
            />
          )}
        </main>
      </div>

      <ShoppingListSettings
        show={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        menuItems={data.allMenuItems}
        recipes={data.recipes}
        recipeLinks={data.recipeLinks}
        initialSettings={data.recipeSettings}
        // ShoppingListSettings מגדיר טיפוס RecipeSettings משלו, זהה במבנה
        onSave={async (settings: any[]) => {
          await setDoc(doc(db, 'orderSettings', 'shoppingListSettings'), { settings, updatedAt: new Date().toISOString() });
          data.setRecipeSettings(settings);
        }}
      />

      {categoriesOpen && (
        <CategoriesModal
          categories={data.categories}
          itemCategories={data.itemCategories}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
    </div>
  );
}

function ListRow({ list, current, past, onOpen }: { list: ShoppingListDoc; current: boolean; past?: boolean; onOpen: () => void }) {
  const checked = Object.keys(list.checked || {}).length;
  return (
    <button
      onClick={onOpen}
      aria-current={current}
      className={`flex w-full flex-col gap-1 rounded-2xl px-3 py-2.5 text-right transition-colors hover:bg-[#F0E8E5] ${
        current ? 'bg-white shadow-[0_0_0_2px_#A3204A] hover:bg-white' : ''
      }`}
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className={`text-[17px] font-semibold ${past ? 'text-[#4D4342]' : ''}`}>{list.name}</span>
        <span className="flex-shrink-0 text-sm tabular-nums text-[#6E6260]">{checked ? `${checked} סומנו` : ''}</span>
      </span>
      <span className="text-sm tabular-nums text-[#6E6260]">{longRange(list.start, list.end)}</span>
    </button>
  );
}

// ─── New list ─────────────────────────────────────────────────────────────────

function NewListForm({ onCreate }: { onCreate: (name: string, start: string, end: string) => void }) {
  const now = new Date();
  const thisStart = startOfWeek(now, 0);
  const presets = {
    this: { label: 'השבוע', start: fmtYMD(thisStart), end: fmtYMD(addDays(thisStart, 6)) },
    next: { label: 'השבוע הבא', start: fmtYMD(addDays(thisStart, 7)), end: fmtYMD(addDays(thisStart, 13)) },
  };
  const [preset, setPreset] = useState<'this' | 'next' | 'custom'>('next');
  const [start, setStart] = useState(presets.next.start);
  const [end, setEnd] = useState(presets.next.end);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (p: 'this' | 'next' | 'custom') => {
    setPreset(p);
    if (p !== 'custom') { setStart(presets[p].start); setEnd(presets[p].end); }
  };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;
  const autoName = valid ? `קניות ${shortDate(start)} עד ${shortDate(end)}` : 'קניות';

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        await onCreate(name.trim() || autoName, start, end);
        setBusy(false);
      }}
      className="flex flex-col gap-3 rounded-[20px] bg-white p-4 shadow-[0_1px_0_#E7DDDA]"
    >
      <div className="text-[15px] font-semibold">לאיזו תקופה?</div>
      <div role="group" aria-label="תקופה" className="grid grid-cols-3 gap-1.5">
        {(['this', 'next', 'custom'] as const).map(p => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => pick(p)}
            className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] ${preset === p ? 'bg-[#231C1C] text-white' : 'bg-[#F2EAE7]'}`}
          >
            <span className="text-[15px] font-bold">{p === 'custom' ? 'טווח אחר' : presets[p].label}</span>
            <span className="text-xs tabular-nums opacity-80">
              {p === 'custom' ? 'בחירת תאריכים' : `${shortDate(presets[p].start)} עד ${shortDate(presets[p].end)}`}
            </span>
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
            מתאריך
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[15px] text-[#231C1C]" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
            עד תאריך
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[15px] text-[#231C1C]" />
          </label>
        </div>
      )}
      <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
        שם הרשימה (לא חובה)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={autoName}
          autoComplete="off"
          className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]"
        />
      </label>
      {!valid && <p className="text-sm text-[#8B1E16]">תאריך הסיום צריך להיות אחרי תאריך ההתחלה</p>}
      <button type="submit" disabled={!valid || busy} className="h-12 rounded-[14px] bg-[#231C1C] text-base font-bold text-white disabled:opacity-50">
        {busy ? 'יוצר…' : 'יצירת הרשימה'}
      </button>
    </form>
  );
}

// ─── Shortages ────────────────────────────────────────────────────────────────

function ShortagesBox({
  shortages, targetList, itemCategories, ingredientMappings, categories, rowKeys, compact, onAdd, onDismiss,
}: {
  shortages: Shortage[];
  targetList: ShoppingListDoc | null;
  itemCategories: Record<string, string>;
  ingredientMappings: Record<string, string>;
  categories: Category[];
  rowKeys?: Map<string, string>;
  compact?: boolean;
  onAdd: (s: Shortage, categoryId: string | null) => Promise<void>;
  onDismiss: (s: Shortage) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // הקטגוריה שנבחרה לכל חוסר; ברירת המחדל היא מה שהמערכת זוכרת
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const options = categories.some(c => c.id === 'other') ? categories : [...categories, { id: 'other', name: 'כללי', emoji: '', color: '' }];
  return (
    <section aria-label="חוסרים שדווחו" className="flex flex-col gap-0.5 rounded-[20px] bg-[#FFF7E6] px-4 py-3.5">
      <div className="flex items-center gap-2 text-[15px] font-bold text-[#6B3A00]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A86A00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></svg>
        {shortages.length === 1 ? 'חוסר אחד דווח מהמאפייה' : `${shortages.length} חוסרים דווחו מהמאפייה`}
      </div>
      {!targetList && <p className="text-sm text-[#6E5A1E]">צרו רשימה פעילה כדי להוסיף אליה את החוסרים</p>}
      {shortages.map(s => {
        const key = ingredientKey(s.name, ingredientMappings);
        const existing = rowKeys?.get(key);
        const remembered = itemCategories[key];
        const cat = chosen[s.id] ?? (remembered && options.some(o => o.id === remembered) ? remembered : 'other');
        return (
          <div key={s.id} className="flex flex-col gap-2 border-t border-[#F2E2BF] py-2.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold">
                {s.name} <span className="font-medium tabular-nums text-[#6E5A1E]">{fmtQty(s.qty)} {s.unit}</span>
              </span>
              <span className="text-[13px] text-[#6E5A1E]">
                דווח על ידי {s.reportedBy}{s.reportedAt ? `, ${timeAgo(s.reportedAt)}` : ''}
              </span>
            </span>
            <span className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'sm:flex-nowrap'}`}>
              {existing ? (
                <span className="min-w-0 flex-1 text-[13px] text-[#6E5A1E]">כבר ברשימה, הכמות תתווסף</span>
              ) : (
                <label className="min-w-0 flex-1">
                  <span className="sr-only">קטגוריה עבור {s.name}</span>
                  <select
                    value={cat}
                    onChange={(e) => setChosen(c => ({ ...c, [s.id]: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-[#F2DDB0] bg-white px-2 text-sm text-[#231C1C]"
                  >
                    {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
              )}
              <button
                disabled={!targetList || busy === s.id}
                onClick={async () => { setBusy(s.id); await onAdd(s, existing ? null : cat); setBusy(null); }}
                className="h-10 flex-shrink-0 rounded-xl bg-[#231C1C] px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy === s.id ? '…' : existing ? `צירוף ל${existing}` : 'הוספה לרשימה'}
              </button>
              <button
                onClick={() => onDismiss(s)}
                aria-label={`התעלמות מ${s.name}`}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#6E5A1E] hover:bg-white/60"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

// ─── List panel ───────────────────────────────────────────────────────────────

function ListPanel({
  list, data, isActive, shortages, legacyManualCount, onMigrateLegacy, onAddShortage, onDismissShortage, onBack, onDelete, userName,
}: {
  list: ShoppingListDoc;
  data: ReturnType<typeof useShoppingData>;
  isActive: boolean;
  shortages: Shortage[];
  legacyManualCount: number;
  onMigrateLegacy: () => Promise<void>;
  onAddShortage: (s: Shortage, categoryId: string | null) => Promise<void>;
  onDismissShortage: (s: Shortage) => void;
  onBack: () => void;
  onDelete: () => void;
  userName: string;
}) {
  const actions = useMemo(() => listActions(list.id), [list.id]);
  const checked = list.checked || {};
  const removed = list.removed || {};
  const [query, setQuery] = useState('');
  const [hideBought, setHideBought] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // מאחדים: מצרכים מחושבים מההזמנות + מצרכים שנוספו ידנית/מחוסרים, לפי אותו מפתח
  const rows = useMemo(() => {
    const map = new Map<string, Row & { parts: Map<string, number>; computed?: ComputedItem; extraCategory?: string | null }>();
    for (const it of data.items) {
      map.set(it.key, {
        key: it.key, name: it.name, qtyText: '', sources: it.sources.length ? [`בשביל ${it.sources.join(', ')}`] : [],
        category: '', extraIds: [], parts: new Map([[it.unit?.trim() || '', it.qty]]), computed: it,
      });
    }
    for (const [id, ex] of Object.entries(list.extras || {})) {
      const key = ingredientKey(ex.name, data.ingredientMappings);
      let r = map.get(key);
      if (!r) {
        r = { key, name: ex.name, qtyText: '', sources: [], category: '', extraIds: [], parts: new Map(), extraCategory: ex.category };
        map.set(key, r);
      }
      const unit = ex.unit?.trim() || '';
      r.parts.set(unit, (r.parts.get(unit) || 0) + (Number(ex.qty) || 0));
      r.extraIds.push(id);
      if (ex.source) r.sources.push(ex.source);
    }
    const out: Row[] = [];
    for (const r of map.values()) {
      const category =
        data.itemCategories[r.key] ?? (r.computed ? data.itemCategories[r.computed.altKey] : undefined) ?? r.extraCategory ?? 'other';
      const qtyText = [...r.parts.entries()].filter(([, q]) => q > 0).map(([u, q]) => `${fmtQty(q)}${u ? ` ${u}` : ''}`).join(' + ') || '—';
      out.push({ key: r.key, name: r.name, qtyText, sources: r.sources, category, extraIds: r.extraIds });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [data.items, data.itemCategories, data.ingredientMappings, list.extras]);

  const visibleRows = rows.filter(r => !removed[r.key]);
  const removedRows = rows.filter(r => removed[r.key]);
  const rowKeys = useMemo(() => new Map(visibleRows.map(r => [r.key, r.name])), [visibleRows]);
  const total = visibleRows.length;
  const bought = visibleRows.filter(r => checked[r.key]).length;
  const allDone = total > 0 && bought === total;

  const knownCategoryIds = new Set(data.categories.map(c => c.id));
  const sectionCats: Array<{ cat: Category; index: number }> = data.categories.map((cat, index) => ({ cat, index }));
  if (!knownCategoryIds.has('other')) sectionCats.push({ cat: { id: 'other', name: 'כללי', emoji: '', color: '' }, index: sectionCats.length });
  const catOf = (r: Row) => (knownCategoryIds.has(r.category) ? r.category : 'other');

  const q = query.trim();
  const sections = sectionCats
    .map(({ cat, index }) => {
      const all = visibleRows.filter(r => catOf(r) === cat.id);
      const shown = all.filter(r => (!hideBought || !checked[r.key]) && (!q || r.name.includes(q)));
      return { cat, color: categoryColor(cat, index), all, shown };
    })
    .filter(s => s.all.length > 0);

  const moveToCategory = async (row: Row, catId: string) => {
    setMenuFor(null);
    try {
      await updateDoc(doc(db, 'orderSettings', 'shoppingCategories'), new FieldPath('itemCategories', row.key), catId);
    } catch (e) {
      console.error(e);
      toast.error(`ההעברה לא נשמרה. ${RETRY}`);
    }
  };

  const jumpTo = (catId: string) => {
    setJumpOpen(false);
    setActiveCat(catId);
    setCollapsed(c => ({ ...c, [catId]: false }));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => document.getElementById(`cat-${catId}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  };

  // כל הקטגוריות לסרגל — גם ריקות, כדי שקטגוריה חדשה תופיע מיד
  const railItems = sectionCats.map(({ cat, index }) => {
    const all = visibleRows.filter(r => catOf(r) === cat.id);
    return {
      id: cat.id,
      name: cat.name,
      color: categoryColor(cat, index),
      done: all.filter(r => checked[r.key]).length,
      total: all.length,
      editable: knownCategoryIds.has(cat.id),
      deletable: knownCategoryIds.has(cat.id) && cat.id !== 'other',
    };
  });

  // הקטגוריה שגוללים בה עכשיו — מודגשת בסרגל
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionIds = sections.map(s => s.cat.id).join('|');
  useEffect(() => {
    const els = sectionIds.split('|').map(id => document.getElementById(`cat-${id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCat(visible[0].target.id.replace(/^cat-/, ''));
      },
      { rootMargin: '-15% 0px -65% 0px' }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [sectionIds]);

  // הפס התחתון במסך צר — ההודעות עולות מעליו
  const hasBar = sections.length > 0;
  useEffect(() => {
    if (!hasBar) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => document.documentElement.style.setProperty('--toast-offset', mq.matches ? '72px' : '0px');
    apply();
    mq.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); document.documentElement.style.removeProperty('--toast-offset'); };
  }, [hasBar]);

  const categoriesRef = doc(db, 'orderSettings', 'shoppingCategories');
  const realCategories = data.categories.filter(c => knownCategoryIds.has(c.id));
  const addCategory = async (name: string) => {
    const id = `cat_${Date.now().toString(36)}`;
    const color = PALETTE[realCategories.length % PALETTE.length];
    try {
      await updateDoc(categoriesRef, { categories: [...realCategories, { id, name, emoji: '', color }], updatedAt: new Date().toISOString() });
      toast.success(`הקטגוריה "${name}" נוספה`);
    } catch (e) {
      console.error(e);
      toast.error(`הוספת הקטגוריה נכשלה. ${RETRY}`);
    }
  };
  const renameCategory = async (id: string, name: string) => {
    try {
      await updateDoc(categoriesRef, { categories: realCategories.map(c => (c.id === id ? { ...c, name } : c)), updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error(e);
      toast.error(`שינוי השם לא נשמר. ${RETRY}`);
    }
  };
  const deleteCategory = async (id: string) => {
    // מצרכים מהקטגוריה עוברים ל"כללי"
    const moves: unknown[] = [];
    for (const [k, v] of Object.entries(data.itemCategories)) if (v === id) moves.push(new FieldPath('itemCategories', k), 'other');
    try {
      await updateDoc(categoriesRef, 'categories', realCategories.filter(c => c.id !== id), ...moves);
      toast.success('הקטגוריה נמחקה, המצרכים שלה עברו ל"כללי"');
    } catch (e) {
      console.error(e);
      toast.error(`מחיקת הקטגוריה נכשלה. ${RETRY}`);
    }
  };

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pb-28 pt-4 lg:max-w-[1060px] lg:pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <button onClick={onBack} className="flex h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-[#4D4342] md:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          כל הרשימות
        </button>
        <div className="flex items-start justify-between gap-2">
          <h2 className={`${displayFont.className} text-balance text-[32px] font-semibold leading-tight`}>{list.name}</h2>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="מחיקת הרשימה"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[#6E6260] hover:bg-[#F2EAE7]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </div>
        <div className="text-[15px] tabular-nums text-[#4D4342]">
          {longRange(list.start, list.end)}
          {!data.loading && `, מתוך ${data.ordersCount === 1 ? 'הזמנה אחת' : `${data.ordersCount} הזמנות`}`}
          {!isActive && '. הרשימה הסתיימה'}
        </div>
        {confirmDelete && (
          <div role="alertdialog" aria-label="מחיקת הרשימה" className="mt-2 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-[#FCEBE9] px-3.5 py-3">
            <span className="text-[15px] font-semibold text-[#8E1F18]">למחוק את הרשימה? הסימונים שלה יימחקו, ההזמנות לא.</span>
            <span className="flex gap-1.5">
              <button onClick={() => { setConfirmDelete(false); onDelete(); }} className="h-10 rounded-xl bg-[#B3261E] px-3.5 text-sm font-bold text-white">מחיקה</button>
              <button onClick={() => setConfirmDelete(false)} className="h-10 rounded-xl bg-white px-3.5 text-sm font-semibold">ביטול</button>
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span aria-live="polite" className={`${displayFont.className} text-[22px] font-semibold tabular-nums`}>
            {data.loading ? 'טוען מצרכים…' : total === 0 ? 'אין מצרכים ברשימה' : allDone ? 'הכל נקנה' : `${bought} מתוך ${total} נקנו`}
          </span>
          <span className="text-sm text-[#6E6260]">מתעדכנת מההזמנות</span>
        </div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#EDE5E2]">
          <div
            className="h-2 rounded transition-[width] duration-300"
            style={{ width: `${total ? Math.round((bought / total) * 100) : 0}%`, backgroundColor: allDone ? GREEN : ROSE }}
          />
        </div>
      </div>

      {shortages.length > 0 && (
        <ShortagesBox
          shortages={shortages}
          targetList={list}
          itemCategories={data.itemCategories}
          ingredientMappings={data.ingredientMappings}
          categories={data.categories}
          rowKeys={rowKeys}
          onAdd={onAddShortage}
          onDismiss={onDismissShortage}
        />
      )}

      {legacyManualCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F2EAE7] px-4 py-3">
          <span className="text-[15px]">
            {legacyManualCount === 1 ? 'מצרך אחד נוסף ידנית ברשימה הישנה.' : `${legacyManualCount} מצרכים נוספו ידנית ברשימה הישנה.`}
          </span>
          <button
            disabled={migrating}
            onClick={async () => { setMigrating(true); await onMigrateLegacy(); setMigrating(false); }}
            className="h-10 rounded-xl bg-white px-3 text-sm font-bold disabled:opacity-50"
          >
            {migrating ? 'מעביר…' : 'העברה לרשימה הזו'}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[200px] flex-1 items-center">
          <span className="sr-only">חיפוש מצרך</span>
          <svg className="pointer-events-none absolute right-3 text-[#6E6260]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מצרך…"
            autoComplete="off"
            className="h-11 w-full rounded-[14px] border border-[#E3D8DC] bg-white pl-3 pr-10 text-base"
          />
        </label>
        <button
          onClick={() => setHideBought(v => !v)}
          aria-pressed={hideBought}
          className={`h-11 rounded-[14px] px-3.5 text-[15px] font-semibold ${hideBought ? 'bg-[#231C1C] text-white' : 'bg-[#F2EAE7]'}`}
        >
          {hideBought ? 'הצגת הכל' : 'הסתרת מה שנקנה'}
        </button>
      </div>

      {/* פס קטגוריות קבוע בתחתית — במסך צר */}
      {sections.length > 0 && !jumpOpen && (() => {
        const current = sections.find(x => x.cat.id === activeCat) || sections[0];
        const done = current.all.filter(r => checked[r.key]).length;
        return (
          <button
            onClick={() => setJumpOpen(true)}
            aria-haspopup="dialog"
            aria-label={`קטגוריות. עכשיו ב${current.cat.name}, ${done} מתוך ${current.all.length} נקנו. פתיחת כל הקטגוריות`}
            className="cat-bar fixed inset-x-3 z-30 mx-auto flex h-14 max-w-md items-center gap-3 rounded-[18px] bg-[#231C1C] px-4 text-right text-white shadow-[0_10px_30px_rgba(35,28,28,0.28)] active:scale-[.98] lg:hidden"
            style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <span aria-hidden="true" className="h-3 w-3 flex-shrink-0 rounded" style={{ backgroundColor: current.color }} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[16px] font-bold">{current.cat.name}</span>
              <span className="text-[12px] tabular-nums text-white/75">
                {done === current.all.length ? 'הכל נקנה' : `${done} מתוך ${current.all.length} נקנו`}
              </span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1.5 text-[14px] font-semibold text-white/90">
              כל הקטגוריות
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
            </span>
          </button>
        );
      })()}

      {jumpOpen && (
        <CategoryDrawer onClose={() => setJumpOpen(false)}>
          <CategoryRail
            items={railItems}
            activeId={activeCat}
            onJump={jumpTo}
            onAdd={addCategory}
            onRename={renameCategory}
            onDelete={deleteCategory}
          />
        </CategoryDrawer>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside aria-label="ניווט בין קטגוריות" className="hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <CategoryRail
            items={railItems}
            activeId={activeCat}
            onJump={jumpTo}
            onAdd={addCategory}
            onRename={renameCategory}
            onDelete={deleteCategory}
          />
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
      {/* Sections */}
      {sections.map(s => {
        const open = !collapsed[s.cat.id];
        const done = s.all.filter(r => checked[r.key]).length;
        return (
          <section key={s.cat.id} id={`cat-${s.cat.id}`} aria-label={s.cat.name} className="flex scroll-mt-4 flex-col">
            <button
              onClick={() => setCollapsed(c => ({ ...c, [s.cat.id]: open }))}
              aria-expanded={open}
              className="flex min-h-[52px] items-center gap-2.5 border-b-2 border-[#F0E8E5] py-1.5 text-right"
            >
              <span aria-hidden="true" className="h-3 w-3 flex-shrink-0 rounded" style={{ backgroundColor: s.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-lg font-bold">{s.cat.name}</span>
                <span className="text-[13px] tabular-nums text-[#6E6260]">
                  {done === s.all.length ? 'הכל נקנה' : `${done} מתוך ${s.all.length} נקנו`}
                </span>
              </span>
              <svg className={`flex-shrink-0 transition-transform ${open ? '' : 'rotate-90'}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E6260" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>

            {open && (
              <div className="flex flex-col">
                {s.shown.length === 0 && <div className="py-3.5 text-sm text-[#6E6260]">{q ? 'אין התאמה לחיפוש' : 'הכל כאן נקנה'}</div>}
                {s.shown.map(r => {
                  const on = !!checked[r.key];
                  const menuOpen = menuFor === r.key;
                  return (
                    <div key={r.key} className="flex flex-col">
                      <div className={`-mx-2.5 flex items-center gap-1 rounded-2xl px-2.5 py-0.5 transition-colors ${on ? 'bg-[#F1F7F2]' : ''}`}>
                        <button
                          onClick={() => actions.setChecked(r.key, !on)}
                          aria-pressed={on}
                          className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3.5 text-right"
                        >
                          <span
                            aria-hidden="true"
                            className={`box-border flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${on ? '' : 'border-[2.5px] border-[#B8ABA8]'}`}
                            style={on ? { backgroundColor: GREEN } : undefined}
                          >
                            {on && <svg className="vf-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className={`text-[17px] ${on ? 'text-[#6E6260] line-through decoration-[#B8ABA8]' : 'font-semibold'}`}>{r.name}</span>
                            {r.sources.length > 0 && <span className="break-words text-[13px] leading-snug text-[#6E6260]">{r.sources.join('. ')}</span>}
                          </span>
                          <span className={`${displayFont.className} flex-shrink-0 text-[19px] font-semibold tabular-nums ${on ? 'text-[#8C807E]' : ''}`}>{r.qtyText}</span>
                        </button>
                        <button
                          onClick={() => setMenuFor(menuOpen ? null : r.key)}
                          aria-expanded={menuOpen}
                          aria-label={`אפשרויות עבור ${r.name}`}
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[#6E6260] hover:bg-[#F2EAE7]"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                        </button>
                      </div>
                      {menuOpen && (
                        <div className="mb-2 mt-0.5 flex flex-col gap-2 rounded-2xl bg-[#F7F3F1] p-3">
                          <div className="text-[13px] text-[#6E6260]">העברה לקטגוריה (המערכת תזכור גם לרשימות הבאות)</div>
                          <div className="flex flex-wrap gap-1.5">
                            {sectionCats.map(({ cat }) => (
                              <button
                                key={cat.id}
                                onClick={() => moveToCategory(r, cat.id)}
                                className={`h-9 rounded-full px-3 text-sm ${catOf(r) === cat.id ? 'bg-[#231C1C] font-bold text-white' : 'bg-white'}`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => { setMenuFor(null); actions.setRemoved(r.key, true); }}
                            className="h-10 self-start rounded-xl bg-white px-3 text-sm font-bold text-[#B3261E]"
                          >
                            הסרה מהרשימה
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {removedRows.length > 0 && (
        <div className="flex flex-col gap-1">
          <button onClick={() => setShowRemoved(v => !v)} aria-expanded={showRemoved} className="h-11 self-start rounded-xl px-2 text-[15px] font-semibold text-[#4D4342] hover:bg-[#F2EAE7]">
            {showRemoved ? 'הסתרת מה שהוסר' : `הוסרו מהרשימה (${removedRows.length})`}
          </button>
          {showRemoved && removedRows.map(r => (
            <div key={r.key} className="flex min-h-[48px] items-center justify-between gap-2 border-t border-[#F0E8E5]">
              <span className="text-[15px] text-[#6E6260]">{r.name} <span className="tabular-nums">{r.qtyText}</span></span>
              <button onClick={() => actions.setRemoved(r.key, false)} className="h-10 rounded-xl bg-[#F2EAE7] px-3 text-sm font-semibold">החזרה</button>
            </div>
          ))}
        </div>
      )}

      <AddItemForm
        knownNames={data.knownNames}
        categories={sectionCats.map(s => s.cat)}
        itemCategories={data.itemCategories}
        ingredientMappings={data.ingredientMappings}
        onAdd={async (name, qty, unit, category) => {
          const key = ingredientKey(name, data.ingredientMappings);
          await actions.addExtra({ name, qty, unit, category, source: `נוסף על ידי ${userName}`, addedBy: userName });
          if (removed[key]) await actions.setRemoved(key, false);
          if (category && data.itemCategories[key] !== category) {
            updateDoc(doc(db, 'orderSettings', 'shoppingCategories'), new FieldPath('itemCategories', key), category).catch((e) => console.error(e));
          }
          toast.success(rowKeys.has(key) ? `הכמות נוספה ל${rowKeys.get(key)}` : `${name} נוסף לרשימה`);
        }}
      />
        </div>
      </div>
    </div>
  );
}

// ─── Category navigation ──────────────────────────────────────────────────────

interface RailItem {
  id: string;
  name: string;
  color: string;
  done: number;
  total: number;
  editable: boolean;
  deletable: boolean;
}

function CategoryRail({
  items, activeId, onJump, onAdd, onRename, onDelete,
}: {
  items: RailItem[];
  activeId: string | null;
  onJump: (id: string) => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const startEdit = (it: RailItem) => { setEditing(it.id); setDraft(it.name); setConfirmDelete(null); };

  return (
    <nav aria-label="קטגוריות" className="flex flex-col gap-1">
      <h3 className="mb-1 px-2 text-sm font-semibold text-[#6E6260]">קטגוריות</h3>
      {items.map(it => {
        const active = it.id === activeId;
        if (editing === it.id) {
          return (
            <form
              key={it.id}
              onSubmit={async (e) => {
                e.preventDefault();
                const name = draft.trim();
                if (name && name !== it.name) await onRename(it.id, name);
                setEditing(null);
              }}
              className="flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-[0_1px_0_#E7DDDA]"
            >
              <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
                שם הקטגוריה
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                  autoComplete="off"
                  className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]"
                />
              </label>
              <div className="flex gap-1.5">
                <button type="submit" className="h-10 flex-1 rounded-xl bg-[#231C1C] text-sm font-bold text-white">שמירה</button>
                <button type="button" onClick={() => setEditing(null)} className="h-10 rounded-xl bg-[#F2EAE7] px-3 text-sm font-semibold">ביטול</button>
              </div>
              {it.deletable && (
                confirmDelete === it.id ? (
                  <div className="flex flex-col gap-1.5 rounded-xl bg-[#FCEBE9] p-2.5">
                    <span className="text-sm font-semibold text-[#8E1F18]">
                      למחוק את "{it.name}"? {it.total ? `${it.total} מצרכים יעברו ל"כללי".` : ''}
                    </span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={async () => { await onDelete(it.id); setEditing(null); setConfirmDelete(null); }} className="h-10 rounded-xl bg-[#B3261E] px-3 text-sm font-bold text-white">מחיקה</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="h-10 rounded-xl bg-white px-3 text-sm font-semibold">ביטול</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(it.id)} className="h-10 self-start rounded-xl px-2 text-sm font-semibold text-[#B3261E] hover:bg-[#FCEBE9]">
                    מחיקת הקטגוריה
                  </button>
                )
              )}
            </form>
          );
        }
        return (
          <div
            key={it.id}
            className={`group flex items-center gap-1 rounded-2xl transition-colors ${active ? 'bg-white shadow-[0_0_0_2px_#A3204A]' : 'hover:bg-[#F0E8E5]'}`}
          >
            <button
              onClick={() => onJump(it.id)}
              aria-current={active ? 'true' : undefined}
              className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 py-2 pr-3 text-right"
            >
              <span aria-hidden="true" className="h-3 w-3 flex-shrink-0 rounded" style={{ backgroundColor: it.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`break-words text-[15px] leading-snug ${it.total ? 'font-semibold' : 'text-[#6E6260]'}`}>{it.name}</span>
                <span className="text-[12px] tabular-nums text-[#6E6260]">
                  {it.total === 0 ? 'ריקה' : it.done === it.total ? 'הכל נקנה' : `${it.done} מתוך ${it.total}`}
                </span>
              </span>
            </button>
            {it.editable && (
              <button
                onClick={() => startEdit(it)}
                aria-label={`עריכת הקטגוריה ${it.name}`}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[#6E6260] hover:bg-[#EDE5E2] lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
              </button>
            )}
          </div>
        );
      })}

      {adding ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            await onAdd(name);
            setNewName('');
            setAdding(false);
          }}
          className="mt-1 flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-[0_1px_0_#E7DDDA]"
        >
          <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
            שם הקטגוריה החדשה
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setAdding(false); }}
              placeholder="למשל: ספק ירקות…"
              autoComplete="off"
              className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]"
            />
          </label>
          <div className="flex gap-1.5">
            <button type="submit" disabled={!newName.trim()} className="h-10 flex-1 rounded-xl bg-[#231C1C] text-sm font-bold text-white disabled:opacity-50">הוספה</button>
            <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-xl bg-[#F2EAE7] px-3 text-sm font-semibold">ביטול</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 flex min-h-[44px] items-center gap-2 rounded-2xl px-3 text-[15px] font-semibold text-[#4D4342] hover:bg-[#F0E8E5]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          קטגוריה חדשה
        </button>
      )}
    </nav>
  );
}

// מגירה מהצד למסך צר — אותו סרגל קטגוריות
function CategoryDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="קטגוריות">
      <div className="drawer-fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        dir="rtl"
        className="drawer-in absolute inset-y-0 right-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto bg-[#F7F3F1] p-3 shadow-[0_0_40px_rgba(35,28,28,0.25)]"
        style={{ overscrollBehavior: 'contain', paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="mb-1 flex justify-end">
          <button onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#EDE5E2]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Add item ─────────────────────────────────────────────────────────────────

function AddItemForm({
  knownNames, categories, itemCategories, ingredientMappings, onAdd,
}: {
  knownNames: string[];
  categories: Category[];
  itemCategories: Record<string, string>;
  ingredientMappings: Record<string, string>;
  onAdd: (name: string, qty: number, unit: string, category: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // שם מוכר → הקטגוריה שהמערכת זוכרת עבורו
  const onName = (v: string) => {
    setName(v);
    const remembered = itemCategories[ingredientKey(v, ingredientMappings)];
    if (remembered) setCategory(remembered);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); requestAnimationFrame(() => nameRef.current?.focus()); }}
        className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#D9CFCD] text-base font-semibold text-[#4D4342] hover:bg-[#F7F3F1]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        הוספת מצרך לרשימה
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        await onAdd(name.trim(), parseFloat(qty) || 1, unit.trim(), category || null);
        setBusy(false);
        setName(''); setQty('1'); setUnit('');
        nameRef.current?.focus();
      }}
      className="flex flex-col gap-3 rounded-[20px] bg-[#F7F3F1] p-4"
    >
      <div className="text-[15px] font-semibold">הוספת מצרך</div>
      <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
        שם
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => onName(e.target.value)}
          list="known-ingredients"
          autoComplete="off"
          placeholder="למשל: נייר אפייה…"
          className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]"
        />
        <datalist id="known-ingredients">{knownNames.map(n => <option key={n} value={n} />)}</datalist>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
          כמות
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
          יחידה
          <input value={unit} onChange={(e) => setUnit(e.target.value)} list="known-units" autoComplete="off" placeholder="ק״ג…" className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]" />
          <datalist id="known-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
        קטגוריה
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]">
          <option value="">כללי</option>
          {categories.filter(c => c.id !== 'other').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim() || busy} className="h-12 flex-1 rounded-[14px] bg-[#231C1C] text-base font-bold text-white disabled:opacity-50">
          {busy ? 'מוסיף…' : 'הוספה'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-[14px] bg-white px-4 text-base font-semibold">סגירה</button>
      </div>
    </form>
  );
}

// ─── Categories (עריכה, זמני עד עיצוב ההגדרות) ───────────────────────────────

function CategoriesModal({
  categories, itemCategories, onClose,
}: {
  categories: Category[];
  itemCategories: Record<string, string>;
  onClose: () => void;
}) {
  const ref = doc(db, 'orderSettings', 'shoppingCategories');
  const save = (patch: Record<string, unknown>) =>
    updateDoc(ref, { ...patch, updatedAt: new Date().toISOString() }).catch((e) => {
      console.error(e);
      toast.error(`השינוי בקטגוריות לא נשמר. ${RETRY}`);
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="עריכת קטגוריות"
        dir="rtl"
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white md:max-w-3xl md:rounded-[24px]"
        style={{ overscrollBehavior: 'contain' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EAE1DE] px-4 py-3">
          <h2 className="text-lg font-bold">עריכת קטגוריות</h2>
          <button onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-[#F2EAE7]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          <CategoryManager
            categories={categories}
            selectedCategory="all"
            onSelectCategory={() => {}}
            onAddCategory={(cat) => save({ categories: [...categories, cat] })}
            onUpdateCategory={(id, name, emoji) =>
              save({ categories: categories.map(c => (c.id === id ? { ...c, name, emoji: emoji || c.emoji } : c)) })
            }
            onDeleteCategory={(id) => {
              const nextItems = { ...itemCategories };
              for (const k of Object.keys(nextItems)) if (nextItems[k] === id) nextItems[k] = 'other';
              save({ categories: categories.filter(c => c.id !== id), itemCategories: nextItems });
            }}
            onReorderCategories={(reordered) => {
              const real = reordered.filter(c => c.id !== 'all' && c.id !== '__shortages__');
              if (real.length >= categories.length) save({ categories: real });
            }}
            itemCounts={{}}
            totalItems={0}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Workers: report shortages ────────────────────────────────────────────────

function ReporterView({ userName }: { userName: string }) {
  const router = useRouter();
  const { shortages, report, removeReport } = useShortages();
  const { lists } = useShoppingLists();
  const data = useShoppingData(null);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const statusOf = useCallback((s: Shortage) => {
    if (s.status === 'dismissed') return { label: 'לא נדרש', tone: 'muted' as const };
    if (s.status === 'added') {
      const l = lists.find(x => x.id === s.listId);
      if (l && s.itemKey && l.checked?.[s.itemKey]) return { label: 'נקנה', tone: 'done' as const };
      return { label: `נוסף לרשימה${s.listName ? `: ${s.listName}` : ''}`, tone: 'added' as const };
    }
    return { label: 'ממתין לטיפול', tone: 'open' as const };
  }, [lists]);

  const visible = shortages.filter(s => s.status === 'open' || (s.reportedAt && Date.now() - s.reportedAt < 14 * 86_400_000));

  return (
    <div className="vf-page min-h-screen bg-[#F7F3F1] text-[#231C1C]" dir="rtl">
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pb-12 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/')} aria-label="חזרה לדף הבית" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#4D4342] hover:bg-[#EDE5E2]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <h1 className={`${displayFont.className} text-[30px] font-semibold`}>דיווח על חוסר</h1>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || busy) return;
            setBusy(true);
            const ok = await report(name.trim(), parseFloat(qty) || 1, unit.trim(), userName);
            setBusy(false);
            if (ok) { setName(''); setQty('1'); setUnit(''); nameRef.current?.focus(); }
          }}
          className="flex flex-col gap-3 rounded-[20px] bg-white p-4 shadow-[0_1px_0_#E7DDDA]"
        >
          <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
            מה חסר?
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              list="known-ingredients-r"
              autoComplete="off"
              placeholder="למשל: נייר אפייה…"
              className="h-12 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[17px] text-[#231C1C]"
            />
            <datalist id="known-ingredients-r">{data.knownNames.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
              כמות
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="h-12 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[17px] text-[#231C1C]" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
              יחידה
              <input value={unit} onChange={(e) => setUnit(e.target.value)} list="known-units-r" autoComplete="off" placeholder="ק״ג…" className="h-12 rounded-xl border border-[#E3D8DC] bg-white px-3 text-[17px] text-[#231C1C]" />
              <datalist id="known-units-r">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
            </label>
          </div>
          <button type="submit" disabled={!name.trim() || busy} className="h-[52px] rounded-[14px] text-[17px] font-bold text-white disabled:opacity-50" style={{ backgroundColor: ROSE }}>
            {busy ? 'שולח…' : 'שליחת הדיווח'}
          </button>
        </form>

        <section aria-label="דיווחים אחרונים" className="flex flex-col gap-1">
          <h2 className="mb-1 text-sm font-semibold text-[#6E6260]">דיווחים אחרונים</h2>
          {visible.length === 0 && <p className="text-[15px] text-[#6E6260]">אין דיווחים פתוחים</p>}
          {visible.map(s => {
            const st = statusOf(s);
            return (
              <div key={s.id} className="flex min-h-[60px] items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-base font-semibold">
                    {s.name} <span className="font-medium tabular-nums text-[#6E6260]">{fmtQty(s.qty)} {s.unit}</span>
                  </span>
                  <span className="text-[13px] text-[#6E6260]">{s.reportedBy}{s.reportedAt ? `, ${timeAgo(s.reportedAt)}` : ''}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                      st.tone === 'done' ? 'bg-[#E8F4EC] text-[#1E6B37]' : st.tone === 'added' ? 'bg-[#F2EAE7] text-[#4D4342]' : st.tone === 'open' ? 'bg-[#FFF1DE] text-[#7A4D00]' : 'text-[#6E6260]'
                    }`}
                  >
                    {st.label}
                  </span>
                  {s.status === 'open' && s.reportedBy === userName && (
                    <button onClick={() => removeReport(s)} aria-label={`מחיקת הדיווח על ${s.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6E6260] hover:bg-[#F2EAE7]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

