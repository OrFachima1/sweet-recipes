// src/lib/fonts.ts
import { Fredoka } from 'next/font/google';

// פונט תצוגה: שמות לקוחות, שעות, מונים וחותמות במסכי השליח והווידוא
export const displayFont = Fredoka({ subsets: ['hebrew', 'latin'], weight: ['500', '600', '700'] });
