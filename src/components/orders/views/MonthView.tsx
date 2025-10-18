"use client";
import React, { useMemo, useEffect } from "react";
import { fmtYMD, getMonthGridMax5, addDays } from "@/utils/orders";
import HebrewDayBadge, { shouldHighlightDay } from "@/components/orders/HebrewDayBadge";

// ✅ פונקציה לחישוב צבע טקסט
function getTextColor(bgColor: string): string {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

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
  onAddClient?: () => void;
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
  const weeksHeaderShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  const monthName = viewDate.toLocaleDateString('he-IL', { month: 'long' });
  const year = viewDate.getFullYear();

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

  const totalOrdersInMonth = useMemo(() => {
    const keysInMonth = new Set(
      monthGrid.cells
        .filter(c => c.date && c.inMonth)
        .map(c => fmtYMD(c.date!))
    );
    let sum = 0;
    keysInMonth.forEach(k => { sum += (daysMap.get(k)?.length || 0); });
    return sum;
  }, [monthGrid, daysMap]);

  return (
    <div className="rounded-xl md:rounded-3xl overflow-hidden shadow-lg md:shadow-2xl bg-white border-2 md:border-4 border-gray-200">
      {/* Header */}
      <div className="bg-red-100 px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-6">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2 md:mb-3">
          {onAddClient && (
            <button
              onClick={onAddClient}
              className="inline-flex items-center gap-1 md:gap-2 px-1.5 py-1 sm:px-2 sm:py-1 md:px-4 md:py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md text-[10px] sm:text-xs md:text-base font-medium"
            >
              <span className="text-sm sm:text-base md:text-xl leading-none">＋</span>
              <span className="hidden sm:inline">הוסף לקוח</span>
            </button>
          )}
          
          <button
            onClick={onToday}
            className="text-[9px] sm:text-[10px] md:text-xs px-1.5 sm:px-2 md:px-4 py-1 md:py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
          >
            היום
          </button>
        </div>
        
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-6">
          <button
            onClick={onPrev}
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-xl sm:text-2xl md:text-4xl text-gray-900"
            title="חודש קודם"
          >
            ‹
          </button>

          <div className="text-center min-w-[100px] sm:min-w-[120px] md:min-w-[200px]">
            <div className="text-2xl sm:text-3xl md:text-6xl font-bold text-gray-900">
              {monthName}
            </div>
            <div className="text-xs sm:text-sm md:text-lg font-medium text-gray-700 mt-0.5 md:mt-1">
              {year}
            </div>
            <div className="text-[9px] sm:text-[10px] md:text-sm px-1.5 sm:px-2 md:px-4 py-0.5 md:py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-0.5 sm:mt-1 md:mt-2">
              {totalOrdersInMonth} הזמנות
            </div>
          </div>

          <button
            onClick={onNext}
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-xl sm:text-2xl md:text-4xl text-gray-900"
            title="חודש הבא"
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
        
        <div className="relative grid grid-cols-6 md:grid-cols-7 text-[9px] sm:text-[10px] md:text-sm font-bold">
          {weeksHeader.map((d, idx) => {
            const isWeekend = idx === 6;
            
            // מסתיר שבתות במובייל
            if (isWeekend) {
              return (
                <div key={d} className="hidden md:block relative px-2 py-3 sm:py-4 text-center bg-gradient-to-b from-gray-100/80 to-gray-200/80">
                  <div className="relative inline-block">
                    <span className="relative z-10 text-gray-600">{d}</span>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 rounded-full w-12 bg-gradient-to-r from-transparent via-gray-400 to-transparent" />
                  </div>
                </div>
              );
            }
            
            return (
              <div key={d} className="relative px-0.5 py-1.5 sm:px-1 sm:py-2 md:px-2 md:py-4 text-center">
                <div className="relative inline-block">
                  <span className="relative z-10 text-gray-800">
                    <span className="hidden md:inline">{d}</span>
                    <span className="md:hidden">{weeksHeaderShort[idx]}</span>
                  </span>
                  <div className="absolute -bottom-0.5 sm:-bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 h-0.5 md:h-1 rounded-full w-6 sm:w-8 md:w-16 bg-gradient-to-r from-transparent via-orange-400 to-transparent" />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="h-0.5 md:h-1 bg-gradient-to-r from-red-300 via-orange-300 to-red-300" />
      </div>

      {/* גריד הימים - מסתיר שבתות במובייל */}
      <div className="p-0.5 sm:p-1 md:p-2 bg-gradient-to-br from-white to-gray-50">
        <div className="grid grid-cols-6 md:grid-cols-7 gap-[2px] sm:gap-0.5 md:gap-1">
          {monthGrid.cells.map((cell, idx) => {
            const key = cell.date ? fmtYMD(cell.date) : `empty-${idx}`;
            const dayOrders = cell.date ? daysMap.get(key) || [] : [];
            const isToday = cell?.date ? key === todayKey : false;
            const isSelected = cell.date ? key === selectedDayKey : false;
            const dayOfWeek = cell.date?.getDay();
            const isWeekend = dayOfWeek === 6;

            // מסתיר שבתות במובייל
            if (isWeekend) {
              const highlightInfo = cell.date ? shouldHighlightDay(cell.date) : null;
              const shouldHighlight = highlightInfo?.shouldHighlight || false;
              const highlightBgColor = highlightInfo?.bgColor || '';
              
              return (
                <div
                  key={key}
                  onClick={() => {
                    if (cell.date) {
                      setSelectedDayKey(key);
                      setViewDate(cell.date);
                      // אם יש הזמנות - פותח את המודל
                      if (dayOrders.length > 0) {
                        onOpenDayModal(key);
                      }
                    }
                  }}
                  className={`
                    hidden md:block
                    relative min-h-24 rounded-lg text-left p-2 border transition-all cursor-pointer
                    ${cell.inMonth 
                      ? shouldHighlight 
                        ? `${highlightBgColor} border-gray-300 hover:opacity-90` 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      : 'bg-gray-50/30 border-transparent'}
                    ${isToday ? 'ring-2 ring-red-400 shadow-lg' : ''}
                    ${isSelected ? 'ring-2 ring-blue-400' : ''}
                  `}
                >
                  {/* שורת כותרת - מספר יום בימין, חג בשמאל - צמוד למעלה */}
                  <div className="flex items-center justify-between w-full mb-1 -mt-0.5">
                    {/* חג/תאריך עברי - בצד שמאל */}
                    <div className="flex-shrink-0 flex items-center justify-center h-7">
                      {cell.date && cell.inMonth && (
                        <HebrewDayBadge date={cell.date} compact={false} />
                      )}
                    </div>
                    {/* מספר היום - בצד ימין */}
                    <div className={`text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 ${isToday ? 'bg-red-400 text-white shadow-md' : 'text-gray-700'}`}>
                      {cell.date ? cell.date.getDate() : ''}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {dayOrders.slice(0, 2).map((o: any) => {
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
                    {dayOrders.length > 2 && (
                      <div className="text-[10px] text-gray-500 text-center w-full">
                        +{dayOrders.length - 2} נוספות
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ימי חול - מוצגים תמיד
            const highlightInfo = cell.date ? shouldHighlightDay(cell.date) : null;
            const shouldHighlight = highlightInfo?.shouldHighlight || false;
            const highlightBgColor = highlightInfo?.bgColor || '';
            
            return (
              <div
                key={key}
                onClick={() => {
                  if (cell.date) {
                    setSelectedDayKey(key);
                    setViewDate(cell.date);
                    // אם יש הזמנות - פותח את המודל
                    if (dayOrders.length > 0) {
                      onOpenDayModal(key);
                    }
                  }
                }}
                className={`
                  relative min-h-14 sm:min-h-16 md:min-h-24 rounded sm:rounded-md md:rounded-lg text-left p-0.5 sm:p-1 md:p-2 border transition-all cursor-pointer
                  ${cell.inMonth 
                    ? shouldHighlight 
                      ? `${highlightBgColor} border-gray-300 hover:opacity-90` 
                      : 'bg-white border-gray-200 hover:bg-orange-50/30'
                    : 'bg-gray-50/30 border-transparent'}
                  ${isToday ? 'ring-1 md:ring-2 ring-red-400 shadow-sm sm:shadow-md md:shadow-lg' : ''}
                  ${isSelected ? 'ring-1 md:ring-2 ring-blue-400' : ''}
                `}
              >
                {/* שורת כותרת - מספר יום בימין, חג בשמאל - צמוד למעלה */}
                <div className="flex items-center justify-between w-full mb-0.5 sm:mb-1 -mt-[1px]">
                  {/* חג/תאריך עברי - בצד שמאל */}
                  <div className="flex-shrink-0 flex items-center justify-center h-4 sm:h-5 md:h-7">
                    {cell.date && cell.inMonth && (
                      <HebrewDayBadge 
                        date={cell.date} 
                        compact={true}
                      />
                    )}
                  </div>
                  {/* מספר היום - בצד ימין */}
                  <div className={`text-[9px] sm:text-[10px] md:text-sm font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 flex items-center justify-center flex-shrink-0 ${isToday ? 'bg-red-400 text-white shadow-sm md:shadow-md' : 'text-gray-700'}`}>
                    {cell.date ? cell.date.getDate() : ''}
                  </div>
                </div>

                {/* תצוגת הזמנות */}
                <div className="space-y-0.5 sm:space-y-1">
                  {/* מובייל קטן: רק 1 הזמנה */}
                  <div className="block sm:hidden">
                    {dayOrders.length > 0 && (
                      <>
                        {(() => {
                          const o = dayOrders[0];
                          const bgColor = o.clientColor || "#a5c4f7ff";
                          const textColor = getTextColor(bgColor);
                          
                          return (
                            <div
                              className="truncate text-[7px] w-full px-0.5 py-0.5 rounded hover:shadow-sm transition-all font-medium text-center"
                              style={{ backgroundColor: bgColor, color: textColor }}
                              title={o.clientName}
                            >
                              {o.clientName}
                            </div>
                          );
                        })()}
                        {dayOrders.length > 1 && (
                          <div className="text-[7px] text-gray-500 w-full text-center">
                            +{dayOrders.length - 1}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* טאבלט ומעלה: 2 הזמנות */}
                  <div className="hidden sm:block">
                    {dayOrders.slice(0, 2).map((o: any) => {
                      const bgColor = o.clientColor || "#a5c4f7ff";
                      const textColor = getTextColor(bgColor);
                      
                      return (
                        <div
                          key={o.__id}
                          className="truncate text-[8px] sm:text-[9px] md:text-[10px] w-full px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 rounded sm:rounded-md hover:shadow-md transition-all font-medium text-center"
                          style={{ backgroundColor: bgColor, color: textColor }}
                          title={o.clientName}
                        >
                          {o.clientName}
                        </div>
                      );
                    })}
                    {dayOrders.length > 2 && (
                      <div className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-500 text-center w-full">
                        +{dayOrders.length - 2} נוספות
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