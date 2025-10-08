// utils/colorHelpers.ts

/**
 * מחזיר צבע טקסט (לבן או שחור) לפי בהירות צבע הרקע
 * @param bgColor - צבע רקע בפורמט HEX (למשל: "#3B82F6")
 * @returns "#FFFFFF" (לבן) או "#000000" (שחור)
 */
export function getTextColor(bgColor: string): string {
  // המרה מ-hex ל-RGB
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // חישוב בהירות (luminance) לפי הנוסחה הסטנדרטית
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // אם הרקע בהיר (> 0.5) - טקסט שחור, אחרת - טקסט לבן
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * צבעים מוכנים לשימוש מהיר - פלטת צבעים מומלצת
 */
export const DEFAULT_CLIENT_COLORS = [
  "#73a1ecff", // כחול - ברירת מחדל
  "#10B981", // ירוק - מאושר/שולם
  "#F59E0B", // כתום - בהמתנה
  "#EF4444", // אדום - דחוף/חשוב
  "#8B5CF6", // סגול - VIP
  "#EC4899", // ורוד - אירוע מיוחד
  "#14B8A6", // טורקיז - חתונה
  "#F97316", // כתום כהה - בר מצווה
  "#6366F1", // סגול בהיר - יום הולדת
  "#06B6D4", // ציאן - אירוע עסקי
] as const;

/**
 * מחזיר צבע אקראי מהפלטה
 */
export function getRandomColor(): string {
  return DEFAULT_CLIENT_COLORS[Math.floor(Math.random() * DEFAULT_CLIENT_COLORS.length)];
}

/**
 * בדיקה אם צבע תקין בפורמט HEX
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}