/**
 * מערכת הרשאות לפי תפקיד משתמש
 *
 * תפקידים:
 * - manager: מנהל - הרשאות מלאות
 * - senior_worker: עובד בכיר (אחמ"ש) - הוספה ועריכה, ללא מחיקה
 * - worker: עובד רגיל - צפייה ועדכון סטטוס בלבד
 */

import type { UserRole } from './auth';

/**
 * האם המשתמש יכול להוסיף או לערוך (הזמנות, מתכונים, חוסרים)
 */
export function canAddOrEdit(role: UserRole | null): boolean {
  return role === "manager" || role === "senior_worker";
}

/**
 * האם המשתמש יכול למחוק (הזמנות, מתכונים, חוסרים)
 */
export function canDelete(role: UserRole | null): boolean {
  return role === "manager";
}

/**
 * האם המשתמש יכול לגשת להגדרות המערכת
 */
export function canAccessSettings(role: UserRole | null): boolean {
  return role === "manager";
}

/**
 * האם המשתמש יכול לצפות בהכנסות
 */
export function canAccessRevenue(role: UserRole | null): boolean {
  return role === "manager";
}

/**
 * האם המשתמש מורשה לצפות בתוכן (כל משתמש מורשה)
 */
export function canView(role: UserRole | null): boolean {
  return role === "manager" || role === "senior_worker" || role === "worker";
}
