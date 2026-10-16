"use client";

// סקריפט חד-פעמי: מעביר imageDataUrl מ-Firestore ל-Firebase Storage
// מריץ אותו דרך /migrate-images (מנהל בלבד), ואז אפשר למחוק

import React, { useState } from "react";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteField,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";

type LogEntry = { text: string; ok: boolean };

async function uploadDataUrl(dataUrl: string, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
}

// מוריד תמונה מ-URL, דוחס ל-WebP ב-canvas, מחזיר data URL
async function fetchAndCompressToWebP(
  imageUrl: string,
  maxW: number,
  maxH: number
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.78));
      };
      img.onerror = reject;
      img.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function MigrateImages() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const [webpLog, setWebpLog] = useState<LogEntry[]>([]);
  const [webpRunning, setWebpRunning] = useState(false);
  const [webpDone, setWebpDone] = useState(false);

  function addLog(text: string, ok = true) {
    setLog((l) => [...l, { text, ok }]);
  }
  function addWebpLog(text: string, ok = true) {
    setWebpLog((l) => [...l, { text, ok }]);
  }

  async function runMigration() {
    setRunning(true);
    setLog([]);
    setDone(false);

    let recipeMigrated = 0;
    let recipeSkipped = 0;
    let catMigrated = 0;
    let catSkipped = 0;

    // ── מתכונים ──
    addLog("📚 קורא מתכונים...");
    try {
      const snap = await getDocs(collection(db, "recipes"));
      addLog(`נמצאו ${snap.size} מתכונים`);

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        if (!data.imageDataUrl || data.imageUrl) {
          recipeSkipped++;
          continue;
        }

        const path = `recipes/${docSnap.id}.jpg`;
        addLog(`⬆️  מעלה מתכון: ${data.title || docSnap.id}`);
        try {
          const imageUrl = await uploadDataUrl(data.imageDataUrl, path);
          await updateDoc(doc(db, "recipes", docSnap.id), {
            imageUrl,
            imageDataUrl: deleteField(),
          });
          recipeMigrated++;
          addLog(`  ✅ הצליח`, true);
        } catch (err: any) {
          addLog(`  ❌ שגיאה: ${err?.message || err?.code || err}`, false);
        }
      }
    } catch (err: any) {
      addLog(`❌ שגיאה בקריאת מתכונים: ${err?.message || err}`, false);
    }

    // ── קטגוריות ──
    addLog("📁 קורא קטגוריות...");
    try {
      const snap = await getDocs(collection(db, "categories"));
      addLog(`נמצאו ${snap.size} קטגוריות`);

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        if (!data.imageDataUrl || data.imageUrl) {
          catSkipped++;
          continue;
        }

        const catKey = data.key || docSnap.id;
        const path = `categories/${catKey}.jpg`;
        addLog(`⬆️  מעלה קטגוריה: ${data.name || catKey}`);
        try {
          const imageUrl = await uploadDataUrl(data.imageDataUrl, path);
          await updateDoc(doc(db, "categories", docSnap.id), {
            imageUrl,
            imageDataUrl: deleteField(),
          });
          catMigrated++;
          addLog(`  ✅ הצליח`, true);
        } catch (err: any) {
          addLog(`  ❌ שגיאה: ${err?.message || err?.code || err}`, false);
        }
      }
    } catch (err: any) {
      addLog(`❌ שגיאה בקריאת קטגוריות: ${err?.message || err}`, false);
    }

    addLog(
      `🏁 סיום: ${recipeMigrated} מתכונים הועברו (${recipeSkipped} דולגו), ` +
        `${catMigrated} קטגוריות הועברו (${catSkipped} דולגו)`
    );
    setRunning(false);
    setDone(true);
  }

  // ── מיגרציה ל-WebP ──
  async function runWebPMigration() {
    setWebpRunning(true);
    setWebpLog([]);
    setWebpDone(false);

    let recipeDone = 0;
    let recipeSkipped = 0;
    let catDone = 0;
    let catSkipped = 0;

    // מתכונים
    addWebpLog("📚 קורא מתכונים...");
    try {
      const snap = await getDocs(collection(db, "recipes"));
      addWebpLog(`נמצאו ${snap.size} מתכונים`);

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        const imageUrl: string | undefined = data.imageUrl;

        // דלג אם אין תמונה, או שכבר WebP
        if (!imageUrl || !imageUrl.includes(".jpg")) {
          recipeSkipped++;
          continue;
        }

        const oldPath = `recipes/${docSnap.id}.jpg`;
        const newPath = `recipes/${docSnap.id}.webp`;
        addWebpLog(`🔄 ${data.title || docSnap.id}`);

        try {
          const webpDataUrl = await fetchAndCompressToWebP(imageUrl, 800, 600);
          const newUrl = await uploadDataUrl(webpDataUrl, newPath);
          await updateDoc(doc(db, "recipes", docSnap.id), { imageUrl: newUrl });
          await deleteObject(ref(storage, oldPath));
          recipeDone++;
          addWebpLog(`  ✅ הצליח`, true);
        } catch (err: any) {
          addWebpLog(`  ❌ שגיאה: ${err?.message || err?.code || err}`, false);
        }
      }
    } catch (err: any) {
      addWebpLog(`❌ שגיאה בקריאת מתכונים: ${err?.message || err}`, false);
    }

    // קטגוריות
    addWebpLog("📁 קורא קטגוריות...");
    try {
      const snap = await getDocs(collection(db, "categories"));
      addWebpLog(`נמצאו ${snap.size} קטגוריות`);

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        const imageUrl: string | undefined = data.imageUrl;

        if (!imageUrl || !imageUrl.includes(".jpg")) {
          catSkipped++;
          continue;
        }

        const catKey = data.key || docSnap.id;
        const oldPath = `categories/${catKey}.jpg`;
        const newPath = `categories/${catKey}.webp`;
        addWebpLog(`🔄 ${data.name || catKey}`);

        try {
          const webpDataUrl = await fetchAndCompressToWebP(imageUrl, 500, 500);
          const newUrl = await uploadDataUrl(webpDataUrl, newPath);
          await updateDoc(doc(db, "categories", docSnap.id), { imageUrl: newUrl });
          await deleteObject(ref(storage, oldPath));
          catDone++;
          addWebpLog(`  ✅ הצליח`, true);
        } catch (err: any) {
          addWebpLog(`  ❌ שגיאה: ${err?.message || err?.code || err}`, false);
        }
      }
    } catch (err: any) {
      addWebpLog(`❌ שגיאה בקריאת קטגוריות: ${err?.message || err}`, false);
    }

    addWebpLog(
      `🏁 סיום: ${recipeDone} מתכונים (${recipeSkipped} דולגו), ` +
        `${catDone} קטגוריות (${catSkipped} דולגו)`
    );
    setWebpRunning(false);
    setWebpDone(true);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10" dir="rtl" lang="he">

      {/* סקציה 1: מיגרציה מ-Firestore ל-Storage */}
      <section>
        <h1 className="text-2xl font-bold mb-2">מיגרציה 1 — Firestore → Firebase Storage</h1>
        <p className="text-sm text-gray-600 mb-4">
          מעתיק תמונות מ-Firestore (base64) ל-Firebase Storage. מתכונים שכבר מועברים (יש להם{" "}
          <code>imageUrl</code>) יידלגו.
        </p>
        <button
          onClick={runMigration}
          disabled={running}
          className="px-6 py-3 rounded-xl bg-pink-500 text-white font-bold shadow hover:bg-pink-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "רץ..." : done ? "הרץ שוב" : "התחל מיגרציה"}
        </button>
        {log.length > 0 && (
          <div className="mt-4 bg-gray-900 text-gray-100 rounded-xl p-4 text-sm font-mono max-h-96 overflow-y-auto space-y-0.5">
            {log.map((e, i) => (
              <div key={i} className={e.ok ? "text-green-300" : "text-red-400"}>
                {e.text}
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-gray-200" />

      {/* סקציה 2: דחיסה ל-WebP */}
      <section>
        <h1 className="text-2xl font-bold mb-2">מיגרציה 2 — JPEG → WebP</h1>
        <p className="text-sm text-gray-600 mb-4">
          מוריד כל תמונת JPEG קיימת מ-Firebase Storage, דוחס אותה ל-WebP ב-800×600 (מתכונים) או
          500×500 (קטגוריות), מעלה מחדש, מוחק את ה-JPEG המקורי, ומעדכן את Firestore עם ה-URL
          החדש. תמונות שכבר WebP יידלגו.
        </p>
        <button
          onClick={runWebPMigration}
          disabled={webpRunning}
          className="px-6 py-3 rounded-xl bg-violet-600 text-white font-bold shadow hover:bg-violet-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {webpRunning ? "רץ..." : webpDone ? "הרץ שוב" : "דחוס ל-WebP"}
        </button>
        {webpLog.length > 0 && (
          <div className="mt-4 bg-gray-900 text-gray-100 rounded-xl p-4 text-sm font-mono max-h-96 overflow-y-auto space-y-0.5">
            {webpLog.map((e, i) => (
              <div key={i} className={e.ok ? "text-green-300" : "text-red-400"}>
                {e.text}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
