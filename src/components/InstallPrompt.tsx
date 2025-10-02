"use client";
import { useEffect, useState } from "react";

type BIPE = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [deferred, setDeferred] = useState<BIPE | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // האם רץ כאפליקציה (נפתח מהאייקון)
    const inStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as any).standalone === true;
    setStandalone(inStandalone);

    // זיהוי iOS וכל דפדפן / ספארי בלבד
    const ua = navigator.userAgent;
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = isiOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    setIsIOSDevice(isiOS);
    setIsIOSSafari(isSafari);
  }, []);

  // ANDROID/CHROME: beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPE);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP as any);
    return () => window.removeEventListener("beforeinstallprompt", onBIP as any);
  }, []);

  // iOS: אם לא מותקן – הצג בנר הדרכה (גם אם זה לא ספארי → ננחה לפתוח בספארי)
  useEffect(() => {
    if (!standalone && isIOSDevice) {
      // השהייה קצרה שלא נקפוץ מעל תוכן
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [standalone, isIOSDevice]);

  if (standalone || !visible) return null;

  const installAndroid = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setVisible(false);
  };

  return (
    <div className="fixed bottom-3 inset-x-3 z-[1000]" dir="rtl">
      <div className="rounded-2xl bg-white/95 backdrop-blur shadow-xl border p-3 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#fde2e4] grid place-items-center text-pink-700 text-xl">★</div>

        <div className="flex-1 text-sm text-[#2b2b2b]">
          {isIOSDevice ? (
            isIOSSafari ? (
              <>
                <div className="font-bold mb-1">להתקנה למסך הבית</div>
                <div>
                  הקש/י על כפתור <strong>שיתוף</strong> (הריבוע עם החץ) ←{' '}
                  <strong>הוספה למסך הבית</strong>.
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  אחרי ההוספה, פותחים מהאייקון למסך מלא.
                </div>
              </>
            ) : (
              <>
                <div className="font-bold mb-1">התקנה ב־iOS</div>
                <div>
                  פתח/י את הכתובת הזו ב־<strong>Safari</strong>, ואז: שיתוף → הוספה למסך הבית.
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  (ב־Chrome/Firefox על iOS אין “התקן”; זו מגבלה של אפל)
                </div>
              </>
            )
          ) : (
            <>
              <div className="font-bold mb-1">התקן כאפליקציה</div>
              <div>לחצו “התקן” כדי להוסיף למסך הבית.</div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isIOSDevice && deferred && (
            <button
              onClick={installAndroid}
              className="px-3 py-2 rounded-xl bg-pink-500 text-white font-semibold"
            >
              התקן
            </button>
          )}
          <button onClick={() => setVisible(false)} className="px-3 py-2 rounded-xl border bg-white">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
