"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const show = !isOnline || isSlowConnection;

  return (
    <>
      {show && (
        <div
          className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
          style={{ background: isOnline ? "#f59e0b" : "#ef4444" }}
          dir="rtl"
        >
          <span>{isOnline ? "⚡" : "📶"}</span>
          <span>
            {isOnline
              ? "חיבור איטי — מציג נתונים שמורים"
              : "מצב לא מקוון — מציג נתונים שמורים"}
          </span>
        </div>
      )}
      {/* spacer — same height as the banner, keeps content from hiding behind it */}
      <div style={{ height: show ? "36px" : 0 }} aria-hidden="true" />
    </>
  );
}
