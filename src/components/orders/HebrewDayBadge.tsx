// src/components/orders/HebrewDayBadge.tsx
"use client";
import React from "react";
import { getHebrewDateInfo } from "@/utils/hebrewCalendar";
import type { HebrewHoliday } from "@/utils/hebrewCalendar";

interface HebrewDayBadgeProps {
  date: Date;
  compact?: boolean; // לא באמת נשתמש בזה יותר, אבל נשאיר לתאימות
}

export interface HolidayDisplayInfo {
  text: string;
  bgColor: string;
  shouldHighlightCell: boolean;
}

export default function HebrewDayBadge({
  date,
  compact = false,
}: HebrewDayBadgeProps) {
  const hebrewInfo = getHebrewDateInfo(date);
  
  if (!hebrewInfo) return null;
  
  const dayOfWeek = date.getDay();
  const isFriday = dayOfWeek === 5;
  
  // מסנן חגים משמעותיים ומעבד אותם
  const processedHolidays = hebrewInfo.holidays
    .map(h => processHoliday(h))
    .filter(h => h !== null) as ProcessedHoliday[];
  
  // בשישי - מחפש זמן הדלקת נרות
  if (isFriday) {
    const candleLighting = hebrewInfo.holidays.find(h => 
      h.name.toLowerCase().includes('candle lighting')
    );
    
    if (candleLighting) {
      // חילוץ השעה מהשם (לדוגמה: "Candle lighting: 18:15")
      const timeMatch = candleLighting.name.match(/(\d{1,2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : '';
      
      return (
        <span 
          className="font-medium inline-block text-orange-700"
          title={candleLighting.nameHebrew}
          style={{
            lineHeight: '1',
            marginTop: '-6px' // הגבהה קלה למיישור עם המספר
          }}
        >
          <span 
            className="text-[6px] md:text-[9px]"
            style={{ lineHeight: '1' }}
          >
            🕯️ {time}
          </span>
        </span>
      );
    }
  }
  
  // אם אין חגים משמעותיים, לא מציג כלום
  if (processedHolidays.length === 0) {
    return null;
  }
  
  // בוחר את החג הראשון
  const holiday = processedHolidays[0];
  const bgColor = getHolidayColor(holiday.type);
  
  // קיצור שם החג לשתי מילים ראשונות
  const shortName = holiday.name.split(' ').slice(0, 2).join(' ');
  
  return (
    <span 
      className={`font-medium inline-block ${getTextOnlyColor(holiday.type)}`}
      title={holiday.nameHebrew}
      style={{
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: '1',
        fontSize: 'inherit',
        marginTop: '-6px' // הגבהה קלה למיישור עם המספר
      }}
    >
      {/* מובייל: 6px, אייפד: 9px (shortName), דסקטופ: 9px (fullName) */}
      <span 
        className="text-[6px] md:text-[9px]"
        style={{ lineHeight: '1' }}
      >
        <span className="md:hidden">{shortName}</span>
        <span className="hidden md:inline lg:hidden">{shortName}</span>
        <span className="hidden lg:inline">{holiday.name}</span>
      </span>
    </span>
  );
}

interface ProcessedHoliday {
  name: string;
  nameHebrew: string;
  nameEnglish: string;
  type: HebrewHoliday['type'];
  emoji?: string;
  isCandleLighting: boolean;
}

/**
 * מעבד ומסנן חג - מחזיר null אם לא רלוונטי
 */
function processHoliday(holiday: HebrewHoliday): ProcessedHoliday | null {
  const nameLower = holiday.name.toLowerCase();
  const nameHebrew = holiday.nameHebrew;
  
  // מסנן דברים לא רלוונטיים
  if (nameLower.includes('rosh chodesh')) return null;
  if (nameLower.includes('erev')) return null;
  if (nameLower.includes('candle lighting')) return null;
  if (nameLower.includes('havdalah')) return null;
  if (nameLower.includes('shabbat')) return null;
  if (nameLower.includes('fast begins')) return null;
  
  // צומות - השתמש בשם העברי הנקי שהספריה מחזירה
  if (holiday.type === 'fast') {
    let cleanName = nameHebrew;
    
    // אם השם העברי מכיל ניקוד, נקה אותו
    if (!cleanName || cleanName.includes(':') || cleanName.length < 3) {
      // fallback - תרגום לפי שם אנגלי
      if (nameLower.includes('gedaliah') || nameLower.includes('gedalia')) {
        cleanName = 'צום גדליה';
      } else if (nameLower.includes('tevet') || nameLower.includes('asara')) {
        cleanName = 'צום עשרה בטבת';
      } else if (nameLower.includes('esther') || nameLower.includes('ta\'anit')) {
        cleanName = 'תענית אסתר';
      } else if (nameLower.includes('tammuz')) {
        cleanName = 'צום י״ז בתמוז';
      } else if (nameLower.includes('av') || nameLower.includes('tish')) {
        cleanName = 'תשעה באב';
      }
    }
    
    return {
      name: cleanName,
      nameHebrew: cleanName,
      nameEnglish: holiday.name,
      type: 'fast',
      emoji: holiday.emoji,
      isCandleLighting: false
    };
  }
  
  return {
    name: nameHebrew,
    nameHebrew: nameHebrew,
    nameEnglish: holiday.name,
    type: holiday.type,
    emoji: holiday.emoji,
    isCandleLighting: false
  };
}

/**
 * מחזיר צבע טקסט בלבד (בלי רקע) לפי סוג החג
 */
function getTextOnlyColor(type: HebrewHoliday['type']): string {
  switch (type) {
    case 'major':
      return 'text-blue-700';
    case 'minor':
      return 'text-emerald-700';
    case 'fast':
      return 'text-gray-700';
    case 'memorial':
      return 'text-slate-800';
    case 'modern':
      return 'text-cyan-700';
    default:
      return 'text-yellow-800';
  }
}

/**
 * מחזיר צבע רקע וטקסט לפי סוג החג
 */
function getHolidayColor(type: HebrewHoliday['type']): string {
  switch (type) {
    case 'major':
      return 'bg-blue-100 text-blue-800';
    case 'minor':
      return 'bg-emerald-100 text-emerald-700';
    case 'fast':
      return 'bg-gray-100 text-gray-700';
    case 'memorial':
      return 'bg-slate-200 text-slate-800';
    case 'modern':
      return 'bg-cyan-100 text-cyan-700';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

/**
 * פונקציה עזר שבודקת אם יום מסוים צריך הדגשה של כל המשבצת
 */
export function shouldHighlightDay(date: Date): { shouldHighlight: boolean; bgColor: string } | null {
  const hebrewInfo = getHebrewDateInfo(date);
  if (!hebrewInfo) return null;
  
  // מסנן חגים משמעותיים
  const significantHolidays = hebrewInfo.holidays.filter(h => {
    const name = h.name.toLowerCase();
    return !name.includes('rosh chodesh') && 
           !name.includes('erev') &&
           !name.includes('candle lighting') &&
           !name.includes('havdalah') &&
           !name.includes('shabbat');
  });
  
  if (significantHolidays.length === 0) return null;
  
  const holiday = significantHolidays[0];
  const nameLower = holiday.name.toLowerCase();
  
  // חגים שצריכים הדגשה
  if (holiday.type === 'major' || holiday.type === 'minor' || holiday.type === 'fast' || holiday.type === 'memorial' || holiday.type === 'modern') {
    // רק חגים ספציפיים מסוג modern
    if (holiday.type === 'modern') {
      const isYomHashoah = nameLower.includes('yom hashoah') || nameLower.includes('shoah');
      const isYomHazikaron = (nameLower.includes('yom hazikaron') || nameLower.includes('hazikaron')) && !nameLower.includes('shoah');
      const isYomHaatzmaut = nameLower.includes('yom haatzma') || 
                             nameLower.includes('independence') ||
                             nameLower.includes('atzmaut');
      
      if (!isYomHashoah && !isYomHazikaron && !isYomHaatzmaut) {
        return null;
      }
    }
    
    return {
      shouldHighlight: true,
      bgColor: getCellHighlightColor(holiday.type)
    };
  }
  
  return null;
}

/**
 * מחזיר צבע רקע עדין למשבצת כולה
 */
function getCellHighlightColor(type: HebrewHoliday['type']): string {
  switch (type) {
    case 'major':
      return 'bg-blue-50/80';
    case 'minor':
      return 'bg-emerald-50/80';
    case 'fast':
      return 'bg-gray-50/80';
    case 'memorial':
      return 'bg-slate-50/80';
    case 'modern':
      return 'bg-cyan-50/80';
    default:
      return '';
  }
}