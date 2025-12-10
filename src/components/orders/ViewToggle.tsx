"use client";
import React from "react";

interface ViewToggleProps {
  currentView: "calendar" | "clients";
  onToggle: (view: "calendar" | "clients") => void;
}

export default function ViewToggle({ currentView, onToggle }: ViewToggleProps) {
  return (
    <div className="relative inline-flex items-center bg-gray-200 rounded-full p-0.5 shadow-inner">
      {/* הרקע המחליק */}
      <div
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${
          currentView === "calendar" ? "right-0.5" : "left-0.5"
        }`}
      />

      {/* כפתור לוח שנה */}
      <button
        onClick={() => onToggle("calendar")}
        className={`relative z-10 px-2 py-1 md:px-4 md:py-1.5 rounded-full font-medium transition-colors duration-300 text-base md:text-sm ${
          currentView === "calendar" ? "text-gray-900" : "text-gray-500"
        }`}
      >
        <span className="md:hidden">📅</span>
        <span className="hidden md:inline">📅 לוח שנה</span>
      </button>

      {/* כפתור לקוחות */}
      <button
        onClick={() => onToggle("clients")}
        className={`relative z-10 px-2 py-1 md:px-4 md:py-1.5 rounded-full font-medium transition-colors duration-300 text-base md:text-sm ${
          currentView === "clients" ? "text-gray-900" : "text-gray-500"
        }`}
      >
        <span className="md:hidden">👥</span>
        <span className="hidden md:inline">👥 לקוחות</span>
      </button>
    </div>
  );
}