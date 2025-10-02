"use client";
import { useEffect, useState } from "react";

type BIPE = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BIPE | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIsIOS(isiOS);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // אנדרואיד/כרום: לוכדים את beforeinstallprompt
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPE);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP as any);

    // אם אין beforeinstallprompt וגם לא מותקן: ב-iOS נציג הוראות
    const t = setTimeout(() => {
      if (!isStandalone && isIOS) setVisible(true);
    }, 300);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as any);
      clearTimeout(t);
    };
  }, [isStandalone, isIOS]);

  if (isStandalone || !visible) return null;

  const installAndroid = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome !== "accepted") {
      // המשתמש דחה – נשאיר את הבאנר כדי שיוכל לנסות שוב
    } else {
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-3 inset-x-3 z-[1000]">
      <div className="rounded-2xl bg-white/95 backdrop-blur shadow-xl border p-3 flex items-start gap-3" dir="rtl">
        {/* אייקון קטן */}
        <div className="h-10 w-10 rounded-xl bg-[#fde2e4] grid place-items-center text-pink-700 text-xl">★</div>

        {/* תוכן */}
        <div className="flex-1 text-sm text-[#2b2b2b]">
          {isIOS ? (
            <>
              <div className="font-bold mb-1">להתקנה למסך הבית</div>
              <div>פתחי/פתחי בתפריט <strong>שיתוף</strong> → בחרי <strong>הוספה למסך הבית</strong>.</div>
              <div className="text-xs text-gray-500 mt-1">עובד רק בספארי. לאחר ההוספה, פתחו דרך האייקון למסך מלא.</div>
            </>
          ) : (
            <>
              <div className="font-bold mb-1">התקן כאפליקציה</div>
              <div>לחצו על “התקן” כדי להוסיף למסך הבית.</div>
            </>
          )}
        </div>

        {/* כפתורים */}
        <div className="flex items-center gap-2">
          {!isIOS && deferred && (
            <button onClick={installAndroid} className="px-3 py-2 rounded-xl bg-pink-500 text-white font-semibold">
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
