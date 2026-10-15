"use client";

import { useRef, useState, useEffect } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const greeting = displayName || userEmail?.split('@')[0] || 'חבר';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const menuItems = [
    { icon: "📋", label: "מעקב הזמנות", path: "/orders", bg: "bg-emerald-100", show: true },
    { icon: "☑️", label: "וידוא הזמנות", path: "/deliveries", bg: "bg-purple-100", show: true },
    { icon: "🛵", label: "מסך שליח", path: "/courier", bg: "bg-blue-100", show: !!canAccessCourier },
    { icon: "🛒", label: "רשימת קניות", path: "/shopping-list", bg: "bg-blue-100", show: !!(canAccessShoppingList ?? isManager) },
  ].filter(i => i.show);

  return (
    <header className="relative pt-1 pb-1 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ברכה + כפתור תפריט */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-0.5">
              שלום, {greeting}
            </h1>
            <p className="text-xs text-gray-500 mb-1">מה נבשל היום?</p>
          </div>

          {/* כפתור שלוש נקודות */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm hover:shadow text-xl leading-none"
              title="תפריט"
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fadeIn">
                {menuItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { router.push(item.path); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700 text-sm font-medium"
                  >
                    <span className={`w-8 h-8 rounded-full ${item.bg} flex items-center justify-center text-base flex-shrink-0`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-500 text-sm font-medium"
                >
                  <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </span>
                  <span>התנתקות</span>
                </button>
              </div>
            )}
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

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
      `}</style>
    </header>
  );
}
