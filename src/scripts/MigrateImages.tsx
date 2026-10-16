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
import { ref, uploadString, getDownloadURL } from "firebase/storage";

type LogEntry = { text: string; ok: boolean };

async function uploadDataUrl(dataUrl: string, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
}

export default function MigrateImages() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function addLog(text: string, ok = true) {
    setLog((l) => [...l, { text, ok }]);
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

  return (
    <div className="max-w-2xl mx-auto p-6" dir="rtl" lang="he">
      <h1 className="text-2xl font-bold mb-2">מיגרציית תמונות → Firebase Storage</h1>
      <p className="text-sm text-gray-600 mb-4">
        סקריפט חד-פעמי. מעתיק תמונות מ-Firestore (base64) ל-Firebase Storage ומעדכן
        כל מסמך עם ה-URL החדש. מתכונים שכבר מועברים (יש להם{" "}
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
    </div>
  );
}
