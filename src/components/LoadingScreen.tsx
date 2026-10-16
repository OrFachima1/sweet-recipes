"use client";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">טוען...</p>
      </div>
    </div>
  );
}