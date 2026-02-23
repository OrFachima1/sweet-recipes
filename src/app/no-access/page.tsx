"use client";

import Link from "next/link";

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          אין לך הרשאה לגשת לדף זה
        </h1>
        <p className="text-gray-600 mb-6">
          אם אתה חושב שזו טעות, פנה למנהל המערכת.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition-all shadow-lg"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
