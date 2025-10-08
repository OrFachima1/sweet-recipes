import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CATEGORY_COLORS, 
  ITEM_TO_CATEGORY, 
  CATEGORY_ORDER 
} from "@/utils/categoryMapping";

export async function uploadCategoriesToFirestore() {
  console.log("🚀 מתחיל העלאה של קטגוריות ל-Firestore...");
  
  // המרה לפורמט הנכון
  const categoryItems: Record<string, { color: string; order: number }> = {};
  
  CATEGORY_ORDER.forEach((categoryName, index) => {
    categoryItems[categoryName] = {
      color: CATEGORY_COLORS[categoryName] || "#E5E7EB",
      order: index
    };
  });
  
  const categoryConfig = {
    items: categoryItems,
    itemMapping: ITEM_TO_CATEGORY
  };
  
  try {
    await setDoc(doc(db, "orderSettings", "categoryConfig"), categoryConfig);
    console.log("✅ קטגוריות הועלו בהצלחה!");
    console.log("📊 סה\"כ קטגוריות:", Object.keys(categoryItems).length);
    console.log("📊 סה\"כ מיפויים:", Object.keys(ITEM_TO_CATEGORY).length);
    return true;
  } catch (error) {
    console.error("❌ שגיאה בהעלאה:", error);
    return false;
  }
}