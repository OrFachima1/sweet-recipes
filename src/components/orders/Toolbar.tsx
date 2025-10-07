"use client";
import React from "react";

interface ToolbarProps {
  viewMode: "month" | "week" | "day";
  onChangeViewMode: (mode: "month" | "week" | "day") => void;
  picker: string;
  onPickerChange: (val: string) => void;
}

export default function Toolbar({
  viewMode,
  onChangeViewMode,
  picker,
  onPickerChange,
}: ToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full">
      {/* מצב תצוגה */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
        <span className="text-sm font-medium text-gray-700">מצב תצוגה:</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onChangeViewMode("month")}
            className={`px-3 py-2 rounded-lg border transition-all ${
              viewMode === "month"
                ? "bg-pink-400 text-white border-pink-400"
                : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
            }`}
          >
            חודשית
          </button>
          <button
            onClick={() => onChangeViewMode("week")}
            className={`px-3 py-2 rounded-lg border transition-all ${
              viewMode === "week"
                ? "bg-pink-400 text-white border-pink-400"
                : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
            }`}
          >
            שבועית
          </button>
          <button
            onClick={() => onChangeViewMode("day")}
            className={`px-3 py-2 rounded-lg border transition-all ${
              viewMode === "day"
                ? "bg-pink-400 text-white border-pink-400"
                : "bg-white border-pink-200 hover:bg-pink-50 text-gray-900"
            }`}
          >
            יומית
          </button>
        </div>
      </div>

      {/* מעבר לתאריך — במסכים קטנים זה יורד שורה מתחת */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
        <span className="text-sm font-medium text-gray-700">מעבר לתאריך:</span>
        <input
          type="date"
          value={picker}
          onChange={(e) => onPickerChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all text-gray-900 w-full sm:w-auto"
        />
      </div>
    </div>
  );
}
