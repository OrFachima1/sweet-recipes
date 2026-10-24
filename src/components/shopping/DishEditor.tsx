'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { displayFont } from '@/lib/fonts';
import { toast } from '@/lib/toast';
import { fmtQty, normalizeIngredientName, overridesOf, resolveDish } from '@/lib/shopping/compute';
import { saveDishSetting, setRecipeLink } from '@/lib/shopping/settingsActions';
import type { DishIngredient, DishSetting } from '@/lib/shopping/types';
import type { ShoppingData } from '@/hooks/useShoppingData';

const SAVE_DELAY = 600;

interface Draft {
  enabled: boolean;
  multiplier: number;
  disabled: string[];
  overrides: Record<string, DishIngredient>;
  extras: DishIngredient[];      // במצב מתכון: תוספות; בלי מתכון: כל הרכיבים
}

export const STATUS_LABEL: Record<string, string> = {
  recipe: 'לפי המתכון',
  custom: 'עם שינויים',
  manual: 'רכיבים ידניים',
  excluded: 'לא נכלל',
  missing: 'חסר מתכון',
};

export function statusTone(status: string) {
  if (status === 'missing') return 'bg-[#FCEBE9] text-[#8E1F18]';
  if (status === 'excluded') return 'bg-[#EDE5E2] text-[#4D4342]';
  if (status === 'custom' || status === 'manual') return 'bg-[#FFF1DE] text-[#7A4D00]';
  return 'bg-[#E8F4EC] text-[#1E6B37]';
}

function draftFrom(setting: DishSetting | undefined, recipeId: string | null): Draft {
  if (!setting) return { enabled: true, multiplier: 1, disabled: [], overrides: {}, extras: [] };
  const base = { enabled: setting.enabled !== false, multiplier: setting.multiplier || 1 };
  if (!recipeId) {
    const list = (setting.customIngredients || []).filter(i => i.enabled !== false && i.name?.trim());
    return { ...base, disabled: [], overrides: {}, extras: list.map(i => ({ name: i.name, qty: Number(i.qty) || 0, unit: i.unit })) };
  }
  const applies = setting.mode === 'overrides' ? setting.forRecipeId === recipeId : setting.originalRecipeId === recipeId;
  if (!applies) return { ...base, multiplier: 1, disabled: [], overrides: {}, extras: [] };
  const ov = overridesOf(setting);
  return { ...base, disabled: [...ov.disabled], overrides: ov.overrides, extras: ov.extras };
}

// מה שנשמר: רק השינויים. מנה בלי שום שינוי — בלי הגדרה בכלל
function settingFrom(dish: string, recipeId: string | null, d: Draft): DishSetting | null {
  const extras = d.extras.filter(e => e.name.trim());
  if (!recipeId) {
    if (d.enabled && !extras.length && d.multiplier === 1) return null;
    return {
      menuItemName: dish, enabled: d.enabled, multiplier: d.multiplier, mode: 'manual',
      customIngredients: extras.map(e => ({ name: e.name.trim(), qty: e.qty, unit: e.unit.trim(), enabled: true })),
    };
  }
  const untouched = d.enabled && d.multiplier === 1 && !d.disabled.length && !Object.keys(d.overrides).length && !extras.length;
  if (untouched) return null;
  return {
    menuItemName: dish, enabled: d.enabled, multiplier: d.multiplier, mode: 'overrides', forRecipeId: recipeId,
    disabled: d.disabled, overrides: d.overrides, extras: extras.map(e => ({ ...e, name: e.name.trim(), unit: e.unit.trim() })),
  };
}

export default function DishEditor({ dish, data, onClose }: { dish: string; data: ShoppingData; onClose: () => void }) {
  const recipeId = data.recipeLinks[dish] || null;
  const recipe = recipeId ? data.recipes.find(r => r.id === recipeId) || null : null;
  const setting = data.recipeSettings.find(s => s.menuItemName === dish);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(setting, recipeId));
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);

  // החלפת מתכון מבחוץ (או במסך הזה) — מתחילים מחדש מההגדרה של המתכון החדש
  const linkKey = recipeId || 'none';
  const [seenLink, setSeenLink] = useState(linkKey);
  if (seenLink !== linkKey) {
    const fresh = draftFrom(setting, recipeId);
    setSeenLink(linkKey);
    latest.current = fresh;
    setDraft(fresh);
  }

  const resolved = resolveDish(dish, { recipes: data.recipes, recipeLinks: data.recipeLinks, recipeSettings: data.recipeSettings });

  const flush = async (d: Draft) => {
    setSaving('pending');
    const ok = await saveDishSetting(dish, settingFrom(dish, recipeId, d));
    setSaving(ok ? 'saved' : 'idle');
  };
  // שינוי מיידי (מתג/כפתור) נשמר מיד; הקלדה — אחרי הפסקה קצרה
  const update = (fn: (d: Draft) => Draft, immediate = false) => {
    const next = fn(latest.current);
    latest.current = next;
    setDraft(next);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (immediate) flush(next);
    else { setSaving('pending'); timer.current = setTimeout(() => { timer.current = null; flush(latest.current); }, SAVE_DELAY); }
  };
  // שינוי שעוד לא נשמר נשמר בסגירה
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush(latest.current); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recipeRows = useMemo(() => {
    const rows: Array<{ key: string; name: string; qty: number; unit: string }> = [];
    for (const g of recipe?.ingredients || []) for (const ing of g.items || []) {
      if (ing.name?.trim()) rows.push({ key: normalizeIngredientName(ing.name), name: ing.name, qty: parseFloat(ing.qty) || 0, unit: ing.unit });
    }
    return rows;
  }, [recipe]);

  const changeRecipe = async (id: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await setRecipeLink(dish, id || null);
  };

  const resetAll = async () => {
    const before = setting;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ok = await saveDishSetting(dish, null);
    if (!ok) return;
    const empty = { enabled: true, multiplier: 1, disabled: [], overrides: {}, extras: [] };
    latest.current = empty;
    setDraft(empty);
    toast.success('ההגדרות של המנה אופסו', before ? { action: { label: 'ביטול', onClick: () => saveDishSetting(dish, before) } } : undefined);
  };

  const sortedRecipes = useMemo(() => [...data.recipes].sort((a, b) => a.title.localeCompare(b.title, 'he')), [data.recipes]);
  const input = 'h-11 rounded-xl border border-[#E3D8DC] bg-white px-3 text-base text-[#231C1C]';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-editor-title"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="drawer-up flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white text-[#231C1C] md:max-w-2xl md:rounded-[24px]"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#EAE1DE] px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="dish-editor-title" className={`${displayFont.className} break-words text-[26px] font-semibold leading-tight`}>{dish}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${statusTone(resolved.status)}`}>{STATUS_LABEL[resolved.status]}</span>
              <span aria-live="polite" className="text-[#6E6260]">
                {saving === 'pending' ? 'שומר…' : saving === 'saved' ? 'נשמר' : 'שינויים נשמרים אוטומטית'}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl hover:bg-[#F2EAE7]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* לכלול */}
          <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#F7F3F1] px-4">
            <span className="flex flex-col">
              <span className="text-base font-semibold">לקנות בשביל המנה הזו</span>
              <span className="text-[13px] text-[#6E6260]">כשכבוי, ההזמנות של המנה לא נכנסות לרשימת הקניות</span>
            </span>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => update(d => ({ ...d, enabled: e.target.checked }), true)}
              className="h-6 w-6 flex-shrink-0 cursor-pointer accent-[#1E6B37]"
            />
          </label>

          {draft.enabled && (
            <>
              {/* מתכון */}
              <label className="flex flex-col gap-1 text-[13px] text-[#6E6260]">
                מתכון
                <select value={recipeId || ''} onChange={(e) => changeRecipe(e.target.value)} className={input}>
                  <option value="">בלי מתכון (רכיבים ידניים)</option>
                  {sortedRecipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </label>

              {/* כמה מנות */}
              <label className="flex flex-wrap items-center gap-2 text-base">
                {recipe ? 'המתכון מספיק ל' : 'הרכיבים מספיקים ל'}
                <input
                  type="number"
                  min={1}
                  step="any"
                  inputMode="decimal"
                  value={draft.multiplier}
                  onChange={(e) => update(d => ({ ...d, multiplier: Math.max(0.01, parseFloat(e.target.value) || 1) }))}
                  className={`${input} w-24 text-center tabular-nums`}
                />
                מנות
              </label>

              {/* רכיבי המתכון */}
              {recipe && (
                <section aria-label="רכיבי המתכון" className="flex flex-col">
                  <h3 className="mb-1 text-[15px] font-semibold text-[#4D4342]">רכיבים מהמתכון</h3>
                  {recipeRows.length === 0 && <p className="text-sm text-[#6E6260]">אין רכיבים במתכון</p>}
                  {recipeRows.map(row => {
                    const off = draft.disabled.includes(row.key);
                    const o = draft.overrides[row.key];
                    const globallyIgnored = data.ignoredIngredients[row.key];
                    return (
                      <div key={row.key} className="flex flex-wrap items-center gap-2 border-t border-[#F0E8E5] py-2">
                        <button
                          onClick={() => update(d => ({ ...d, disabled: off ? d.disabled.filter(k => k !== row.key) : [...d.disabled, row.key] }), true)}
                          aria-pressed={!off}
                          className={`h-9 flex-shrink-0 rounded-full px-3 text-sm font-bold ${off ? 'bg-[#EDE5E2] text-[#4D4342]' : 'bg-[#E8F4EC] text-[#1E6B37]'}`}
                        >
                          {off ? 'לא קונים' : 'קונים'}
                        </button>
                        <span className={`min-w-0 flex-1 text-base ${off ? 'text-[#8C807E] line-through' : 'font-medium'}`}>
                          {row.name}
                          {globallyIgnored && <span className="block text-[12px] text-[#6E6260] no-underline">לא נקנה אף פעם (מסך רכיבים)</span>}
                        </span>
                        {!off && (
                          <span className="flex flex-shrink-0 items-center gap-1.5">
                            <label className="flex items-center gap-1">
                              <span className="sr-only">כמות {row.name}</span>
                              <input
                                inputMode="decimal"
                                value={o ? String(o.qty) : ''}
                                placeholder={fmtQty(row.qty)}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  const n = parseFloat(v);
                                  update(d => {
                                    const overrides = { ...d.overrides };
                                    if (!v || Number.isNaN(n) || n === row.qty) delete overrides[row.key];
                                    else overrides[row.key] = { name: row.name, qty: n, unit: row.unit };
                                    return { ...d, overrides };
                                  });
                                }}
                                className={`h-10 w-20 rounded-xl border bg-white px-2 text-center text-base tabular-nums ${o ? 'border-[#E8C37A] bg-[#FFF8EA]' : 'border-[#E3D8DC]'}`}
                              />
                            </label>
                            <span className="w-12 text-sm text-[#4D4342]">{row.unit}</span>
                            {o && (
                              <button
                                onClick={() => update(d => { const overrides = { ...d.overrides }; delete overrides[row.key]; return { ...d, overrides }; }, true)}
                                className="h-9 rounded-lg px-2 text-[13px] font-semibold text-[#7A4D00] hover:bg-[#FFF1DE]"
                              >
                                חזרה למתכון
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {/* תוספות / רכיבים ידניים */}
              <section aria-label={recipe ? 'רכיבים נוספים' : 'רכיבים'} className="flex flex-col">
                <h3 className="mb-1 text-[15px] font-semibold text-[#4D4342]">{recipe ? 'רכיבים נוספים, מעבר למתכון' : 'רכיבים למנה'}</h3>
                {!recipe && draft.extras.length === 0 && (
                  <p className="mb-2 text-sm text-[#8E1F18]">בלי מתכון ובלי רכיבים, המנה לא נספרת ברשימת הקניות</p>
                )}
                {draft.extras.map((ex, i) => (
                  <div key={i} className="flex items-center gap-1.5 border-t border-[#F0E8E5] py-2">
                    <input
                      value={ex.name}
                      onChange={(e) => update(d => ({ ...d, extras: d.extras.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
                      list="dish-ingredient-names"
                      placeholder="שם רכיב…"
                      aria-label="שם רכיב"
                      autoComplete="off"
                      className={`${input} min-w-0 flex-1`}
                    />
                    <input
                      inputMode="decimal"
                      value={ex.qty ? String(ex.qty) : ''}
                      onChange={(e) => update(d => ({ ...d, extras: d.extras.map((x, j) => (j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x)) }))}
                      placeholder="כמות"
                      aria-label="כמות"
                      className={`${input} w-20 text-center tabular-nums`}
                    />
                    <input
                      value={ex.unit}
                      onChange={(e) => update(d => ({ ...d, extras: d.extras.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) }))}
                      placeholder="יחידה"
                      aria-label="יחידה"
                      autoComplete="off"
                      className={`${input} w-20`}
                    />
                    <button
                      onClick={() => update(d => ({ ...d, extras: d.extras.filter((_, j) => j !== i) }), true)}
                      aria-label={`הסרת ${ex.name || 'הרכיב'}`}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[#6E6260] hover:bg-[#F2EAE7]"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                ))}
                <datalist id="dish-ingredient-names">{data.knownNames.map(n => <option key={n} value={n} />)}</datalist>
                <button
                  onClick={() => { const next = { ...latest.current, extras: [...latest.current.extras, { name: '', qty: 0, unit: '' }] }; latest.current = next; setDraft(next); }}
                  className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#D9CFCD] text-[15px] font-semibold text-[#4D4342] hover:bg-[#F7F3F1]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  הוספת רכיב
                </button>
              </section>

              {/* תצוגה מקדימה */}
              {resolved.ingredients.length > 0 && (
                <section aria-label="מה נקנה למנה אחת" className="rounded-2xl bg-[#F7F3F1] px-4 py-3">
                  <h3 className="mb-1 text-[13px] font-semibold text-[#6E6260]">לכל מנה שמוזמנת נקנה</h3>
                  <p className="text-[15px] leading-relaxed">
                    {resolved.ingredients
                      .filter(i => !data.ignoredIngredients[normalizeIngredientName(i.name)])
                      .map(i => `${i.name} ${fmtQty(i.qty / resolved.multiplier)}${i.unit ? ` ${i.unit}` : ''}`)
                      .join(', ')}
                  </p>
                </section>
              )}
            </>
          )}

          {setting && (
            <button onClick={resetAll} className="h-11 self-start rounded-xl px-2 text-[15px] font-semibold text-[#B3261E] hover:bg-[#FCEBE9]">
              איפוס ההגדרות של המנה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

