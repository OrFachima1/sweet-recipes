"use client";
import React, { useMemo, useEffect } from "react";
import { fmtYMD, startOfWeek, addDays, startOfMonth } from "@/utils/orders";

interface WeekViewProps {
  viewDate: Date;
  selectedDayKey: string;
  setSelectedDayKey: (key: string) => void;
  setViewDate: (d: Date) => void;
  daysMap: Map<string, any[]>;
  todayKey: string;
  onOpenDayModal: (dayKey: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  monthLabel: string;
  onAddClient: () => void; // 👈 חדש
}

export default function WeekView({
  viewDate,
  selectedDayKey,
  setSelectedDayKey,
  setViewDate,
  daysMap,
  todayKey,
  onOpenDayModal,
  onPrevWeek,
  onNextWeek,
  onToday,
  monthLabel,
  onAddClient,
}: WeekViewProps) {
  const weekDays = useMemo(() => {
    const s = startOfWeek(viewDate, 0);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [viewDate]);

  const headers = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const monthName = viewDate.toLocaleDateString('he-IL', { month: 'long' });
  const year = viewDate.getFullYear();

  // חישוב מספר השבוע בחודש
  const firstDayOfMonth = startOfMonth(viewDate);
  const firstWeekStart = startOfWeek(firstDayOfMonth, 0);
  const currentWeekStart = startOfWeek(viewDate, 0);
  const weekNumber = Math.floor((currentWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

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

  return (
    <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-gray-200">
      
      {/* Header אדום בהיר - תצוגת חודש */}
      <div className="bg-red-100 px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          {/* כפתור הוסף לקוח - צד שמאל */}
          <button
            onClick={onAddClient}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
          >
            <span className="text-xl leading-none">＋</span>
            <span>הוסף לקוח</span>
          </button>
          
          <button
            onClick={onToday}
            className="text-xs px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
          >
            היום
          </button>
        </div>
        
        {/* חודש ושנה - ללא חיצים */}
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-900">
            {monthName}
          </div>
          <div className="text-lg font-medium text-gray-700 mt-1">
            {year}
          </div>
        </div>
      </div>

      {/* חלק אדום בהיר נוסף - ניווט שבועות */}
      <div className="bg-red-200 px-6 py-4 border-t-2 border-red-300/50">
        <div className="flex items-center justify-center gap-6">
          {/* חץ שבוע קודם */}
          <button
            onClick={onPrevWeek}
            className="w-9 h-9 rounded-full bg-white/40 hover:bg-white/60 transition-all flex items-center justify-center text-2xl text-gray-900"
          >
            ‹
          </button>

          {/* מספר שבוע */}
          <div className="text-center min-w-[180px]">
            <div className="text-3xl font-bold text-gray-900">
              שבוע {weekNumber}
            </div>
            <div className="text-xs font-medium text-gray-700 mt-1">
              {weekDays[0].getDate()}-{weekDays[6].getDate()} {monthName}
            </div>
            {/* מונה הזמנות */}
            <div className="text-xs px-3 py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-1">
              {weekDays.reduce((sum, day) => sum + (daysMap.get(fmtYMD(day))?.length || 0), 0)} הזמנות השבוע
            </div>
          </div>

          {/* חץ שבוע הבא */}
          <button
            onClick={onNextWeek}
            className="w-9 h-9 rounded-full bg-white/40 hover:bg-white/60 transition-all flex items-center justify-center text-2xl text-gray-900"
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
          {headers.map((d, idx) => {
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

      {/* עמודות השבוע */}
      <div className="p-2 bg-gradient-to-br from-white to-gray-50">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d, idx) => {
            const key = fmtYMD(d);
            const list = daysMap.get(key) || [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDayKey;
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

            return (
              <div
                key={key}
                onClick={() => {
                  setSelectedDayKey(key);
                  setViewDate(d);
                }}
                className={`
                  relative min-h-40 rounded-lg text-left p-2 border transition-all cursor-pointer
                  ${isWeekend 
                    ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                    : 'bg-white border-gray-200 hover:bg-orange-50/30'
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
                    {d.getDate()}
                  </div>
                  {list.length > 0 && (
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
                  {list.slice(0, 6).map((o: any) => (
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
                  {list.length > 6 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayModal(key);
                      }}
                      className="text-[10px] text-gray-500 hover:text-gray-700"
                    >
                      +{list.length - 6} נוספות
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