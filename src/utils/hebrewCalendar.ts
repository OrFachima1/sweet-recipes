// src/utils/hebrewCalendar.ts
import { HDate, HebrewCalendar, Event, flags, Location } from '@hebcal/core';

// יצירת אובייקט מיקום לישראל (תל אביב/רמת גן)
const ISRAEL_LOCATION = new Location(
  32.0853,  // latitude - רמת גן
  34.7818,  // longitude
  true,     // il (Israel)
  'Asia/Jerusalem',
  'Ramat Gan',
  'IL',
  'IL'
);

export interface HebrewDateInfo {
  hebrewDate: string; // תאריך עברי מלא
  hebrewMonth: string;
  hebrewDay: number;
  hebrewYear: number;
  holidays: HebrewHoliday[];
  isShabbat: boolean;
  candleLighting?: string; // זמן הדלקת נרות
  havdalah?: string; // זמן הבדלה
}

export interface HebrewHoliday {
  name: string;
  nameHebrew: string;
  type: 'major' | 'minor' | 'fast' | 'memorial' | 'modern' | 'shabbat';
  emoji?: string;
}

/**
 * ממיר תאריך לועזי לתאריך עברי עם מידע על חגים
 */
export function getHebrewDateInfo(date: Date): HebrewDateInfo {
  const hdate = new HDate(date);
  
  // קבלת תאריך עברי
  const hebrewDate = hdate.toString(); // "15 Nisan 5784"
  const hebrewMonth = hdate.getMonthName();
  const hebrewDay = hdate.getDate();
  const hebrewYear = hdate.getFullYear();
  
  // בדיקה אם זה שבת
  const isShabbat = hdate.getDay() === 6;
  
  // קבלת חגים ליום זה
  const holidays = getHolidaysForDate(date);
  
  return {
    hebrewDate,
    hebrewMonth,
    hebrewDay,
    hebrewYear,
    holidays,
    isShabbat,
  };
}

/**
 * מחזיר רשימת חגים לתאריך מסוים
 */
export function getHolidaysForDate(date: Date): HebrewHoliday[] {
  const options = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    isHebrewYear: false,
    candlelighting: true,
    location: ISRAEL_LOCATION,
    il: true, // ישראל
  };
  
  const events = HebrewCalendar.calendar(options);
  const dayEvents = events.filter(ev => {
    const evDate = ev.getDate().greg();
    return evDate.toDateString() === date.toDateString();
  });
  
  return dayEvents.map(ev => ({
    name: ev.render('en'),
    nameHebrew: ev.render('he'),
    type: getHolidayType(ev),
    emoji: getHolidayEmoji(ev),
  }));
}

/**
 * קובע את סוג החג
 */
function getHolidayType(event: Event): HebrewHoliday['type'] {
  const mask = event.getFlags();
  
  if (mask & flags.CHAG) return 'major';
  if (mask & flags.MINOR_HOLIDAY) return 'minor';
  if (mask & flags.MINOR_FAST) return 'fast';
  if (mask & flags.MODERN_HOLIDAY) return 'modern';
  if (mask & flags.SHABBAT_MEVARCHIM) return 'shabbat';
  
  // בדיקה לפי שם החג לימי זיכרון
  const name = event.render('en').toLowerCase();
  if (name.includes('yom hashoah') || name.includes('yom hazikaron')) {
    return 'memorial';
  }
  
  return 'minor';
}

/**
 * מחזיר אימוג׳י מתאים לחג
 */
function getHolidayEmoji(event: Event): string {
  const name = event.render('en').toLowerCase();
  
  if (name.includes('rosh hashana')) return '🍎';
  if (name.includes('yom kippur')) return '🕊️';
  if (name.includes('sukkot')) return '🌿';
  if (name.includes('simchat torah')) return '📜';
  if (name.includes('chanukah')) return '🕎';
  if (name.includes('purim')) return '🎭';
  if (name.includes('pesach') || name.includes('passover')) return '🍷';
  if (name.includes('shavuot')) return '📖';
  if (name.includes('tu bishvat')) return '🌳';
  if (name.includes('lag baomer')) return '🔥';
  if (name.includes('yom hashoah')) return '🕯️';
  if (name.includes('yom hazikaron')) return '🇮🇱';
  if (name.includes('yom haatzmaut')) return '🎉';
  if (name.includes('shabbat')) return '🕯️';
  
  return '✨';
}

/**
 * מחזיר את כל החגים בחודש מסוים
 */
export function getHolidaysForMonth(year: number, month: number): Map<string, HebrewHoliday[]> {
  const options = {
    year,
    month,
    isHebrewYear: false,
    il: true,
  };
  
  const events = HebrewCalendar.calendar(options);
  const holidaysMap = new Map<string, HebrewHoliday[]>();
  
  events.forEach(ev => {
    const date = ev.getDate().greg();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const holiday: HebrewHoliday = {
      name: ev.render('en'),
      nameHebrew: ev.render('he'),
      type: getHolidayType(ev),
      emoji: getHolidayEmoji(ev),
    };
    
    if (!holidaysMap.has(key)) {
      holidaysMap.set(key, []);
    }
    holidaysMap.get(key)!.push(holiday);
  });
  
  return holidaysMap;
}

/**
 * מחזיר את זמני כניסת ויציאת שבת
 */
export function getShabbatTimes(date: Date): { candleLighting: Date; havdalah: Date } | null {
  const hdate = new HDate(date);
  
  // בדוק אם זה שבת או ערב שבת
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5 && dayOfWeek !== 6) {
    return null;
  }
  
  const options = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    isHebrewYear: false,
    candlelighting: true,
    location: ISRAEL_LOCATION,
    il: true,
  };
  
  const events = HebrewCalendar.calendar(options);
  
  let candleLighting: Date | null = null;
  let havdalah: Date | null = null;
  
  events.forEach(ev => {
    const evDate = ev.getDate().greg();
    if (evDate.toDateString() === date.toDateString()) {
      const name = ev.render('en').toLowerCase();
      if (name.includes('candle lighting')) {
        candleLighting = evDate;
      } else if (name.includes('havdalah')) {
        havdalah = evDate;
      }
    }
  });
  
  if (candleLighting && havdalah) {
    return { candleLighting, havdalah };
  }
  
  return null;
}