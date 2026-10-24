// src/hooks/useShortages.ts
// חוסרים שעובדים מדווחים: orderStates/shoppingShortages → { items: { [id]: Shortage } }.
// גם חוסרים ישנים מ-orderSettings/manualShoppingItems (isShortage) מוצגים, כדי ששום דיווח לא ילך לאיבוד.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteField, doc, FieldPath, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/lib/toast';

export type ShortageStatus = 'open' | 'added' | 'dismissed';

export interface Shortage {
  id: string;
  name: string;
  qty: number;
  unit: string;
  reportedBy: string;
  reportedAt: number;
  status: ShortageStatus;
  listId?: string | null;
  listName?: string | null;
  itemKey?: string | null;
  legacy?: boolean;
}

interface LegacyManualItem {
  name: string;
  qty: number;
  unit: string;
  category?: string;
  addedBy?: string;
  isShortage?: boolean;
  sources?: string[];
}

const RETRY = 'בדקו את החיבור ונסו שוב.';
const SHORTAGES_REF = () => doc(db, 'orderStates', 'shoppingShortages');
const LEGACY_REF = () => doc(db, 'orderSettings', 'manualShoppingItems');
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function useShortages(enabled = true) {
  const [items, setItems] = useState<Record<string, Omit<Shortage, 'id'>>>({});
  const [legacy, setLegacy] = useState<LegacyManualItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      SHORTAGES_REF(),
      (snap) => setItems(snap.data()?.items || {}),
      (e) => console.error('Failed loading shortages', e)
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      LEGACY_REF(),
      (snap) => setLegacy(snap.data()?.items || []),
      (e) => console.error('Failed loading legacy manual items', e)
    );
  }, [enabled]);

  const shortages: Shortage[] = useMemo(() => {
    const list: Shortage[] = Object.entries(items).map(([id, s]) => ({ ...s, id }));
    legacy.forEach((it, i) => {
      if (!it.isShortage) return;
      list.push({
        id: `legacy:${i}:${it.name}`,
        name: it.name,
        qty: Number(it.qty) || 1,
        unit: it.unit || '',
        reportedBy: it.addedBy || 'לא ידוע',
        reportedAt: 0,
        status: 'open',
        legacy: true,
      });
    });
    return list.sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0));
  }, [items, legacy]);

  // מצרכים ידניים ישנים (לא חוסרים) — אפשר להעביר אותם לרשימה
  const legacyManual = useMemo(() => legacy.filter(it => !it.isShortage), [legacy]);

  const report = useCallback(async (name: string, qty: number, unit: string, reportedBy: string) => {
    const id = newId();
    try {
      await setDoc(
        SHORTAGES_REF(),
        { items: { [id]: { name, qty, unit, reportedBy, reportedAt: Date.now(), status: 'open' } } },
        { merge: true }
      );
      toast.success(`הדיווח על ${name} נשלח`);
      return true;
    } catch (e) {
      console.error(e);
      toast.error(`הדיווח לא נשלח. ${RETRY}`);
      return false;
    }
  }, []);

  const removeLegacy = useCallback(async (predicate: (it: LegacyManualItem, i: number) => boolean) => {
    const next = legacy.filter((it, i) => !predicate(it, i));
    await setDoc(LEGACY_REF(), { items: next, updatedAt: new Date().toISOString() });
  }, [legacy]);

  const setStatus = useCallback(async (s: Shortage, patch: Partial<Shortage>) => {
    try {
      if (s.legacy) {
        // חוסר ישן: מסירים מהמסמך הישן, ושומרים במבנה החדש כדי שהסטטוס יישאר
        const [, idx, ...nameParts] = s.id.split(':');
        await removeLegacy((it, i) => i === Number(idx) && it.name === nameParts.join(':'));
        const { id: _id, legacy: _legacy, ...rest } = s;
        await setDoc(SHORTAGES_REF(), { items: { [newId()]: { ...rest, ...patch } } }, { merge: true });
      } else {
        const ref = SHORTAGES_REF();
        for (const [k, v] of Object.entries(patch)) {
          await updateDoc(ref, new FieldPath('items', s.id, k), v === undefined ? deleteField() : v);
        }
      }
      return true;
    } catch (e) {
      console.error(e);
      toast.error(`העדכון לא נשמר. ${RETRY}`);
      return false;
    }
  }, [removeLegacy]);

  const removeReport = useCallback(async (s: Shortage) => {
    try {
      if (s.legacy) {
        const [, idx, ...nameParts] = s.id.split(':');
        await removeLegacy((it, i) => i === Number(idx) && it.name === nameParts.join(':'));
      } else {
        await updateDoc(SHORTAGES_REF(), new FieldPath('items', s.id), deleteField());
      }
    } catch (e) {
      console.error(e);
      toast.error(`המחיקה לא נשמרה. ${RETRY}`);
    }
  }, [removeLegacy]);

  const clearLegacyManual = useCallback(() => removeLegacy(it => !it.isShortage), [removeLegacy]);

  return { shortages, legacyManual, report, setStatus, removeReport, clearLegacyManual };
}
