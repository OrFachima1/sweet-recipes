"use client";
import React from "react";

interface ConfirmReviewModalProps {
  show: boolean;
  onConfirm: () => void;  // "כן, אני רוצה לבדוק"
  onSkip: () => void;     // "לא, העלה ישירות"
}

export default function ConfirmReviewModal({
  show,
  onConfirm,
  onSkip,
}: ConfirmReviewModalProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onSkip}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-blue-500 to-cyan-500 px-6 py-5 flex items-center gap-3">
          <span className="text-4xl">🔍</span>
          <div>
            <div className="font-bold text-white text-xl">בדיקה לפני העלאה</div>
            <div className="text-white/80 text-sm">האם תרצה לוודא שהכל תקין?</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-gray-700 leading-relaxed">
            <p className="mb-3">
              המערכת חילצה את ההזמנות מה-PDF בהצלחה! 🎉
            </p>
            <p className="mb-3">
              <strong>מומלץ לבדוק</strong> שכל המנות, התאריכים והפרטים נכונים לפני השמירה.
            </p>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-sm">
              <div className="font-semibold text-blue-800 mb-1">💡 במסך הבדיקה תוכל:</div>
              <ul className="text-blue-700 space-y-1 mr-4">
                <li>• לראות את ה-PDF לצד ההזמנות</li>
                <li>• לערוך, להוסיף או למחוק מנות</li>
                <li>• לשנות תאריכים ופרטי לקוח</li>
                <li>• לסמן מנות שבדקת</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onConfirm}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-l from-blue-500 to-cyan-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>✓</span>
            <span>כן, אני רוצה לבדוק</span>
          </button>
          <button
            onClick={onSkip}
            className="w-full px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
          >
            לא תודה, העלה ישירות
          </button>
        </div>
      </div>
    </div>
  );
}