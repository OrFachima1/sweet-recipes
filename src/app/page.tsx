// src/app/page.tsx
"use client";
import LoginForm from "@/components/LoginForm";
import { useUser, useRole, logout } from "@/lib/auth";
import HomeContent from "./HomeContent";

export default function Page() {
  const { user, loading } = useUser();
  const { role, displayName } = useRole(user?.uid); // ← הוסף displayName

  if (loading) return <div className="p-6">טוען…</div>;
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-5" dir="rtl">
          <LoginForm />
        </div>
      </div>
    );
  }
  if (role === null) return <div className="p-6">טוען…</div>;
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
  return <HomeContent isManager={isManager} user={user} displayName={displayName ?? undefined} />; // ← מעבירים
}
