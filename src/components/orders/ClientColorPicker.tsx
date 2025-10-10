// components/orders/ClientColorPicker.tsx
"use client";
import React, { useState } from "react";
import { DEFAULT_CLIENT_COLORS, getTextColor } from "@/utils/colorHelpers";

interface ClientColorPickerProps {
  show: boolean;
  clientName: string;
  currentColor: string;
  onClose: () => void;
  onSave: (newColor: string) => Promise<void>;
}

export default function ClientColorPicker({
  show,
  clientName,
  currentColor,
  onClose,
  onSave,
}: ClientColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [customColor, setCustomColor] = useState(currentColor);
  const [saving, setSaving] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedColor);
      onClose();
    } catch (e) {
      alert("שגיאה בשמירת הצבע");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-400 to-red-400 px-6 py-4 rounded-t-2xl">
          <h3 className="text-xl font-bold text-white">🎨 בחירת צבע ללקוח</h3>
          <p className="text-sm text-white/90 mt-1">{clientName}</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* תצוגה מקדימה */}
          <div className="text-center">
            <div
              className="mx-auto w-32 h-32 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold transition-all"
              style={{
                backgroundColor: selectedColor,
                color: getTextColor(selectedColor),
              }}
            >
              {clientName.slice(0, 2)}
            </div>
            <p className="mt-2 text-sm text-gray-600">{selectedColor}</p>
          </div>

          {/* פלטת צבעים מוכנים */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              צבעים מומלצים
            </label>
            <div className="grid grid-cols-5 gap-3">
              {DEFAULT_CLIENT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-full aspect-square rounded-xl transition-all hover:scale-110 ${
                    selectedColor === color
                      ? "ring-4 ring-blue-500 ring-offset-2"
                      : "ring-2 ring-gray-200"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* בורר צבעים מותאם אישית */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              צבע מותאם אישית
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-16 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
              />
              <button
                onClick={() => setSelectedColor(customColor)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
              >
                השתמש בצבע זה
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-400 to-red-400 text-white font-bold transition-all hover:shadow-lg disabled:opacity-50"
          >
            {saving ? "שומר..." : "💾 שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}