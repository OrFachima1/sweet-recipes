"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback} from "react";
import {
  fmtYMD,
  genId,
  addMonths,
  startOfWeek,
  addDays,
  getMonthGridMax5,
  normalizeImportantNotes,
  applyMappingOnOrders,
  getUnknownTitles,
} from "@/utils/orders";
import ManualOrderModal from "@/components/orders/modals/ManualOrderModal";
import Toolbar from "@/components/orders/Toolbar";
import MappingModal from "@/components/orders/modals/MappingModal";
import UploadModal from "@/components/orders/modals/UploadModal";
import DateFixModal from "@/components/orders/modals/DateFixModal";
import AddItemModal from "@/components/orders/modals/AddItemModal";
import MonthView from "@/components/orders/views/MonthView";
import WeekView from "@/components/orders/views/WeekView";
import DayOrdersList from "@/components/orders/DayOrdersList";
import DayModal from "@/components/orders/modals/DayModal";
import { parsePreviewStrict, ingestStrict } from "@/lib/ordersApi";
import type {
  IngestJsonOrder,
  IngestJsonOrderItem,
  NormalizedOrder,
  NormalizedOrderItem,
} from "@/types/orders";
import ViewToggle from "@/components/orders/ViewToggle";
import ClientsView from "@/components/orders/ClientsView";
import { setCategoryConfig } from "@/utils/categoryMapping";

// 🔥 Firebase imports
import { useUser, useRole } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy as firestoreOrderBy,
  writeBatch,
} from "firebase/firestore";
import ConfirmReviewModal from "@/components/orders/modals/ConfirmReviewModal";
import ReviewModal from "@/components/orders/modals/ReviewModal";
import SettingsModal from "@/components/orders/modals/SettingModal";
// ========================
// Debug helpers (safe on SSR)
// ========================
const isBrowser = typeof window !== "undefined";
const readDebugFlag = (): boolean => {
  if (!isBrowser) return false;
  try { return localStorage.getItem("ordersCalendar.debug") === "1"; } catch { return false; }
};
const writeDebugFlag = (val: boolean) => {
  if (!isBrowser) return;
  try { localStorage.setItem("ordersCalendar.debug", val ? "1" : "0"); } catch {}
};

// A tiny logger that checks a ref (no stale closures, no recursion)
function makeLogger(enabledRef: React.MutableRefObject<boolean>) {
  const on = (...a: any[]) => enabledRef.current && console.info("[OC]", ...a);
  const warn = (...a: any[]) => enabledRef.current && console.warn("[OC]", ...a);
  const err = (...a: any[]) => enabledRef.current && console.error("[OC]", ...a);
  const group = (label: string) => enabledRef.current && console.group(`[OC] ${label}`);
  const groupEnd = () => enabledRef.current && console.groupEnd();
  const time = (label: string) => enabledRef.current && console.time(`[OC] ${label}`);
  const timeEnd = (label: string) => enabledRef.current && console.timeEnd(`[OC] ${label}`);
  return { on, warn, err, group, groupEnd, time, timeEnd };
}

export default function OrdersCalendarPage({
  apiBase = "http://127.0.0.1:8000",
}: { apiBase?: string }) {
    console.log("🔄 OrdersCalendarPage RENDER");

  // 🔐 Auth & Role
  const { user, loading: authLoading } = useUser();
  const { role, displayName } = useRole(user?.uid);
  const isManager = role === "manager";

  // ===== State =====
  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [menuOptions, setMenuOptions] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDayKey, setSelectedDayKey] = useState<string>(fmtYMD(new Date()));
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  // ===== Review Modals =====
  const [showConfirmReview, setShowConfirmReview] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewData, setReviewData] = useState<{
    orders: any[];
    files: File[];
  } | null>(null);
  const [showManualOrder, setShowManualOrder] = useState(false);
 const [showSettings, setShowSettings] = useState(false);
 const [categoryConfig, setCategoryConfigState] = useState<{
  items: Record<string, { color: string; order: number }>;
  itemMapping: Record<string, string>;
} | null>(null);
useEffect(() => {
  if (!user) return;
  
  const categoryDoc = doc(db, "orderSettings", "categoryConfig");
  const unsub = onSnapshot(categoryDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const config = {
        items: data.items || {},
        itemMapping: data.itemMapping || {}
      };
      
      setCategoryConfigState(config);
      setCategoryConfig(config); // ✅ עדכן גם את categoryMapping.ts
      
      console.log("📁 קטגוריות נטענו:", config);
    } else {
      console.warn("⚠️ אין קטגוריות ב-Firestore!");
    }
  });
  
  return () => unsub();
}, [user]);
  // ESC to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dayModalKey) {
        setDayModalKey(null);
        log.on("[UI] close day modal (ESC)");
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [dayModalKey]);

  const [addItemFor, setAddItemFor] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState<string>("");
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});

  const [mapOpen, setMapOpen] = useState(false);
  const [unknowns, setUnknowns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);

  const [dateFixOpen, setDateFixOpen] = useState(false);
  const [dateFixList, setDateFixList] = useState<{ id: string; name: string; date: string }[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingestBufferRef = useRef<IngestJsonOrder[] | null>(null);
  const [mainView, setMainView] = useState<"calendar" | "clients">("calendar");

  // ===== Debug =====
  const [debugOn, setDebugOn] = useState<boolean>(readDebugFlag());
  const debugRef = useRef<boolean>(debugOn);
  useEffect(() => { debugRef.current = debugOn; }, [debugOn]);
  const log = useMemo(() => makeLogger(debugRef), []);
  const toggleDebug = () => {
    const next = !readDebugFlag();
    writeDebugFlag(next);
    setDebugOn(next);
    console.info("[UI] debug ->", next);
  };
  
  // 🔥 Load orders from Firestore (real-time)
  useEffect(() => {
    if (!user) return;
    let isSubscribed = true; // 🔧 הוסף את זה

    log.group("Load orders from Firestore");
    
    const ordersCol = collection(db, "orders");
    const q = query(ordersCol, firestoreOrderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
          if (!isSubscribed) return; // 🔧 הוסף את זה

      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          __id: d.id,
          orderId: data.orderId,
          clientName: data.clientName,
          eventDate: data.eventDate,
          status: data.status,
          items: data.items || [],
          orderNotes: data.orderNotes,
          totalSum: data.totalSum,
          currency: data.currency,
          source: data.source,
          meta: data.meta,
          createdAt: data.createdAt,
        } as IngestJsonOrder;
      });
      
      log.on("Orders loaded from Firestore", { count: list.length });
      setOrders(list);
    }, (err) => {
      log.err("Failed loading orders", err);
    });
    
    log.groupEnd();
   return () => {
    isSubscribed = false; // 🔧 הוסף את זה
    unsub();
  };
}, [user]);
useEffect(() => {
  if (!user) return;
  
  const settingsDoc = doc(db, "orderSettings", "main");
  const categoryDoc = doc(db, "orderSettings", "categoryConfig");
  
  const unsub1 = onSnapshot(settingsDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      setMapping(data.mapping || {});
      setIgnored(data.ignored || []);
    }
  });
  
  const unsub2 = onSnapshot(categoryDoc, (snap) => {
    if (snap.exists()) {
      setCategoryConfig(snap.data()); // ✅ זהו!
    }
  });
  
  return () => {
    unsub1();
    unsub2();
  };
}, [user]);
  // 🔥 Load mapping & ignored from Firestore
  useEffect(() => {
    if (!user) return;
    log.group("Load settings from Firestore");
    
    const settingsDoc = doc(db, "orderSettings", "main");
    const unsub = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMapping(data.mapping || {});
        setIgnored(data.ignored || []);
        log.on("Settings loaded", { mapping: data.mapping, ignored: data.ignored });
      } else {
        log.on("No settings doc, using defaults");
      }
    }, (err) => {
      log.err("Failed loading settings", err);
    });
    
    log.groupEnd();
    return () => unsub();
  }, [user]);

  // 🔥 Save mapping & ignored to Firestore
  const saveSettings = async (newMapping: Record<string, string>, newIgnored: string[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "orderSettings", "main"), {
        mapping: newMapping,
        ignored: newIgnored,
        updatedAt: serverTimestamp(),
      });
      log.on("Settings saved to Firestore");
    } catch (e) {
      log.err("Failed saving settings", e);
    }
  };

  // Update setMapping and setIgnored to also save to Firestore
  const updateMapping = (newMapping: Record<string, string>) => {
    setMapping(newMapping);
    saveSettings(newMapping, ignored);
  };

  const updateIgnored = (newIgnored: string[]) => {
    setIgnored(newIgnored);
    saveSettings(mapping, newIgnored);
  };

useEffect(() => {
  if (!user) return;
  
  log.group("Load menu from Firestore");
  
  const menuDoc = doc(db, "orderSettings", "menu");
  const unsub = onSnapshot(menuDoc, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const menuArray = data.items || [];
      setMenuOptions(menuArray);
      log.on("Menu loaded from Firestore", { count: menuArray.length });
    } else {
      // ⚠️ אל תיצור מסמך ריק אוטומטית!
      log.warn("No menu found in Firestore");
      setMenuOptions([]);
      // לא קוראים ל-setDoc כאן!
    }
  }, (err) => {
    log.err("Failed loading menu", err);
    setMenuOptions([]);
  });
  
  log.groupEnd();
  return () => unsub();
}, [user]);

  // ===== Persistence helper (now saves to Firestore) =====
  const persist = async (next: IngestJsonOrder[]) => {
     debugger;
  if (!user || !isManager) {
    console.log("❌ Cannot persist - no auth or not manager");
    log.warn("Cannot persist - no auth or not manager");
    return;
  }
  
  console.log("🚀 persist() START");
  console.log("📦 Orders to persist:", next.length);
  console.log("📦 First order sample:", next[0]);
  
  log.group("persist()");
  log.on("Saving orders to Firestore", { count: next.length });
  
  try {
    const batch = writeBatch(db);
    
    // סינון הזמנות בלי __id
    const validOrders = next.filter(o => o.__id);
    console.log("✅ Valid orders (with __id):", validOrders.length);
    
    if (validOrders.length === 0) {
      console.warn("⚠️ No valid orders to save!");
      return;
    }
    
    // Delete removed orders
    const currentIds = new Set(validOrders.map(o => o.__id));
    const deletedIds = orders
      .filter(o => o.__id && !currentIds.has(o.__id))
      .map(o => o.__id!);
    
    console.log("🗑️ Orders to delete:", deletedIds.length);
    
    for (const id of deletedIds) {
      console.log(`🗑️ Deleting: ${id}`);
      batch.delete(doc(db, "orders", id));
    }
    
    // Update/create orders
    console.log("💾 Starting to prepare orders for batch...");
    for (let i = 0; i < validOrders.length; i++) {
      const order = validOrders[i];
      console.log(`📝 Processing order ${i + 1}/${validOrders.length}: ${order.__id}`);
      
      const orderDoc = doc(db, "orders", order.__id!);
      
      // נקה undefined ← null
      const cleanData: any = {
        orderId: order.orderId ?? null,
        clientName: order.clientName ?? null,
          clientColor: order.clientColor ?? "#3B82F6", // ✅ הוסף שורה זו

        eventDate: order.eventDate ?? null,
        status: order.status ?? "new",
        items: (order.items || []).map(item => ({
          title: item.title ?? null,
          qty: typeof item.qty === 'number' ? item.qty : 1,
          unit: item.unit ?? null,
          notes: item.notes ?? null,
        })),
        orderNotes: order.orderNotes ?? null,
        totalSum: typeof order.totalSum === 'number' ? order.totalSum : null,
        currency: order.currency ?? null,
        source: order.source ?? null,
        meta: order.meta ?? null,
        createdAt: serverTimestamp(),
      };
      
      if (i === 0) {
        console.log("📋 First order clean data:", JSON.stringify(cleanData, null, 2));
      }
      
      batch.set(orderDoc, cleanData);
    }
    
    console.log("⏳ Committing batch to Firestore...");
    await batch.commit();
    console.log("✅✅✅ Batch committed successfully!");
    log.on("Batch write completed");
    
  } catch (e: any) {
    console.error("❌❌❌ PERSIST FAILED!");
    console.error("Error object:", e);
    console.error("Error name:", e?.name);
    console.error("Error message:", e?.message);
    console.error("Error code:", e?.code);
    console.error("Error stack:", e?.stack);
    log.err("Failed to persist", e);
    alert(`שגיאה בשמירה ל-Firebase: ${e?.message || e?.code || 'Unknown error'}`);
  }
  
  log.groupEnd();
};

  // ===== Derived =====
  const daysMap = useMemo(() => {
  const m = new Map<string, IngestJsonOrder[]>();
  for (const o of orders) {
    const day = o?.eventDate ? fmtYMD(new Date(o.eventDate)) : null;
    if (!day) continue;
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(o);
  }
  console.log("🗺️ daysMap recalculated, orders:", orders.length);
  return m;
}, [orders.length]); // 🔧 שינוי כאן - רק אורך המערך

  const dayKey = selectedDayKey;
  const todayKey = fmtYMD(new Date());
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // ===== UI actions =====
const goToday = () => {
  const t = new Date();
  setViewDate(t);
  setSelectedDayKey(fmtYMD(t));
  log.on("[UI] goToday ->", fmtYMD(t));
};

const prev = () => {
  if (viewMode === "month") {
    const d = addMonths(viewDate, -1);
    setViewDate(d);
    setSelectedDayKey(fmtYMD(d));
    log.on("[UI] prev month ->", d.toISOString());
  } else if (viewMode === "week") {
    const nd = addDays(viewDate, -7);
    setViewDate(nd);
    setSelectedDayKey(fmtYMD(nd));
    log.on("[UI] prev week ->", fmtYMD(nd));
  } else {
    const nd = addDays(viewDate, -1);
    setViewDate(nd);
    setSelectedDayKey(fmtYMD(nd));
    log.on("[UI] prev day ->", fmtYMD(nd));
  }
};

const next = () => {
  if (viewMode === "month") {
    const d = addMonths(viewDate, 1);
    setViewDate(d);
    setSelectedDayKey(fmtYMD(d));
    log.on("[UI] next month ->", d.toISOString());
  } else if (viewMode === "week") {
    const nd = addDays(viewDate, 7);
    setViewDate(nd);
    setSelectedDayKey(fmtYMD(nd));
    log.on("[UI] next week ->", fmtYMD(nd));
  } else {
    const nd = addDays(viewDate, 1);
    setViewDate(nd);
    setSelectedDayKey(fmtYMD(nd));
    log.on("[UI] next day ->", fmtYMD(nd));
  }
};

  const [picker, setPicker] = useState<string>(fmtYMD(new Date()));
  useEffect(() => {
    if (picker) {
      setSelectedDayKey(picker);
      setViewDate(new Date(picker));
      log.on("[UI] date picked ->", picker);
    }
  }, [picker]);
  const setSelectedDayKeyStable = useCallback((key: string) => {
  setSelectedDayKey(key);
}, []);

const setViewDateStable = useCallback((date: Date) => {
  setViewDate(date);
}, []);
  const confirmAddItem = (title: string) => {
    if (!isManager) {
      alert("אין לך הרשאה לערוך הזמנות");
      return;
    }
    if (!addItemFor || !title) return;
    
    log.on("[UI] add item", { orderId: addItemFor, title });
    const next = orders.map(o =>
      o.__id !== addItemFor
        ? o
        : { ...o, items: [...o.items, { title, qty: 1, unit: "יח'", notes: "" }] }
    );
    persist(next);
    setAddItemFor(null);
  };

  const noteKey = (orderId: string, idx: number) => `${orderId}:${idx}`;
  const toggleNote = (orderId: string, idx: number) => {
    setNoteOpen(prev => ({ ...prev, [noteKey(orderId, idx)]: !prev[noteKey(orderId, idx)] }));
    log.on("[UI] toggle note", { orderId, idx });
  };

  const editOrderItem = (orderId: string, idx: number, patch: Partial<IngestJsonOrderItem>) => {
    if (!isManager) {
      alert("אין לך הרשאה לערוך הזמנות");
      return;
    }
    
    log.on("[UI] edit item", { orderId, idx, patch });
    const next = orders.map(o => {
      if (o.__id !== orderId) return o;
      const items = o.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...o, items };
    });
    persist(next);
  };

  const removeItemFromOrder = (orderId: string, idx: number) => {
    if (!isManager) {
      alert("אין לך הרשאה למחוק פריטים");
      return;
    }
    
    log.on("[UI] remove item", { orderId, idx });
    const next = orders.map(o => (o.__id !== orderId ? o : { ...o, items: o.items.filter((_, i) => i !== idx) }));
    persist(next);
  };

  const deleteOrder = async (orderId: string) => {
    if (!isManager) {
      alert("אין לך הרשאה למחוק הזמנות");
      return;
    }
    
    log.warn("[UI] delete order?", { orderId });
    if (!confirm("למחוק את ההזמנה?")) return;
    
    try {
      await deleteDoc(doc(db, "orders", orderId));
      log.on("Order deleted from Firestore");
    } catch (e) {
      log.err("Failed to delete order", e);
      alert("שגיאה במחיקת ההזמנה");
    }
  };

  // ===== Upload + Preview + Mapping + Ingest =====
  const hasPendingFiles = () => files && files.length > 0;

  const runPreviewThenIngest = async (dateOverrides?: Record<number, string>) => {
  if (!isManager) {
    alert("אין לך הרשאה להעלות קבצים");
    return;
  }
  if (!files.length) return;
  
  setLoading(true);
  setError(null);
  log.group("runPreviewThenIngest()");
  log.on("[PREVIEW] files", files.map((f: File) => ({ name: f.name, size: f.size })));
  log.on("[PREVIEW] dateOverrides", dateOverrides);

  try {
    await doIngest({}, false, dateOverrides);
  } catch (e: any) {
    setError(e?.message || "Preview/ingest failed");
    log.err("[INGEST] failed", e);
  } finally {
    setLoading(false);
    log.groupEnd();
  }
};

 const doIngest = async (
  mappingObj: Record<string, string>,
  skipUnknownCheck: boolean = false,
  dateOverrides?: Record<number, string>
) => {
    if (!isManager) {
      alert("אין לך הרשאה לבצע פעולה זו");
      return;
    }
    
    log.group("doIngest()");
    log.on("[INGEST] start", { mapping: mappingObj, skipUnknownCheck });
    log.time("ingest.call");

    const data = await ingestStrict(apiBase, files, mappingObj);
    log.timeEnd("ingest.call");

    console.log("🔍 1️⃣ RAW DATA מה-API:", JSON.stringify(data, null, 2));

    // 1) Normalize
    let normalized: NormalizedOrder[] = (data.orders || []).map((o: any): NormalizedOrder => ({
      __id: o.__id ?? genId(),
      orderId: o.orderId ?? null,
      clientName: o.clientName,
      eventDate: o.eventDate ?? null,
      status: o.status ?? "new",
      items: (o.items || []).map((it: any): NormalizedOrderItem => ({
        title: String(it.title ?? "").trim(),
        qty: Number(it.qty ?? 1),
        notes: typeof it.notes === "string" && it.notes.trim() ? it.notes.trim() : undefined,
        unit: it.unit ?? null,
      })),
      orderNotes: o.orderNotes ?? o.notes ?? null,
      totalSum: o.totalSum ?? null,
      currency: o.currency ?? null,
      source: o.source,
      meta: o.meta,
    }));

    console.log("🔍 2️⃣ אחרי NORMALIZE:", normalized.length);
// ✅ החל את התאריכים שהמשתמש מילא
if (dateOverrides && Object.keys(dateOverrides).length > 0) {
  console.log("🗓️ מחיל תאריכים שהמשתמש מילא:", dateOverrides);
  normalized = normalized.map((order, idx) => {
    if (dateOverrides[idx]) {
      return { ...order, eventDate: dateOverrides[idx] };
    }
    return order;
  });
}
    // 2) Apply existing mapping FIRST (מה-state)
console.log("🔍 2.5️⃣ מיפוי קיים מה-state:", mapping);
if (Object.keys(mapping).length > 0) {
  console.log("✅ מחיל מיפוי קיים לפני בדיקה");
  normalized = applyMappingOnOrders(normalized, mapping);
}

// 2.1) Apply new mapping if provided (מה-parameter)
if (Object.keys(mappingObj).length) {
  console.log("✅ מחיל מיפוי נוסף מהפרמטר");
  normalized = applyMappingOnOrders(normalized, mappingObj);
}

// 3) Check unknowns
if (!skipUnknownCheck) {
  const stillUnknown = getUnknownTitles(normalized, menuOptions, ignored);
  console.log("🔍 4️⃣ unknowns אחרי מיפוי קיים:", stillUnknown);

  if (stillUnknown.length > 0) {
    console.log("🎯 יש unknowns - פותח חלונית מיפוי");
    ingestBufferRef.current = normalized as any;
    setUnknowns(stillUnknown);
    // ❌ לא לאפס! setMapping({});  
    // ✅ שומר את המיפוי הקיים כבר יש לו מה-state
    setShowUpload(false);  // ✅ סגור את חלונית ההעלאה
    setMapOpen(true);

    log.groupEnd();
    return;
  }
}

    // 4) Filter by menu
    const menuSet = new Set(menuOptions);
    const filtered = normalized
      .map(order => ({
        ...order,
        items: order.items.filter((item) => {
          const isInMenu = menuSet.has(item.title);
          if (!isInMenu) {
            console.log(`❌ זורק: "${item.title}" (לא בתפריט)`);
          }
          return isInMenu;
        })
      }))
      .filter(order => order.items.length > 0);

    console.log("🔍 5️⃣ אחרי FILTER:", filtered.length);

   const withNotes = filtered.map(o => normalizeImportantNotes(o));

// ✅ במקום persist ישירות - פותחים את חלונית האישור
console.log("🔹 9️⃣ פותח חלונית אישור לבדיקה");
setReviewData({
  orders: withNotes,
  files: files // הקבצים עדיין זמינים כאן!
});
setShowReview(true); // ישר למסך הבדיקה!

// ✅ הקוד הישן יעבור לפונקציה חדשה (ראה למטה)
  };

  // ===== Finalize Orders (אחרי בדיקה או ישירות) =====
const finalizeOrders = async (finalOrders: any[]) => {
  console.log("🔹 🎯 שומר הזמנות סופיות", finalOrders);
  
  const merged = [...orders, ...finalOrders];
  await persist(merged);

  const missing = finalOrders
    .filter(o => !o.eventDate)
    .map(o => ({ id: o.__id!, name: o.clientName, date: fmtYMD(new Date()) }));

  if (missing.length) {
    setDateFixList(missing);
    setDateFixOpen(true);
  }

  // ניקוי
  setShowUpload(false);
  setFiles([]);
  setShowConfirmReview(false);
  setShowReview(false);
  setReviewData(null);
  ingestBufferRef.current = null;
  log.on("🎉 העלאה הושלמה!");
};
  console.log("📊 State check:", {
  viewMode,
  loading,
  showUpload,
  mapOpen,
  dateFixOpen,
  dayModalKey,
  addItemFor,
  authLoading,
  role
});
// ===== Save Manual Order =====
const saveManualOrder = async (orderData: {
  clientName: string;
  eventDate: string;
  items: any[];
  orderNotes: string;
  clientColor?: string; // ✅ הוספת צבע
}) => {
  if (!isManager) {
    alert("אין לך הרשאה להוסיף הזמנות");
    return;
  }

  console.log("💾 שומר הזמנה ידנית חדשה", orderData);
  
  const newOrder = {
    __id: genId(),
    orderId: null,
    clientName: orderData.clientName,
    clientColor: orderData.clientColor || "#3B82F6", // ✅ ברירת מחדל כחול
    eventDate: orderData.eventDate,
    status: "new",
    items: orderData.items,
    orderNotes: orderData.orderNotes,
    totalSum: null,
    currency: null,
    source: "manual",
    meta: { addedManually: true, addedAt: new Date().toISOString() },
  };

  try {
    const orderDoc = doc(db, "orders", newOrder.__id);
    await setDoc(orderDoc, {
      orderId: newOrder.orderId,
      clientName: newOrder.clientName,
      clientColor: newOrder.clientColor, // ✅ שמירת הצבע
      eventDate: newOrder.eventDate,
      status: newOrder.status,
      items: newOrder.items,
      orderNotes: newOrder.orderNotes,
      totalSum: newOrder.totalSum,
      currency: newOrder.currency,
      source: newOrder.source,
      meta: newOrder.meta,
      createdAt: serverTimestamp(),
    });

    console.log("✅ הזמנה נשמרה בהצלחה");
    setShowManualOrder(false);
    
    // ניווט לתאריך של ההזמנה
    const orderDate = new Date(orderData.eventDate);
    setViewDate(orderDate);
    setSelectedDayKey(fmtYMD(orderDate));
    setViewMode("day");
    
  } catch (e: any) {
    console.error("❌ שגיאה בשמירת הזמנה", e);
    alert(`שגיאה בשמירה: ${e?.message || 'Unknown error'}`);
  }
};
  // ===== Loading state =====
  if (authLoading || role === null) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-2xl font-bold text-sky-950">טוען...</div>
        </div>
      </div>
    );
  }

  if (role === "unauthorized") {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">אין לך הרשאה לגשת לדף זה</div>
          <div className="mt-4 text-gray-600">צור קשר עם המנהל לקבלת הרשאות</div>
        </div>
      </div>
    );
  }

  // ===== Render =====
  const today = todayKey;
  const monthLbl = monthLabel;
  
  return (
    <div className="min-h-dvh w-full max-w-7xl mx-auto p-4 space-y-4 bg-white text-sky-950">
     <div className="flex justify-between items-center">
  <div className="text-sm text-gray-600">
    שלום, {displayName || user?.email}
    {isManager && <span className="mr-2 text-pink-600 font-bold">(מנהל)</span>}
  </div>
  
  {isManager && (
    <button
      onClick={() => setShowSettings(true)}
      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all flex items-center gap-2"
      title="הגדרות"
    >
      <span className="text-lg">⚙️</span>
      <span className="text-sm font-medium">הגדרות</span>
    </button>
  )}
</div>

      {/* מתג תצוגות */}
      <ViewToggle currentView={mainView} onToggle={setMainView} />

      {/* תצוגת לוח שנה */}
      {mainView === "calendar" && (
        <>
          <Toolbar
            viewMode={viewMode}
            onChangeViewMode={(m) => { setViewMode(m); log.on("[UI] view mode ->", m); }}
            picker={selectedDayKey}
            onPickerChange={(val: string) => { setPicker(val); }}
          />

          {viewMode === "month" && (
            <MonthView
              viewDate={viewDate}
              selectedDayKey={selectedDayKey}
              setSelectedDayKey={setSelectedDayKey}
              setViewDate={setViewDate}
              daysMap={daysMap}
              todayKey={today}
              onOpenDayModal={(key: string) => { setDayModalKey(key); }}
              onPrev={prev}
              onNext={next}
              onToday={goToday}
              monthLabel={monthLbl}
              onAddClient={isManager ? () => { setShowUpload(true); } : undefined}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              viewDate={viewDate}
              selectedDayKey={selectedDayKey}
              setSelectedDayKey={setSelectedDayKey}
              setViewDate={setViewDate}
              daysMap={daysMap}
              todayKey={today}
              onOpenDayModal={(key: string) => { setDayModalKey(key); }}
              onPrevWeek={prev}
              onNextWeek={next}
              onToday={goToday}
              monthLabel={monthLbl}
              onAddClient={isManager ? () => { setShowUpload(true); } : undefined}
            />
          )}

          {viewMode === "day" && (
            <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-gray-200">
              <div className="bg-red-100 px-6 py-6">
                <div className="flex items-center justify-between mb-3">
                  {isManager && (
                    <button
                      onClick={() => { setShowUpload(true); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
                    >
                      <span className="text-xl leading-none">＋</span>
                      <span>הוסף לקוח</span>
                    </button>
                  )}

                  <button
                    onClick={goToday}
                    className="text-xs px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
                  >
                    היום
                  </button>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button onClick={prev} className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900" title="יום קודם">
                    ‹
                  </button>

                  <div className="text-center min-w-[300px]">
                    <div className="text-5xl font-bold text-gray-900">
                      {new Date(dayKey).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                    </div>
                    <div className="text-lg font-medium text-gray-700 mt-1">
                      {new Date(dayKey).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-sm px-4 py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-2">
                      {(daysMap.get(dayKey) || []).length} הזמנות
                    </div>
                  </div>

                  <button onClick={next} className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900" title="יום הבא">
                    ›
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                <DayOrdersList
                  dayKey={dayKey}
                  daysMap={daysMap}
                  deleteOrder={isManager ? deleteOrder : undefined}
                  editOrderItem={isManager ? editOrderItem : undefined}
                  removeItemFromOrder={isManager ? removeItemFromOrder : undefined}
                  onAddItem={isManager ? (orderId: string) => { setAddItemFor(orderId); log.on("[UI] open add-item", { orderId }); } : undefined}
                  noteOpen={noteOpen}
                  toggleNote={toggleNote}
                />
              </div>
            </div>
          )}
        </>
      )}

      {mainView === "clients" && (
        <ClientsView
          orders={orders}
          onAddClient={isManager ? () => { setShowUpload(true); } : undefined}
        />
      )}

      {/* Day Modal */}
      {dayModalKey && (
        <DayModal
          dayKey={dayModalKey}
          onClose={() => { setDayModalKey(null); log.on("[UI] close day modal"); }}
          daysMap={daysMap}
          deleteOrder={isManager ? deleteOrder : undefined}
          editOrderItem={isManager ? editOrderItem : undefined}
          removeItemFromOrder={isManager ? removeItemFromOrder : undefined}
          onAddItem={isManager ? (orderId: string) => { setAddItemFor(orderId); log.on("[UI] open add-item", { orderId }); } : undefined}
          noteOpen={noteOpen}
          toggleNote={toggleNote}
        />
      )}

      {/* Add Item Picker - only for managers */}
      {isManager && (
        <AddItemModal
          showFor={addItemFor}
          onClose={() => { setAddItemFor(null); log.on("[UI] close add-item"); }}
          menuOptions={menuOptions}
          addSearch={addSearch}
          setAddSearch={setAddSearch}
          onConfirm={confirmAddItem}
        />
      )}

      {/* Mapping modal - only for managers */}
      {isManager && mapOpen && (
        <MappingModal
          unknowns={unknowns}
          mapping={mapping}
          setMapping={updateMapping}
          menuOptions={menuOptions}
          ignored={ignored}
          setIgnored={updateIgnored}
          onClose={() => { setMapOpen(false); log.on("[UI] close mapping"); }}
          onIngest={(mappingObj) => doIngest(mappingObj, true)}
          hasPendingFiles={hasPendingFiles}
          ingestBufferRef={ingestBufferRef}
          orders={orders as any}
          persist={persist as any}
        />
      )}

      {/* Upload PDF Modal - only for managers */}
      {isManager && (
  <UploadModal
    show={showUpload}
    onClose={() => { 
      setShowUpload(false); 
      log.on("[UI] close upload"); 
    }}
    files={files}
    setFiles={setFiles}
    error={error}
    loading={loading}
    onRunPreview={(dateOverrides) => runPreviewThenIngest(dateOverrides)}
    apiBase={apiBase}
    onManualStart={() => {
      console.log("🎯 onManualStart called!");
      setShowUpload(false);
      setShowManualOrder(true);
    }}
  />
)}
      {/* Date-fix modal - only for managers */}
      {isManager && (
        <DateFixModal
          show={dateFixOpen}
          onClose={() => { setDateFixOpen(false); log.on("[UI] close date-fix"); }}
          dateFixList={dateFixList}
          setDateFixList={setDateFixList}
          orders={orders}
          persist={persist}
        />
      )}

      {/* Confirm Review Modal */}
{showConfirmReview && reviewData && (
  <ConfirmReviewModal
    show={showConfirmReview}
    onConfirm={() => {
      console.log("✅ משתמש בחר לבדוק");
      setShowConfirmReview(false);
      setShowReview(true);
    }}
    onSkip={async () => {
      console.log("⏭️ משתמש דילג על בדיקה");
      setShowConfirmReview(false);
      await finalizeOrders(reviewData.orders);
    }}
  />
)}

{/* Review Modal */}
{showReview && reviewData && (
  <ReviewModal
    show={showReview}
    orders={reviewData.orders}
    files={reviewData.files}
    onClose={() => {
      console.log("❌ משתמש ביטל בדיקה");
      setShowReview(false);
      setShowConfirmReview(false);
      setReviewData(null);
    }}
    onSave={async (editedOrders) => {
      console.log("💾 משתמש שמר אחרי בדיקה", editedOrders);
      await finalizeOrders(editedOrders);
    }}
  />
)}
{/* Settings Modal - only for managers */}
{isManager && categoryConfig && (
  <SettingsModal
    show={showSettings}
    onClose={() => setShowSettings(false)}
    
    menuOptions={menuOptions}
    onUpdateMenu={async (newMenu) => {
  try {
    // שמור ל-Firebase
    await setDoc(doc(db, "orderSettings", "menu"), {
      items: newMenu,
      updatedAt: serverTimestamp(),
    });
    
    // עדכן state מקומי
    setMenuOptions(newMenu);
    
    console.log("✅ תפריט נשמר ל-Firebase");
  } catch (e) {
    console.error("❌ שגיאה בשמירת תפריט:", e);
    alert("שגיאה בשמירה");
  }
}}
    
    mapping={mapping}
    onUpdateMapping={updateMapping}
    
    ignored={ignored}
    onUpdateIgnored={updateIgnored}
    
    // ✅ העבר את הקטגוריות!
    categories={categoryConfig}
    
    onUpdateCategories={async (newConfig) => {
      try {
        await setDoc(doc(db, "orderSettings", "categoryConfig"), newConfig);
        setCategoryConfigState(newConfig);
        setCategoryConfig(newConfig);
        console.log("✅ קטגוריות נשמרו");
      } catch (e) {
        console.error("❌ שגיאה:", e);
        alert("שגיאה בשמירה");
      }
    }}
  />
)}
{/* Manual Order Modal - only for managers */}
{isManager && (
  <ManualOrderModal
    show={showManualOrder}
    onClose={() => setShowManualOrder(false)}
    onSave={saveManualOrder}
    menuOptions={menuOptions}
  />
)}
    </div>
  );
}