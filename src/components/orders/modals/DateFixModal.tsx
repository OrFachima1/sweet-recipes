"use client";
import React from "react";
import { fmtYMD } from "@/utils/orders";

// props
interface DateFixModalProps {
  show: boolean;
  onClose: () => void;
  dateFixList: { id: string; name: string; date: string }[];
  setDateFixList: React.Dispatch<React.SetStateAction<{ id: string; name: string; date: string }[]>>;
  orders: any[];
  persist: (next: any[]) => void;
  onSaved?: () => void; 
}


/**
 * שיוך תאריכים להזמנות שלא זוהה להן תאריך בעת העלאה
 */
export default function DateFixModal({
  show,
  onClose,
  dateFixList,
  setDateFixList,
  orders,
  onSaved,
  persist,
}: DateFixModalProps) {
  if (!show) return null;

  const onSave = () => {
  const mapDates = new Map(dateFixList.map(x => [x.id, x.date]));
  const next = orders.map(o =>
    mapDates.has(o.__id!)
      ? { ...o, eventDate: `${mapDates.get(o.__id!)}T00:00:00` }
      : o
  );
  persist(next);
  onClose();
  onSaved?.(); 
};

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-2xl border border-sky-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-sky-200 flex items-center justify-between">
          <div className="font-semibold text-sky-800">שיוך תאריכים ללקוחות</div>
          <button onClick={onClose} className="text-sky-600 hover:text-sky-800">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {dateFixList.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <div className="text-sm text-sky-800 min-w-[160px] truncate">{c.name}</div>
              <input
                type="date"
                value={c.date}
                onChange={(e) => {
                  const v = e.target.value;
                  setDateFixList(list =>
                    list.map(x => (x.id === c.id ? { ...x, date: v } : x))
                  );
                }}
                className="px-3 py-2 rounded-xl bg-white border border-sky-200 text-sm"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="px-3 py-2 rounded-xl bg-white border border-sky-200 hover:bg-sky-50"
              onClick={onClose}
            >
              דלג
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              onClick={onSave}
            >
              שמור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
