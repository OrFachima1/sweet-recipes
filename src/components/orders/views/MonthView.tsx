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

  return (
    <div className="rounded-xl md:rounded-3xl overflow-hidden shadow-lg md:shadow-2xl bg-white border-2 md:border-4 border-gray-200">
      {/* Header - responsive */}
      <div className="bg-red-100 px-3 py-3 md:px-6 md:py-6">
        <div className="flex items-center justify-between mb-2 md:mb-3">
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
        
        <div className="flex items-center justify-center gap-2 md:gap-6">
          <button
            onClick={onPrev}
            className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-2xl md:text-4xl text-gray-900"
            title="חודש קודם"
          >
            ‹
          </button>

          <div className="text-center min-w-[120px] md:min-w-[200px]">
            <div className="text-3xl md:text-6xl font-bold text-gray-900">
              {monthName}
            </div>
            <div className="text-sm md:text-lg font-medium text-gray-700 mt-0.5 md:mt-1">
              {year}
            </div>
            <div className="text-[10px] md:text-sm px-2 md:px-4 py-0.5 md:py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-1 md:mt-2">
              {Array.from(daysMap.values()).reduce((sum, orders) => sum + orders.length, 0)} הזמנות
            </div>
          </div>

          <button
            onClick={onNext}
            className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-2xl md:text-4xl text-gray-900"
            title="חודש הבא"
          >
            ›
          </button>
        </div>
      </div>

      {/* כותרת ימים - responsive */}
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
        
        <div className="relative grid grid-cols-7 text-[10px] md:text-sm font-bold">
          {weeksHeader.map((d, idx) => {
            const isWeekend = idx === 5 || idx === 6;
            return (
              <div
                key={d}
                className={`
                  relative px-1 py-2 md:px-2 md:py-4 text-center
                  ${isWeekend ? 'bg-gradient-to-b from-gray-100/80 to-gray-200/80' : ''}
                `}
              >
                <div className="relative inline-block">
                  <span className={`relative z-10 ${isWeekend ? 'text-gray-600' : 'text-gray-800'}`}>
                    <span className="hidden md:inline">{d}</span>
                    <span className="md:hidden">{weeksHeaderShort[idx]}</span>
                  </span>
                  <div className={`
                    absolute -bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 h-0.5 md:h-1 rounded-full
                    ${isWeekend 
                      ? 'w-6 md:w-12 bg-gradient-to-r from-transparent via-gray-400 to-transparent' 
                      : 'w-8 md:w-16 bg-gradient-to-r from-transparent via-orange-400 to-transparent'
                    }
                  `} />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="h-0.5 md:h-1 bg-gradient-to-r from-red-300 via-orange-300 to-red-300" />
      </div>

      {/* גריד הימים - responsive */}
      <div className="p-1 md:p-2 bg-gradient-to-br from-white to-gray-50">
        <div className="grid grid-cols-7 gap-0.5 md:gap-1">
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
                  relative min-h-12 md:min-h-24 rounded md:rounded-lg text-left p-1 md:p-2 border transition-all cursor-pointer
                  ${cell.inMonth 
                    ? isWeekend 
                      ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                      : 'bg-white border-gray-200 hover:bg-orange-50/30'
                    : 'bg-gray-50/30 border-transparent'
                  }
                  ${isToday ? 'ring-1 md:ring-2 ring-red-400 shadow-md md:shadow-lg' : ''}
                  ${isSelected ? 'ring-1 md:ring-2 ring-blue-400' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-0.5 md:mb-1">
                  <div
                    className={`
                      text-[10px] md:text-sm font-bold rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center
                      ${isToday ? 'bg-red-400 text-white shadow-sm md:shadow-md' : 'text-gray-700'}
                    `}
                  >
                    {cell.date ? cell.date.getDate() : ''}
                  </div>
                  {dayOrders.length > 0 && (
                    <button
                      className="text-[8px] md:text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDayModal(key);
                      }}
                    >
                      <span className="hidden sm:inline">פתח</span>
                      <span className="sm:hidden">↗</span>
                    </button>
                  )}
                </div>

                {/* תצוגת הזמנות - responsive */}
                <div className="space-y-0.5 md:space-y-1">
                  {/* מובייל: רק ראשון */}
                  <div className="block md:hidden">
                    {dayOrders.length > 0 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDayModal(key);
                          }}
                          className="truncate text-[9px] w-full text-left px-1 py-0.5 rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
                          title={dayOrders[0].clientName}
                        >
                          {dayOrders[0].clientName}
                        </button>
                        {dayOrders.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDayModal(key);
                            }}
                            className="text-[8px] text-gray-500 hover:text-gray-700 px-1"
                          >
                            +{dayOrders.length - 1}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* טאבלט ומעלה: 2 ראשונים */}
                  <div className="hidden md:block">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}