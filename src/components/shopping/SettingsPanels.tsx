'use client';

import { useMemo, useState } from 'react';
import { displayFont } from '@/lib/fonts';
import { resolveDish } from '@/lib/shopping/compute';
import { setIngredientIgnored, setItemCategory } from '@/lib/shopping/settingsActions';
import type { ShoppingData } from '@/hooks/useShoppingData';
import { STATUS_LABEL, statusTone } from './DishEditor';

function PanelHeader({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <button onClick={onBack} className="flex h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-[#4D4342]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        חזרה לרשימה
      </button>
      <h2 className={`${displayFont.className} text-[32px] font-semibold leading-tight`}>{title}</h2>
      <p className="text-[15px] text-[#4D4342]">{sub}</p>
    </div>
  );
}

function Filters<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string, number?]>; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label="סינון" className="flex flex-wrap gap-1.5">
      {options.map(([v, label, count]) => (
        <button
          key={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`h-9 rounded-full px-3.5 text-sm ${value === v ? 'bg-[#231C1C] font-semibold text-white' : 'border border-[#E3D8DC] bg-white text-[#4D4342]'}`}
        >
          {label}{count !== undefined ? ` (${count})` : ''}
        </button>
      ))}
    </div>
  );
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{placeholder}</span>
      <svg className="pointer-events-none absolute right-3 text-[#6E6260]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" className="h-11 w-full rounded-[14px] border border-[#E3D8DC] bg-white pl-3 pr-10 text-base" />
    </label>
  );
}

// ─── מנות ומתכונים ────────────────────────────────────────────────────────────

type DishFilter = 'all' | 'missing' | 'custom' | 'excluded';

export function DishesPanel({ data, onEdit, onBack }: { data: ShoppingData; onEdit: (dish: string) => void; onBack: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DishFilter>('all');

  const dishes = useMemo(() => {
    const names = new Set([...data.allMenuItems, ...data.dishes.map(d => d.dish)]);
    return [...names]
      .map(dish => {
        const r = resolveDish(dish, { recipes: data.recipes, recipeLinks: data.recipeLinks, recipeSettings: data.recipeSettings });
        return { dish, status: r.status, recipeTitle: r.recipe?.title || null };
      })
      .sort((a, b) => a.dish.localeCompare(b.dish, 'he'));
  }, [data.allMenuItems, data.dishes, data.recipes, data.recipeLinks, data.recipeSettings]);

  const count = (f: DishFilter) => dishes.filter(d => match(d.status, f)).length;
  const shown = dishes.filter(d => match(d.status, filter) && (!q.trim() || d.dish.includes(q.trim())));

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pb-12 pt-4">
      <PanelHeader title="מנות ומתכונים" sub="מה קונים בשביל כל מנה בתפריט. לחיצה על מנה פותחת את ההגדרות שלה." onBack={onBack} />
      {count('missing') > 0 && (
        <div className="rounded-2xl bg-[#FCEBE9] px-4 py-3 text-[15px] text-[#8E1F18]">
          {count('missing') === 1 ? 'מנה אחת לא נספרת' : `${count('missing')} מנות לא נספרות`} ברשימות הקניות, כי אין להן מתכון או רכיבים.
        </div>
      )}
      <Search value={q} onChange={setQ} placeholder="חיפוש מנה…" />
      <Filters
        value={filter}
        onChange={setFilter}
        options={[['all', 'הכל', dishes.length], ['missing', 'חסר מתכון', count('missing')], ['custom', 'עם שינויים', count('custom')], ['excluded', 'לא נכלל', count('excluded')]]}
      />
      <div className="flex flex-col">
        {shown.length === 0 && <p className="py-6 text-center text-[15px] text-[#6E6260]">אין מנות שמתאימות</p>}
        {shown.map(d => (
          <button
            key={d.dish}
            onClick={() => onEdit(d.dish)}
            className="flex min-h-[60px] items-center justify-between gap-3 border-b border-[#F0E8E5] py-2 text-right hover:bg-[#FBF8F7]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="break-words text-[17px] font-semibold">{d.dish}</span>
              {d.recipeTitle && d.recipeTitle !== d.dish && <span className="text-[13px] text-[#6E6260]">מתכון: {d.recipeTitle}</span>}
            </span>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${statusTone(d.status)}`}>{STATUS_LABEL[d.status]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function match(status: string, f: DishFilter) {
  if (f === 'all') return true;
  if (f === 'custom') return status === 'custom' || status === 'manual';
  return status === f;
}

// ─── רכיבים ───────────────────────────────────────────────────────────────────

type IngFilter = 'all' | 'ignored' | 'uncategorized';

export function IngredientsPanel({ data, onBack }: { data: ShoppingData; onBack: () => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<IngFilter>('all');
  const knownCats = new Set(data.categories.map(c => c.id));
  const catOptions = data.categories.some(c => c.id === 'other') ? data.categories : [...data.categories, { id: 'other', name: 'כללי', color: '' }];

  const rows = data.catalog.map(c => {
    const cat = data.itemCategories[c.key];
    return { ...c, ignored: !!data.ignoredIngredients[c.key], category: cat && knownCats.has(cat) ? cat : 'other', uncategorized: !cat || !knownCats.has(cat) || cat === 'other' };
  });
  const count = (f: IngFilter) => rows.filter(r => (f === 'all' ? true : f === 'ignored' ? r.ignored : r.uncategorized && !r.ignored)).length;
  const shown = rows.filter(r =>
    (filter === 'all' || (filter === 'ignored' ? r.ignored : r.uncategorized && !r.ignored)) &&
    (!q.trim() || r.name.includes(q.trim()))
  );

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-5 pb-12 pt-4">
      <PanelHeader title="רכיבים" sub="כל הרכיבים מהמתכונים. רכיב שמסומן ״לא קונים״ לא ייכנס לאף רשימה, למשל מים או מלח." onBack={onBack} />
      <Search value={q} onChange={setQ} placeholder="חיפוש רכיב…" />
      <Filters
        value={filter}
        onChange={setFilter}
        options={[['all', 'הכל', rows.length], ['ignored', 'לא קונים', count('ignored')], ['uncategorized', 'בלי קטגוריה', count('uncategorized')]]}
      />
      <div className="flex flex-col">
        {shown.length === 0 && <p className="py-6 text-center text-[15px] text-[#6E6260]">אין רכיבים שמתאימים</p>}
        {shown.map(r => (
          <div key={r.key} className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#F0E8E5] py-3 ${r.ignored ? 'opacity-70' : ''}`}>
            <span className="flex min-w-[160px] flex-1 flex-col">
              <span className={`text-[17px] font-semibold ${r.ignored ? 'text-[#6E6260] line-through decoration-[#B8ABA8]' : ''}`}>{r.name}</span>
              <span className="break-words text-[13px] leading-snug text-[#6E6260]">
                {r.recipes.length === 1 ? `ב${r.recipes[0]}` : `ב-${r.recipes.length} מתכונים: ${r.recipes.slice(0, 4).join(', ')}${r.recipes.length > 4 ? ' ועוד' : ''}`}
              </span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-1.5">
              {!r.ignored && (
                <label>
                  <span className="sr-only">קטגוריה של {r.name}</span>
                  <select
                    value={r.category}
                    onChange={(e) => setItemCategory(r.key, e.target.value)}
                    className="h-10 max-w-[150px] rounded-xl border border-[#E3D8DC] bg-white px-2 text-sm"
                  >
                    {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <button
                onClick={() => setIngredientIgnored(r.key, !r.ignored)}
                aria-pressed={!r.ignored}
                className={`h-10 rounded-xl px-3 text-sm font-bold ${r.ignored ? 'bg-[#231C1C] text-white' : 'bg-[#E8F4EC] text-[#1E6B37]'}`}
              >
                {r.ignored ? 'לא קונים' : 'קונים'}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
