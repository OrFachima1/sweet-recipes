"use client";
import React, { useMemo, useEffect } from "react";
import { fmtYMD, getMonthGridMax5, addDays } from "@/utils/orders";

interface MonthViewProps {
  viewDate: Date;
  selectedDayKey: string;
  setSelectedDayKey: (key: string) => void;
  setViewDate: (d: Date) => void;
  daysMap: Map<string, any[]>;
  todayKey: string;
  onOpenDayModal: (dayKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  monthLabel: string;
  onAddClient?: () => void; // 👈 Optional - רק למנהלים
}

export default function MonthView({
  viewDate,
  selectedDayKey,
  setSelectedDayKey,
  setViewDate,
  daysMap,
  todayKey,
  onOpenDayModal,
  onPrev,
  onNext,
  onToday,
  monthLabel,
  onAddClient,
}: MonthViewProps) {
  const monthGrid = useMemo(() => getMonthGridMax5(viewDate, 0), [viewDate]);
  const weeksHeader = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  const monthName = viewDate.toLocaleDateString('he-IL', { month: 'long' });
  const year = viewDate.getFullYear();
/*
  // תמיכה במקלדת
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentDate = new Date(selectedDayKey);
      
      switch(e.key) {
        case 'ArrowLeft': // שמאל = קדימה (בגלל RTL)
          e.preventDefault();
          const nextDay = addDays(currentDate, 1);
          setSelectedDayKey(fmtYMD(nextDay));
          setViewDate(nextDay);
          break;
          
        case 'ArrowRight': // ימין = אחורה (בגלל RTL)
          e.preventDefault();
          const prevDay = addDays(currentDate, -1);
          setSelectedDayKey(fmtYMD(prevDay));
          setViewDate(prevDay);
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          const weekAfter = addDays(currentDate, 7);
          setSelectedDayKey(fmtYMD(weekAfter));
          setViewDate(weekAfter);
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          const weekBefore = addDays(currentDate, -7);
          setSelectedDayKey(fmtYMD(weekBefore));
          setViewDate(weekBefore);
          break;
          
        case 'Enter':
          e.preventDefault();
          onOpenDayModal(selectedDayKey);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDayKey, setSelectedDayKey, setViewDate, onOpenDayModal]);
*/
  return (
    <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-gray-200">
      {/* Header אדום בהיר */}
      <div className="bg-red-100 px-6 py-6">
        <div className="flex items-center justify-between mb-3">
          {/* כפתור הוסף לקוח - מוצג רק אם onAddClient קיים (מנהל) */}
          {onAddClient && (
            <button
              onClick={onAddClient}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
            >
              <span className="text-xl leading-none">＋</span>
              <span>הוסף לקוח</span>
            </button>
          )}
          
          <button
            onClick={onToday}
            className="text-xs px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
          >
            היום
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-6">
          {/* חץ שמאל - חודש */}
          <button
            onClick={onPrev}
            className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900"
            title="חודש קודם"
          >
            ‹
          </button>

          {/* חודש ושנה */}
          <div className="text-center min-w-[200px]">
            <div className="text-6xl font-bold text-gray-900">
              {monthName}
            </div>
            <div className="text-lg font-medium text-gray-700 mt-1">
              {year}
            </div>
            {/* מונה הזמנות */}
            <div className="text-sm px-4 py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-2">
              {Array.from(daysMap.values()).reduce((sum, orders) => sum + orders.length, 0)} הזמנות החודש
            </div>
          </div>

          {/* חץ ימין - חודש */}
          <button
            onClick={onNext}
            className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900"
            title="חודש הבא"
          >
            ›
          </button>
        </div>
      </div>

      {/* כותרת ימים מעוצבת */}
      <div className="relative bg-gradient-to-b from-amber-50 via-orange-50 to-red-50">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 50px,
            rgba(251, 146, 60, 0.1) 50px,
            rgba(251, 146, 60, 0.1) 51px
          )`
        }} />
        
        <div className="relative grid grid-cols-7 text-sm font-bold">
          {weeksHeader.map((d, idx) => {
            const isWeekend = idx === 5 || idx === 6;
            return (
              <div
                key={d}
                className={`
                  relative px-2 py-4 text-center
                  ${isWeekend ? 'bg-gradient-to-b from-gray-100/80 to-gray-200/80' : ''}
                `}
              >
                <div className="relative inline-block">
                  <span className={`relative z-10 ${isWeekend ? 'text-gray-600' : 'text-gray-800'}`}>
                    {d}
                  </span>
                  <div className={`
                    absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 rounded-full
                    ${isWeekend 
                      ? 'w-12 bg-gradient-to-r from-transparent via-gray-400 to-transparent' 
                      : 'w-16 bg-gradient-to-r from-transparent via-orange-400 to-transparent'
                    }
                  `} />
                  {!isWeekend && (
                    <>
                      <div className="absolute -bottom-3 left-0 w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                      <div className="absolute -bottom-3 right-0 w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="h-1 bg-gradient-to-r from-red-300 via-orange-300 to-red-300" />
      </div>

      {/* גריד הימים */}
      <div className="p-2 bg-gradient-to-br from-white to-gray-50">
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.cells.map((cell, idx) => {
            const key = cell.date ? fmtYMD(cell.date) : `empty-${idx}`;
            const dayOrders = cell.date ? daysMap.get(key) || [] : [];
            const isToday = cell?.date ? key === todayKey : false;
            const isSelected = cell.date ? key === selectedDayKey : false;
            const dayOfWeek = cell.date?.getDay();
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

            return (
              <div
                key={key}
                onClick={() => {
                  if (cell.date) {
                    setSelectedDayKey(key);
                    setViewDate(cell.date);
                  }
                }}
                className={`
                  relative min-h-24 rounded-lg text-left p-2 border transition-all cursor-pointer
                  ${cell.inMonth 
                    ? isWeekend 
                      ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                      : 'bg-white border-gray-200 hover:bg-orange-50/30'
                    : 'bg-gray-50/30 border-transparent'
                  }
                  ${isToday ? 'ring-2 ring-red-400 shadow-lg' : ''}
                  ${isSelected ? 'ring-2 ring-blue-400' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className={`
                      text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center
                      ${isToday ? 'bg-red-400 text-white shadow-md' : 'text-gray-700'}
                    `}
                  >
                    {cell.date ? cell.date.getDate() : ''}
                  </div>
                  {dayOrders.length > 0 && (
                    <button
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayModal(key);
                      }}
                    >
                      פתח
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {dayOrders.slice(0, 2).map((o: any) => (
                    <button
                      key={o.__id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayModal(key);
                      }}
                      className="truncate text-[10px] w-full text-left px-2 py-1 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                      title={o.clientName}
                    >
                      {o.clientName}
                    </button>
                  ))}
                  {dayOrders.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayModal(key);
                      }}
                      className="text-[10px] text-gray-500 hover:text-gray-700"
                    >
                      +{dayOrders.length - 2} נוספות
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}