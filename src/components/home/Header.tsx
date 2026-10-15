"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import InstallPrompt from "../InstallPrompt";

type HeaderProps = {
  displayName?: string;
  userEmail?: string;
  isManager: boolean;
  canAccessShoppingList?: boolean;
  canAccessCourier?: boolean;
};

export default function Header({ displayName, userEmail, isManager, canAccessShoppingList, canAccessCourier }: HeaderProps) {
  const router = useRouter();

  const greeting = displayName || userEmail?.split('@')[0] || 'חבר';

  return (
    <header className="relative pt-1 pb-1 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ברכה + כפתורי פעולה */}
        <div className="flex items-center justify-between mb-1">
          {/* ברכה */}
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-0.5">
              שלום, {greeting}
            </h1>
            <p className="text-xs text-gray-500 mb-1">מה נבשל היום?</p>
          </div>

          {/* כפתורי פעולה */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/orders')}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all flex items-center justify-center text-xl shadow-sm hover:shadow"
              title="מעקב הזמנות"
            >
              📋
            </button>

            <button
              onClick={() => router.push('/deliveries')}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center text-xl shadow-sm hover:shadow"
              title="וידוא הזמנות"
            >
              ☑️
            </button>

            {canAccessCourier && (
              <button
                onClick={() => router.push('/courier')}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center text-xl shadow-sm hover:shadow"
                title="מסך שליח"
              >
                🛵
              </button>
            )}

            {(canAccessShoppingList ?? isManager) && (
              <button
                onClick={() => router.push('/shopping-list')}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center text-xl shadow-sm hover:shadow"
                title="רשימת קניות"
              >
                🛒
              </button>
            )}

            <button
              onClick={logout}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all flex items-center justify-center shadow-sm hover:shadow"
              title="התנתקות"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* לוגו */}
        <div className="flex justify-center mb-3">
          <img
            src="/logo-web.png"
            alt="Logo"
            className="w-48 sm:w-56 lg:w-64 h-auto object-contain opacity-90"
          />
        </div>

        <InstallPrompt />
      </div>
    </header>
  );
}