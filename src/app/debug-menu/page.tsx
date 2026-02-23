'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useUser } from '@/lib/auth';

// הנלווים שהגדרת
const DISH_ACCESSORIES: Record<string, string[]> = {
  // סלטים
  "ירקות חתוכים": ["כף חלוקה", "2 רוטב שום"],
  "מגש בוראטה": ["רוטב בלסמי"],
  "סלט בטטה קריספי": ["כף חלוקה", "רוטב שמן זית", "בטטה קריספי", "בולגרית"],
  "סלט בריאות": ["כף חלוקה", "רוטב דבש"],
  "סלט כרוב אסיאתי": ["כף חלוקה", "רוטב בלסמי"],
  "סלט סביח": ["כף חלוקה", "רוטב טחינה"],
  "סלט פסטה פסטו": ["כף חלוקה", "בולגרית"],
  "סלט קיסר": ["כף חלוקה", "רוטב קיסר", "קרוטונים", "פרמז'ן"],
  "סלט קפרזה": ["כף חלוקה", "רוטב בלסמי"],
  "סלט שוק": ["כף חלוקה", "רוטב שמן זית", "בולגרית"],
  "סלט שרי פיקנטי": ["כף חלוקה", "רוטב דבש"],
  "סלט תאילנדי": ["כף חלוקה", "רוטב חמאת בוטנים"],
  "קרפצ'יו חציל": ["מקלות שום"],
  "קרפצ'יו סלק": ["בולגרית", "רוטב בלסמי קטן"],

  // קישים (מלבד אישיים)
  "קיש בטטה": ["מרית חלוקה"],
  "קיש בצל ועיזים": ["מרית חלוקה"],
  "קיש ברוקולי": ["מרית חלוקה"],
  "קיש משפחתי קוטר 24": ["מרית חלוקה"],
  "קיש פטריות": ["מרית חלוקה"],

  // פסטות
  "גלילות חציל": ["כף חלוקה"],
  "גלילות חציל בטחינה": ["כף חלוקה"],
  "לזניה רוזה": ["כף חלוקה"],
  "פסטה אלפרדו": ["כף חלוקה"],
  "פסטה ברוטב עגבניות ובזיליקום": ["כף חלוקה"],
  "פסטה פסטו": ["כף חלוקה"],
  "פסטה רוזה": ["כף חלוקה"],
  "פסטה שמנת וערמונים": ["כף חלוקה"],
  "קנלוני תרד וגבינות": ["כף חלוקה"],
  "תפוח אדמה מוקרם": ["כף חלוקה"],

  // כל מיני
  "סלמון שלם ופיצוחים": ["כף חלוקה"],
  "פריקסה": ["כפיות", "מפיות"],
  "שקשוקה": ["12 לחמניות ביס"],
  "שקשוקה ירוקה": ["12 לחמניות ביס"],

  // קינוחים
  "כוסות קינוח": ["20 כפיות"],
  "מגש ברולה": ["15 כפיות"],
  "סנט הונורה": ["מרית חלוקה"],
  "עוגת גבינה אפויה": ["מרית חלוקה"],
  "פאי לימון קוטר 26": ["מרית חלוקה"],
};

export default function DebugMenuPage() {
  const { user, loading: userLoading } = useUser();
  const [currentAccessories, setCurrentAccessories] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const snap = await getDoc(doc(db, 'orderSettings', 'dishAccessories'));
        if (snap.exists()) {
          setCurrentAccessories(snap.data().accessories || {});
        }
      } catch (e) {
        console.error('Error loading data:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const saveAllAccessories = async () => {
    if (!user) return;

    setSaving(true);
    setMessage('');

    try {
      // מיזוג הנלווים הקיימים עם החדשים
      const merged = { ...currentAccessories, ...DISH_ACCESSORIES };

      await setDoc(doc(db, 'orderSettings', 'dishAccessories'), {
        accessories: merged,
        updatedAt: serverTimestamp(),
      });

      setCurrentAccessories(merged);
      setMessage(`נשמרו ${Object.keys(DISH_ACCESSORIES).length} מנות עם נלווים!`);
    } catch (e: any) {
      setMessage('שגיאה: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (userLoading || !user) {
    return <div className="p-8 text-center">טוען...</div>;
  }

  if (loading) {
    return <div className="p-8 text-center">טוען נתונים...</div>;
  }

  const newCount = Object.keys(DISH_ACCESSORIES).filter(k => !currentAccessories[k]).length;
  const updateCount = Object.keys(DISH_ACCESSORIES).filter(k => currentAccessories[k]).length;

  return (
    <div className="p-8 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">הוספת נלווים למנות</h1>

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="font-semibold mb-2">סיכום:</p>
        <ul className="text-sm space-y-1">
          <li>מנות חדשות להוספה: <strong>{newCount}</strong></li>
          <li>מנות קיימות לעדכון: <strong>{updateCount}</strong></li>
          <li>סה"כ מנות עם נלווים: <strong>{Object.keys(DISH_ACCESSORIES).length}</strong></li>
        </ul>
      </div>

      <button
        onClick={saveAllAccessories}
        disabled={saving}
        className="w-full mb-6 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:bg-gray-400"
      >
        {saving ? 'שומר...' : 'שמור את כל הנלווים ל-Firebase'}
      </button>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${message.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-200">
        <p className="font-semibold text-yellow-800 mb-2">הערות חשובות:</p>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• כפפות ומגש אלומיניום לסלטים - דורש לוגיקה מותנית (להוסיף בהמשך)</li>
          <li>• פלטת אנטיפסטי, ברוסקטות, טורטיות, כריכונים - ללא נלווים מוגדרים</li>
          <li>• קרואסונים מלוחים/מתוקים, עוגיות - ללא נלווים</li>
        </ul>
      </div>

      <h2 className="text-lg font-semibold mb-4">רשימת הנלווים שיתווספו:</h2>

      <div className="space-y-3">
        {Object.entries(DISH_ACCESSORIES).map(([dish, accessories]) => (
          <div
            key={dish}
            className={`p-3 rounded-lg border ${
              currentAccessories[dish] ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-medium">{dish}</span>
                {currentAccessories[dish] && (
                  <span className="text-xs text-gray-500 mr-2">(קיים)</span>
                )}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {accessories.map((acc, i) => (
                <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border">
                  {acc}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
