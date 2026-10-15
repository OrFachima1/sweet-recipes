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

  const allItems = [
    { icon: "📋", label: "מעקב הזמנות",  action: () => { router.push('/orders');        setMenuOpen(false); }, show: true },
    { icon: "☑️", label: "וידוא הזמנות", action: () => { router.push('/deliveries');    setMenuOpen(false); }, show: true },
    { icon: "🛵", label: "מסך שליח",      action: () => { router.push('/courier');       setMenuOpen(false); }, show: !!canAccessCourier },
    { icon: "🛒", label: "רשימת קניות",   action: () => { router.push('/shopping-list'); setMenuOpen(false); }, show: !!(canAccessShoppingList ?? isManager) },
    { icon: "🚪", label: "התנתקות",       action: () => { logout(); setMenuOpen(false); },                      show: true },
  ].filter(i => i.show);

  // fan: quarter-circle from straight-right (0°) to straight-down (90°)
  const radius = 74;

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

          {/* Radial menu container */}
          <div className="relative" ref={menuRef} style={{ zIndex: 50 }}>

            {/* פריטי התפריט הרדיאלי */}
            {allItems.map((item, i) => {
              const count = allItems.length;
              // fan from 45° to 135° → spreading down-left and down-right
              const startAngle = 45;
              const endAngle   = 135;
              const angleDeg   = count === 1 ? 90 : startAngle + (endAngle - startAngle) * (i / (count - 1));
              const rad        = (angleDeg * Math.PI) / 180;
              const tx         = Math.round(radius * Math.cos(rad));
              const ty         = Math.round(radius * Math.sin(rad));
              const delay      = menuOpen ? i * 35 : (count - 1 - i) * 25;

              return (
                <button
                  key={i}
                  onClick={item.action}
                  title={item.label}
                  style={{
                    position:   'absolute',
                    top:        '50%',
                    left:       '50%',
                    transform:  menuOpen
                      ? `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1)`
                      : `translate(-50%, -50%) scale(0)`,
                    opacity:    menuOpen ? 1 : 0,
                    transition: `transform 0.3s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms,
                                 opacity  0.2s ease ${delay}ms`,
                    pointerEvents: menuOpen ? 'auto' : 'none',
                  }}
                  className="w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg
                             flex items-center justify-center text-xl
                             hover:scale-110 active:scale-95 transition-transform"
                >
                  {item.icon}
                </button>
              );
            })}

            {/* כפתור מרכזי */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="relative w-10 h-10 rounded-full bg-white border border-gray-200
                         hover:border-gray-400 transition-all flex items-center justify-center
                         shadow-sm hover:shadow text-xl leading-none select-none"
              style={{
                transform:  menuOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease',
              }}
              title="תפריט"
            >
              {menuOpen ? '✕' : '⋮'}
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
