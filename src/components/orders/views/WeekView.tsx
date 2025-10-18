"use client";
import React, { useMemo, useEffect } from "react";
import { fmtYMD, startOfWeek, addDays, startOfMonth } from "@/utils/orders";

// ✅ פונקציה לחישוב צבע טקסט
function getTextColor(bgColor: string): string {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

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
  onAddClient?: () => void;
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
  const headersShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const monthName = viewDate.toLocaleDateString('he-IL', { month: 'long' });
  const year = viewDate.getFullYear();

  const firstDayOfMonth = startOfMonth(viewDate);
  const firstWeekStart = startOfWeek(firstDayOfMonth, 0);
  const currentWeekStart = startOfWeek(viewDate, 0);
  const weekNumber = Math.floor((currentWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentDate = new Date(selectedDayKey);
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          const nextDay = addDays(currentDate, 1);
          setSelectedDayKey(fmtYMD(nextDay));
          setViewDate(nextDay);
          break;
          
        case 'ArrowRight':
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
    <div className="rounded-xl md:rounded-3xl overflow-hidden shadow-lg md:shadow-2xl bg-white border-2 md:border-4 border-gray-200">
      
      {/* Header */}
      <div className="bg-red-100 px-3 py-3 md:px-6 md:py-6">
        <div className="flex items-center justify-between mb-2">
          {onAddClient && (
            <button
              onClick={onAddClient}
              className="inline-flex items-center gap-1 md:gap-2 px-2 py-1 md:px-4 md:py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md text-xs md:text-base font-medium"
            >
              <span className="text-base md:text-xl leading-none">＋</span>
              <span className="hidden sm:inline">הוסף לקוח</span>
            </button>
          )}
          
          <button
            onClick={onToday}
            className="text-[10px] md:text-xs px-2 md:px-4 py-1 md:py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
          >
            היום
          </button>
        </div>
        
        <div className="text-center">
          <div className="text-3xl md:text-5xl font-bold text-gray-900">
            {monthName}
          </div>
          <div className="text-sm md:text-lg font-medium text-gray-700 mt-0.5 md:mt-1">
            {year}
          </div>
        </div>
      </div>

      {/* ניווט שבועות */}
      <div className="bg-red-200 px-3 py-2 md:px-6 md:py-4 border-t-2 border-red-300/50">
        <div className="flex items-center justify-center gap-3 md:gap-6">
          <button
            onClick={onPrevWeek}
            className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-white/40 hover:bg-white/60 transition-all flex items-center justify-center text-xl md:text-2xl text-gray-900"
          >
            ‹
          </button>

          <div className="text-center min-w-[140px] md:min-w-[180px]">
            <div className="text-xl md:text-3xl font-bold text-gray-900">
              שבוע {weekNumber}
            </div>
            <div className="text-[10px] md:text-xs font-medium text-gray-700 mt-0.5 md:mt-1">
              {weekDays[0].getDate()}-{weekDays[6].getDate()} {monthName}
            </div>
            <div className="text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-0.5 md:mt-1">
              {weekDays.reduce((sum, day) => sum + (daysMap.get(fmtYMD(day))?.length || 0), 0)} הזמנות
            </div>
          </div>

          <button
            onClick={onNextWeek}
            className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-white/40 hover:bg-white/60 transition-all flex items-center justify-center text-xl md:text-2xl text-gray-900"
          >
            ›
          </button>
        </div>
      </div>

      {/* כותרת ימים - מסתיר שבתות במובייל */}
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
        
        <div className="relative grid grid-cols-6 md:grid-cols-7 text-[10px] md:text-sm font-bold">
          {headers.map((d, idx) => {
            const isWeekend =  idx === 6;
            
            // מסתיר שבתות במובייל
            if (isWeekend) {
              return (
                <div key={d} className="hidden md:block relative px-2 py-4 text-center bg-gradient-to-b from-gray-100/80 to-gray-200/80">
                  <div className="relative inline-block">
                    <span className="relative z-10 text-gray-600">{d}</span>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 rounded-full w-12 bg-gradient-to-r from-transparent via-gray-400 to-transparent" />
                  </div>
                </div>
              );
            }
            
            return (
              <div key={d} className="relative px-1 py-2 md:px-2 md:py-4 text-center">
                <div className="relative inline-block">
                  <span className="relative z-10 text-gray-800">
                    <span className="hidden md:inline">{d}</span>
                    <span className="md:hidden">{headersShort[idx]}</span>
                  </span>
                  <div className="absolute -bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 h-0.5 md:h-1 rounded-full w-8 md:w-16 bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="h-0.5 md:h-1 bg-gradient-to-r from-red-300 via-orange-300 to-red-300" />
      </div>

      {/* עמודות השבוע - מסתיר שבתות במובייל */}
      <div className="p-1 md:p-2 bg-gradient-to-br from-white to-gray-50">
        <div className="grid grid-cols-6 md:grid-cols-7 gap-0.5 md:gap-1">
          {weekDays.map((d, idx) => {
            const key = fmtYMD(d);
            const list = daysMap.get(key) || [];
            const isToday = key === todayKey;
            const isSelected = key === selectedDayKey;
            const dayOfWeek = d.getDay();
            const isWeekend =  dayOfWeek === 6;

            // מסתיר שבתות במובייל
            if (isWeekend) {
              return (
                <div
                  key={key}
                  onClick={() => {
                    setSelectedDayKey(key);
                    setViewDate(d);
                    // אם יש הזמנות - פותח את המודל
                    if (list.length > 0) {
                      onOpenDayModal(key);
                    }
                  }}
                  className={`
                    hidden md:block
                    relative min-h-40 rounded-lg text-left p-2 border transition-all cursor-pointer
                    bg-gray-50 border-gray-200 hover:bg-gray-100
                    ${isToday ? 'ring-2 ring-red-400 shadow-lg' : ''}
                    ${isSelected ? 'ring-2 ring-blue-400' : ''}
                  `}
                >
                  <div className="flex items-center justify-start mb-1">
                    <div className={`text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center ${isToday ? 'bg-red-400 text-white shadow-md' : 'text-gray-700'}`}>
                      {d.getDate()}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {list.slice(0, 6).map((o: any) => {
                      const bgColor = o.clientColor || "#a5c4f7ff";
                      const textColor = getTextColor(bgColor);
                      
                      return (
                        <div
                          key={o.__id}
                          className="truncate text-[10px] w-full px-2 py-1 rounded-md hover:shadow-md transition-all font-medium text-center"
                          style={{ backgroundColor: bgColor, color: textColor }}
                          title={o.clientName}
                        >
                          {o.clientName}
                        </div>
                      );
                    })}
                    {list.length > 6 && (
                      <div className="text-[10px] text-gray-500 text-center w-full">
                        +{list.length - 6} נוספות
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ימי חול - מוצגים תמיד
            return (
              <div
                key={key}
                onClick={() => {
                  setSelectedDayKey(key);
                  setViewDate(d);
                  // אם יש הזמנות - פותח את המודל
                  if (list.length > 0) {
                    onOpenDayModal(key);
                  }
                }}
                className={`
                  relative min-h-24 md:min-h-40 rounded md:rounded-lg text-left p-1 md:p-2 border transition-all cursor-pointer
                  bg-white border-gray-200 hover:bg-orange-50/30
                  ${isToday ? 'ring-1 md:ring-2 ring-red-400 shadow-md md:shadow-lg' : ''}
                  ${isSelected ? 'ring-1 md:ring-2 ring-blue-400' : ''}
                `}
              >
                <div className="flex items-center justify-start mb-0.5 md:mb-1">
                  <div className={`text-[10px] md:text-sm font-bold rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center ${isToday ? 'bg-red-400 text-white shadow-sm md:shadow-md' : 'text-gray-700'}`}>
                    {d.getDate()}
                  </div>
                </div>

                {/* תצוגת הזמנות */}
                <div className="space-y-0.5 md:space-y-1">
                  {/* מובייל: 2 הזמנות */}
                  <div className="block md:hidden">
                    {list.slice(0, 2).map((o: any) => {
                      const bgColor = o.clientColor || "#a5c4f7ff";
                      const textColor = getTextColor(bgColor);
                      
                      return (
                        <div
                          key={o.__id}
                          className="truncate text-[8px] w-full px-1 py-0.5 rounded hover:shadow-sm transition-all font-medium text-center"
                          style={{ backgroundColor: bgColor, color: textColor }}
                          title={o.clientName}
                        >
                          {o.clientName}
                        </div>
                      );
                    })}
                    {list.length > 2 && (
                      <div className="text-[7px] text-gray-500 w-full text-center">
                        +{list.length - 2}
                      </div>
                    )}
                  </div>

                  {/* טאבלט ומעלה: 6 הזמנות */}
                  <div className="hidden md:block">
                    {list.slice(0, 6).map((o: any) => {
                      const bgColor = o.clientColor || "#a5c4f7ff";
                      const textColor = getTextColor(bgColor);
                      
                      return (
                        <div
                          key={o.__id}
                          className="truncate text-[10px] w-full px-2 py-1 rounded-md hover:shadow-md transition-all font-medium text-center"
                          style={{ backgroundColor: bgColor, color: textColor }}
                          title={o.clientName}
                        >
                          {o.clientName}
                        </div>
                      );
                    })}
                    {list.length > 6 && (
                      <div className="text-[10px] text-gray-500 text-center w-full">
                        +{list.length - 6} נוספות
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}