// src/lib/date.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// הגדרת ברירת מחדל לסביבה שלך (Asia/Jerusalem)
export const DEFAULT_TZ = 'Asia/Jerusalem';
export const d = (input?: string | number | Date) => dayjs(input).tz(DEFAULT_TZ);

export const fmtYMD = (date: Date | string | number) => {
  const x = d(date);
  return x.format('YYYY-MM-DD');
};

export default dayjs;
