// src/lib/shopping/types.ts

export interface Category {
  id: string;
  name: string;
  emoji?: string;   // לא בשימוש בעיצוב החדש; נשמר בנתונים ישנים
  color: string;    // hex, או מחלקות Tailwind ישנות
  order?: number;
}

export interface DishIngredient {
  name: string;
  qty: number;
  unit: string;
}

// הגדרה של מנה לרשימת הקניות (orderSettings/shoppingListSettings.settings).
// שני פורמטים חיים יחד:
//  • חדש (mode): 'overrides' — רק שינויים על המתכון החי; 'manual' — מנה בלי מתכון, רכיבים ידניים.
//  • ישן (בלי mode): customIngredients הוא "צילום" של המתכון; originalQty = הכמות במתכון בזמן הצילום.
export interface DishSetting {
  menuItemName: string;
  enabled: boolean;
  multiplier: number;               // המתכון מספיק ל-X מנות
  mode?: 'overrides' | 'manual';
  forRecipeId?: string | null;      // השינויים שייכים למתכון הזה
  disabled?: string[];              // שמות רכיבים מנורמלים שלא קונים
  overrides?: Record<string, DishIngredient>; // כמות/יחידה שונים מהמתכון, לפי שם מנורמל
  extras?: DishIngredient[];        // רכיבים נוספים מעבר למתכון
  // פורמט ישן
  recipeId?: string;
  recipeName?: string;
  originalRecipeId?: string;
  customIngredients?: Array<{ name: string; qty: number | string; unit: string; enabled: boolean; originalQty?: number }>;
}
