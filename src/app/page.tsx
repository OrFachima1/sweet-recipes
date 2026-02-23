// src/app/page.tsx
"use client";
import LoginForm from "@/components/LoginForm";
import { logout } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import HomeContent from "./HomeContent";
import LoadingScreen from "@/components/LoadingScreen";

export default function Page() {
  const { user, loading, role, displayName } = useAuth();

  // מסך טעינה עם סרטון
  if (loading) return <LoadingScreen />;
  
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-5" dir="rtl">
          <LoginForm />
        </div>
      </div>
    );
  }
  
  // מסך טעינה גם בזמן טעינת התפקיד
  if (role === null) return <LoadingScreen />;
  
  if (role === "unauthorized") {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-5 text-center" dir="rtl">
          <div className="text-lg font-bold mb-2">אין הרשאה לצפות בתוכן</div>
          <div className="text-sm text-gray-600 mb-3">פנה/י למנהל להוספה לרשימת המשתמשים.</div>
          <LoginForm />
          <button onClick={logout} className="mt-3 w-full px-4 py-2 rounded-xl border bg-white">התנתקות</button>
        </div>
      </div>
    );
  }

  const isManager = role === "manager";
  const canAddOrEdit = role === "manager" || role === "senior_worker";
  return <HomeContent isManager={isManager} canAccessShoppingList={canAddOrEdit} canAddOrEditRecipes={canAddOrEdit} user={user} displayName={displayName ?? undefined} />;
}