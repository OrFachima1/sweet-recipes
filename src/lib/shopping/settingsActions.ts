// src/lib/shopping/settingsActions.ts
// כתיבות של הגדרות רשימת הקניות. כל פעולה נוגעת רק במה שהשתנה.
import { deleteField, doc, FieldPath, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/lib/toast';
import type { DishSetting } from './types';

const RETRY = 'בדקו את החיבור ונסו שוב.';
const settingsRef = () => doc(db, 'orderSettings', 'shoppingListSettings');
const linksRef = () => doc(db, 'orderSettings', 'recipeLinks');
const categoriesRef = () => doc(db, 'orderSettings', 'shoppingCategories');

// כל ההגדרות שמורות כמערך במסמך אחד; מחליפים רק את המנה הזו (קוראים את הגרסה העדכנית לפני הכתיבה)
export async function saveDishSetting(dish: string, setting: DishSetting | null) {
  try {
    const snap = await getDoc(settingsRef());
    const current: DishSetting[] = snap.data()?.settings || [];
    const others = current.filter(s => s.menuItemName !== dish);
    const next = setting ? [...others, setting] : others;
    await setDoc(settingsRef(), { settings: JSON.parse(JSON.stringify(next)), updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error(e);
    toast.error(`ההגדרה לא נשמרה. ${RETRY}`);
    return false;
  }
}

export async function setRecipeLink(dish: string, recipeId: string | null) {
  try {
    if (recipeId) await setDoc(linksRef(), { links: { [dish]: recipeId } }, { merge: true });
    else await updateDoc(linksRef(), new FieldPath('links', dish), deleteField());
    return true;
  } catch (e) {
    console.error(e);
    toast.error(`הקישור למתכון לא נשמר. ${RETRY}`);
    return false;
  }
}

export async function setIngredientIgnored(key: string, ignored: boolean) {
  try {
    await updateDoc(categoriesRef(), new FieldPath('ignoredIngredients', key), ignored ? true : deleteField());
  } catch (e) {
    console.error(e);
    toast.error(`השינוי לא נשמר. ${RETRY}`);
  }
}

export async function setItemCategory(key: string, categoryId: string) {
  try {
    await updateDoc(categoriesRef(), new FieldPath('itemCategories', key), categoryId);
  } catch (e) {
    console.error(e);
    toast.error(`ההעברה לא נשמרה. ${RETRY}`);
  }
}
