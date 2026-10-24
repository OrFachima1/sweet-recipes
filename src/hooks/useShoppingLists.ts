// src/hooks/useShoppingLists.ts
// רשימות קניות שמורות. כל רשימה היא מסמך orderStates/shoppingList_<id> (kind: 'shoppingList').
// הסימונים, ההסרות והמצרכים שנוספו ידנית שייכים לרשימה בלבד, ונכתבים שדה-שדה —
// כך שני טלפונים שמסמנים בו-זמנית לא דורסים זה את זה.
import { useCallback, useEffect, useState } from 'react';
import {
  collection, deleteDoc, deleteField, doc, FieldPath, onSnapshot, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/lib/toast';

export interface ExtraItem {
  name: string;
  qty: number;
  unit: string;
  category?: string | null;
  source?: string | null;        // למשל "דווח על ידי רונית"
  addedBy?: string | null;
  shortageId?: string | null;
  createdAt: number;
}

export interface ShoppingListDoc {
  id: string;
  kind: 'shoppingList';
  name: string;
  start: string;
  end: string;
  createdAt: number;
  createdBy?: string | null;
  checked?: Record<string, boolean>;
  removed?: Record<string, boolean>;
  extras?: Record<string, ExtraItem>;
}

const RETRY = 'בדקו את החיבור ונסו שוב.';
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function useShoppingLists(enabled = true) {
  const [lists, setLists] = useState<ShoppingListDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, 'orderStates'), where('kind', '==', 'shoppingList')),
      (snap) => {
        const docs = snap.docs.map(d => ({ ...(d.data() as Omit<ShoppingListDoc, 'id'>), id: d.id }));
        docs.sort((a, b) => (b.start || '').localeCompare(a.start || '') || (b.createdAt || 0) - (a.createdAt || 0));
        setLists(docs);
        setLoading(false);
      },
      (e) => { console.error('Failed loading shopping lists', e); setLoading(false); }
    );
  }, [enabled]);

  const createList = useCallback(async (name: string, start: string, end: string, createdBy: string | null) => {
    const id = `shoppingList_${newId()}`;
    try {
      await setDoc(doc(db, 'orderStates', id), {
        kind: 'shoppingList', name, start, end, createdAt: Date.now(), createdBy,
        checked: {}, removed: {}, extras: {},
      });
      return id;
    } catch (e) {
      console.error(e);
      toast.error(`יצירת הרשימה נכשלה. ${RETRY}`);
      return null;
    }
  }, []);

  const deleteList = useCallback(async (list: ShoppingListDoc) => {
    const { id, ...data } = list;
    try {
      await deleteDoc(doc(db, 'orderStates', id));
      toast.success(`הרשימה "${list.name}" נמחקה`, {
        action: {
          label: 'ביטול',
          onClick: () => {
            setDoc(doc(db, 'orderStates', id), data)
              .then(() => toast.success('הרשימה שוחזרה'))
              .catch((e) => { console.error(e); toast.error(`השחזור נכשל. ${RETRY}`); });
          },
        },
      });
      return true;
    } catch (e) {
      console.error(e);
      toast.error(`מחיקת הרשימה נכשלה. ${RETRY}`);
      return false;
    }
  }, []);

  return { lists, loading, createList, deleteList };
}

// פעולות על רשימה אחת — כל אחת מעדכנת שדה בודד
export function listActions(listId: string) {
  const ref = doc(db, 'orderStates', listId);
  const fail = (msg: string) => (e: unknown) => { console.error(e); toast.error(`${msg} ${RETRY}`); };
  return {
    setChecked: (key: string, on: boolean) =>
      updateDoc(ref, new FieldPath('checked', key), on ? true : deleteField()).catch(fail('הסימון לא נשמר.')),
    setRemoved: (key: string, removed: boolean) =>
      updateDoc(ref, new FieldPath('removed', key), removed ? true : deleteField()).catch(fail('השינוי לא נשמר.')),
    addExtra: (item: Omit<ExtraItem, 'createdAt'>) =>
      updateDoc(ref, new FieldPath('extras', newId()), { ...item, createdAt: Date.now() }).catch(fail('ההוספה לא נשמרה.')),
    removeExtra: (extraId: string) =>
      updateDoc(ref, new FieldPath('extras', extraId), deleteField()).catch(fail('ההסרה לא נשמרה.')),
  };
}
