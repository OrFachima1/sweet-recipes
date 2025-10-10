// scripts/MigrateClients.tsx
// 🚨 זהו קומפוננט חד-פעמי לסנכרון לקוחות מהזמנות קיימות
// אפשר להריץ אותו פעם אחת ואז למחוק

"use client";
import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getRandomColor } from "@/utils/colorHelpers";

export default function MigrateClients() {
  const [status, setStatus] = useState<string>("מוכן להתחיל");
  const [migrated, setMigrated] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runMigration = async () => {
    setRunning(true);
    setStatus("טוען הזמנות...");
    
    try {
      // 1️⃣ קרא את כל ההזמנות
      const ordersSnap = await getDocs(collection(db, "orders"));
      const orders = ordersSnap.docs.map(d => d.data());
      
      setStatus(`נמצאו ${orders.length} הזמנות`);
      
      // 2️⃣ אסוף את כל שמות הלקוחות והצבעים שלהם
      const clientsMap = new Map<string, string>();
      
      orders.forEach((order: any) => {
        const name = order.clientName;
        const color = order.clientColor || getRandomColor();
        
        if (name && !clientsMap.has(name)) {
          clientsMap.set(name, color);
        }
      });
      
      setStatus(`נמצאו ${clientsMap.size} לקוחות ייחודיים`);
      
      // 3️⃣ צור/עדכן מסמכים ב-clients collection
      const migratedList: string[] = [];
      
      for (const [name, color] of clientsMap.entries()) {
        try {
          await setDoc(
            doc(db, "clients", name),
            {
              name,
              color,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true } // לא תשכתב אם כבר קיים
          );
          
          migratedList.push(`✅ ${name} - ${color}`);
          setMigrated([...migratedList]);
          
        } catch (e) {
          console.error(`שגיאה בלקוח ${name}:`, e);
          migratedList.push(`❌ ${name} - שגיאה`);
          setMigrated([...migratedList]);
        }
      }
      
      setStatus(`✅ הושלם! ${clientsMap.size} לקוחות סונכרנו`);
      
    } catch (e: any) {
      setStatus(`❌ שגיאה: ${e.message}`);
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🔄 סנכרון לקוחות
        </h1>
        
        <p className="text-gray-700 mb-6">
          סקריפט זה יקרא את כל ההזמנות הקיימות ויצור מסמך ב-collection "clients" 
          עבור כל לקוח עם הצבע המקורי שלו (או צבע אקראי אם לא קיים).
        </p>
        
        <div className="mb-6">
          <div className="text-lg font-bold text-blue-600 mb-2">
            סטטוס: {status}
          </div>
          
          {!running && migrated.length === 0 && (
            <button
              onClick={runMigration}
              className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-pink-400 to-red-400 text-white font-bold hover:shadow-lg transition-all"
            >
              🚀 התחל סנכרון
            </button>
          )}
          
          {running && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-pink-400 border-t-transparent" />
            </div>
          )}
        </div>
        
        {migrated.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="font-bold text-gray-900 mb-2">תוצאות:</h3>
            <div className="space-y-1 text-sm font-mono">
              {migrated.map((line, i) => (
                <div key={i} className="text-gray-700">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}