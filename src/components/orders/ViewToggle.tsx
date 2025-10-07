"use client";
import React from "react";

interface ViewToggleProps {
  currentView: "calendar" | "clients";
  onToggle: (view: "calendar" | "clients") => void;
}

export default function ViewToggle({ currentView, onToggle }: ViewToggleProps) {
  return (
    <div className="flex justify-center mb-6">
      <div className="relative inline-flex items-center bg-gray-200 rounded-full p-1 shadow-inner">
        {/* הרקע המחליק */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${
            currentView === "calendar" ? "right-1" : "left-1"
          }`}
        />
        
        {/* כפתור לוח שנה */}
        <button
          onClick={() => onToggle("calendar")}
          className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors duration-300 ${
            currentView === "calendar" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          📅 לוח שנה
        </button>
        
        {/* כפתור לקוחות */}
        <button
          onClick={() => onToggle("clients")}
          className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors duration-300 ${
            currentView === "clients" ? "text-gray-900" : "text-gray-500"
          }`}
        >
          👥 לקוחות
        </button>
      </div>
    </div>
  );
}