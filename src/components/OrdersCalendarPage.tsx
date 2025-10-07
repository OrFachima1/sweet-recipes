"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { STORAGE_KEYS, loadJson, saveJson } from "@/utils/ordersStorage";
import type {
  IngestJsonOrder,
  IngestJsonOrderItem,
  NormalizedOrder,
  NormalizedOrderItem,
} from "@/types/orders";
import ViewToggle from "@/components/orders/ViewToggle";
import ClientsView from "@/components/orders/ClientsView";

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
  // ===== State =====
  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [menuOptions, setMenuOptions] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedDayKey, setSelectedDayKey] = useState<string>(fmtYMD(new Date()));
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  // הוסף את זה אחרי ה-useState של dayModalKey
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
  const [mapping, setMapping] = useState<Record<string, string>>(
    () => loadJson(STORAGE_KEYS.MAPPING, {})
  );
  const [ignored, setIgnored] = useState<string[]>(
    () => loadJson(STORAGE_KEYS.IGNORED, [])
  );

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

  // ===== Persistence helpers =====
  const persist = (next: IngestJsonOrder[]) => {
    log.group("persist()");
    log.on("Saving orders", { count: next.length });
    setOrders(next);
    saveJson(STORAGE_KEYS.LAST_JSON, { orders: next });
    log.groupEnd();
  };

  const hasPendingFiles = () => files && files.length > 0;

  // ===== Load last state =====
  useEffect(() => {
    if (!isBrowser) return;
    log.group("Load last JSON");
    try {
      const last = localStorage.getItem("ordersCalendar.lastJson");
      if (last) {
        const obj = JSON.parse(last) as { orders?: IngestJsonOrder[] };
        const arr = Array.isArray(obj?.orders) ? obj.orders : [];
        const withIds = arr.map(o => ({ ...o, __id: o.__id || genId() })).map(normalizeImportantNotes);
        log.on("Loaded from storage", { orders: withIds.length });
        setOrders(withIds);
      } else {
        log.on("No previous data in storage");
      }
    } catch (e) {
      log.err("Failed parsing last JSON", e);
    }
    log.groupEnd();
  }, []);

  // persist mapping/ignored
  useEffect(() => { saveJson(STORAGE_KEYS.MAPPING, mapping); }, [mapping]);
  useEffect(() => { saveJson(STORAGE_KEYS.IGNORED, ignored); }, [ignored]);

  // ===== Load menu.json =====
  useEffect(() => {
    let cancel = false;
    (async () => {
      log.group("Load menu.json");
      log.time("menu.fetch");
      try {
        const res = await fetch("/menu.json", { headers: { accept: "application/json" } });
        const data = await res.json().catch(() => ({}));
        const arr = Array.isArray(data) ? data : (Array.isArray((data as any)?.menu) ? (data as any).menu : []);
        if (!cancel) {
          setMenuOptions(arr || []);
          log.on("Menu loaded", { items: (arr || []).length });
        }
      } catch (e) {
        if (!cancel) setMenuOptions([]);
        log.warn("Menu load failed, fallback to []", e);
      } finally {
        log.timeEnd("menu.fetch");
        log.groupEnd();
      }
    })();
    return () => { cancel = true; };
  }, []);

  // ===== Derived =====
  const daysMap = useMemo(() => {
    const m = new Map<string, IngestJsonOrder[]>();
    for (const o of orders) {
      const day = o?.eventDate ? fmtYMD(new Date(o.eventDate)) : null;
      if (!day) continue;
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(o);
    }
    return m;
  }, [orders]);

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
    // במצב חודש - מעבר לחודש קודם של היום הנבחר
    const currentDate = new Date(selectedDayKey);
    const d = addMonths(currentDate, -1);
    setViewDate(d);
    setSelectedDayKey(fmtYMD(d)); // 👈 חשוב! עדכן גם את היום הנבחר
    log.on("[UI] prev month ->", d.toISOString());
  } else if (viewMode === "week") {
    const nd = addDays(new Date(selectedDayKey), -7);
    setSelectedDayKey(fmtYMD(nd));
    setViewDate(nd);
    log.on("[UI] prev week ->", fmtYMD(nd));
  } else {
    const nd = addDays(new Date(selectedDayKey), -1);
    setSelectedDayKey(fmtYMD(nd));
    setViewDate(nd);
    log.on("[UI] prev day ->", fmtYMD(nd));
  }
};

const next = () => {
  if (viewMode === "month") {
    // במצב חודש - מעבור לחודש הבא של היום הנבחר
    const currentDate = new Date(selectedDayKey);
    const d = addMonths(currentDate, 1);
    setViewDate(d);
    setSelectedDayKey(fmtYMD(d)); // 👈 חשוב! עדכן גם את היום הנבחר
    log.on("[UI] next month ->", d.toISOString());
  } else if (viewMode === "week") {
    const nd = addDays(new Date(selectedDayKey), 7);
    setSelectedDayKey(fmtYMD(nd));
    setViewDate(nd);
    log.on("[UI] next week ->", fmtYMD(nd));
  } else {
    const nd = addDays(new Date(selectedDayKey), 1);
    setSelectedDayKey(fmtYMD(nd));
    setViewDate(nd);
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

  const confirmAddItem = (title: string) => {
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
    log.on("[UI] edit item", { orderId, idx, patch });
    const next = orders.map(o => {
      if (o.__id !== orderId) return o;
      const items = o.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...o, items };
    });
    persist(next);
  };
  const removeItemFromOrder = (orderId: string, idx: number) => {
    log.on("[UI] remove item", { orderId, idx });
    const next = orders.map(o => (o.__id !== orderId ? o : { ...o, items: o.items.filter((_, i) => i !== idx) }));
    persist(next);
  };
  const deleteOrder = (orderId: string) => {
    log.warn("[UI] delete order?", { orderId });
    if (!confirm("למחוק את ההזמנה?")) return;
    const filtered = orders.filter(o => o.__id !== orderId);
    persist(filtered);
  };

  // ===== Upload + Preview + Mapping + Ingest =====
 const runPreviewThenIngest = async () => {
  if (!files.length) return;
  setLoading(true); 
  setError(null);
  log.group("runPreviewThenIngest()");
  log.on("[PREVIEW] files", files.map((f: File) => ({ name: f.name, size: f.size })));
  
  try {
    // פשוט קוראים ל-doIngest - הוא יטפל בהכל!
    await doIngest({}, false); // false = בדוק unknowns
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
  skipUnknownCheck: boolean = false
) => {
  log.group("doIngest()");
  log.on("[INGEST] start", { mapping: mappingObj, skipUnknownCheck });
  log.time("ingest.call");
  
  // 🔍 נקודת בדיקה 1: מה ה-API מחזיר?
  const data = await ingestStrict(apiBase, files, mappingObj);
  log.timeEnd("ingest.call");
  
  console.log("🔍 1️⃣ RAW DATA מה-API:", JSON.stringify(data, null, 2));
  console.log("🔍 1️⃣ כמה הזמנות:", data.orders?.length);
  console.log("🔍 1️⃣ כל ה-items:", data.orders?.flatMap((o: any) => o.items?.map((i: any) => i.title)));

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
  
  // 🔍 נקודת בדיקה 2: אחרי normalize
  console.log("🔍 2️⃣ אחרי NORMALIZE:");
  console.log("   - הזמנות:", normalized.length);
  console.log("   - סה\"כ items:", normalized.reduce((acc, o) => acc + o.items.length, 0));
  console.log("   - כל ה-titles:", normalized.flatMap(o => o.items.map(i => i.title)));

  // 2) Apply mapping
  if (Object.keys(mappingObj).length) {
    normalized = applyMappingOnOrders(normalized, mappingObj);
    console.log("🔍 3️⃣ אחרי MAPPING:");
    console.log("   - כל ה-titles:", normalized.flatMap(o => o.items.map(i => i.title)));
  }

  // 🔍 נקודת בדיקה 3: בדיקת unknowns
  console.log("🔍 4️⃣ בודק UNKNOWNS:");
  console.log("   - skipUnknownCheck:", skipUnknownCheck);
  console.log("   - menuOptions:", menuOptions);
  console.log("   - ignored:", ignored);

  if (!skipUnknownCheck) {
    const stillUnknown = getUnknownTitles(normalized, menuOptions, ignored);
    
    console.log("🔍 5️⃣ תוצאת getUnknownTitles:");
    console.log("   - unknowns:", stillUnknown);
    console.log("   - כמות:", stillUnknown.length);
    
    if (stillUnknown.length > 0) {
      console.log("🎯 פותח חלונית מיפוי!");
      ingestBufferRef.current = normalized as any;
      setUnknowns(stillUnknown);
      setMapping({});
      setMapOpen(true);
      log.groupEnd();
      return; // 🛑 עוצרים כאן!
    } else {
      console.log("⚠️ אין unknowns - ממשיך לסינון!");
    }
  }

  // 🔍 נקודת בדיקה 4: לפני סינון
  console.log("🔍 6️⃣ לפני FILTER:");
  console.log("   - הזמנות:", normalized.length);
  console.log("   - items:", normalized.flatMap(o => o.items.map(i => i.title)));

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
    
  // 🔍 נקודת בדיקה 5: אחרי סינון
  console.log("🔍 7️⃣ אחרי FILTER:");
  console.log("   - הזמנות לפני:", normalized.length);
  console.log("   - הזמנות אחרי:", filtered.length);
  console.log("   - items שנשארו:", filtered.flatMap(o => o.items.map(i => i.title)));

  // המשך כרגיל...
  const withNotes = filtered.map(o => normalizeImportantNotes(o));
  const merged = [...orders, ...withNotes];
  persist(merged);

  const missing = withNotes
    .filter(o => !o.eventDate)
    .map(o => ({ id: o.__id!, name: o.clientName, date: fmtYMD(new Date()) }));
    
  if (missing.length) {
    setDateFixList(missing);
    setDateFixOpen(true);
  }

  setShowUpload(false);
  setFiles([]);
  ingestBufferRef.current = null;
  log.groupEnd();
};


  // ===== Render =====
  const today = todayKey;
  const monthLbl = monthLabel;
  const prevWeek = () => {
  const nd = addDays(new Date(selectedDayKey), -7);
  setSelectedDayKey(fmtYMD(nd));
  setViewDate(nd);
  log.on("[UI] prev week ->", fmtYMD(nd));
};

const nextWeek = () => {
  const nd = addDays(new Date(selectedDayKey), 7);
  setSelectedDayKey(fmtYMD(nd));
  setViewDate(nd);
  log.on("[UI] next week ->", fmtYMD(nd));


};
  return (
  <div className="min-h-dvh w-full max-w-7xl mx-auto p-4 space-y-4 bg-white text-sky-950">
      {/* Debug switch */}
      <div className="flex justify-end">
        <button
          onClick={toggleDebug}
          className={`text-xs px-2 py-1 rounded border ${debugOn ? "bg-green-100 border-green-300 text-green-800" : "bg-gray-50 border-gray-200 text-gray-600"}`}
          title="Toggle console debug"
        >
          דיבוג: {debugOn ? "פעיל" : "כבוי"}
        </button>
      </div>
     {/* מתג תצוגות - חדש! */}
    <ViewToggle currentView={mainView} onToggle={setMainView} />
    
   {/* תצוגת לוח שנה */}
{mainView === "calendar" && (
  <>
    {/* Toolbar */}
    <Toolbar
      viewMode={viewMode}
      onChangeViewMode={(m) => { setViewMode(m); log.on("[UI] view mode ->", m); }}
      picker={selectedDayKey}
      onPickerChange={(val: string) => { setPicker(val); }}
    />

    {/* Month view */}
    {viewMode === "month" && (
      <MonthView
        viewDate={viewDate}
        selectedDayKey={selectedDayKey}
        setSelectedDayKey={(k: string) => { setSelectedDayKey(k); }}
        setViewDate={(d: Date) => { setViewDate(d); }}
        daysMap={daysMap}
        todayKey={today}
        onOpenDayModal={(key: string) => { setDayModalKey(key); }}
        onPrev={prev}
        onNext={next}
        onToday={goToday}
        monthLabel={monthLbl}
        onAddClient={() => { setShowUpload(true); }} // 👈 חדש
      />
    )}

    {/* Week view */}
    {viewMode === "week" && (
      <WeekView
        viewDate={viewDate}
        selectedDayKey={selectedDayKey}
        setSelectedDayKey={(k: string) => { setSelectedDayKey(k); }}
        setViewDate={(d: Date) => { setViewDate(d); }}
        daysMap={daysMap}
        todayKey={today}
        onOpenDayModal={(key: string) => { setDayModalKey(key); }}
        onPrevWeek={prevWeek}
        onNextWeek={nextWeek}
        onToday={goToday}
        monthLabel={monthLbl}
        onAddClient={() => { setShowUpload(true); }} // 👈 חדש
      />
    )}

    {/* Day view */}
    {viewMode === "day" && (
      <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-gray-200">
        {/* Header עם ניווט */}
        <div className="bg-red-100 px-6 py-6">
          <div className="flex items-center justify-between mb-3">
            {/* כפתור הוסף לקוח */}
            <button
              onClick={() => { setShowUpload(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
            >
              <span className="text-xl leading-none">＋</span>
              <span>הוסף לקוח</span>
            </button>

            <button
              onClick={goToday}
              className="text-xs px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
            >
              היום
            </button>
          </div>

          <div className="flex items-center justify-center gap-6">
            {/* חץ שמאל - יום קודם */}
            <button
              onClick={prev}
              className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900"
              title="יום קודם"
            >
              ‹
            </button>

            {/* תאריך */}
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

            {/* חץ ימין - יום הבא */}
            <button
              onClick={next}
              className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900"
              title="יום הבא"
            >
              ›
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 bg-gradient-to-br from-white to-gray-50">
          <DayOrdersList
            dayKey={dayKey}
            daysMap={daysMap}
            deleteOrder={deleteOrder}
            editOrderItem={editOrderItem}
            removeItemFromOrder={removeItemFromOrder}
            onAddItem={(orderId: string) => { setAddItemFor(orderId); log.on("[UI] open add-item", { orderId }); }}
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
        onAddClient={() => { setShowUpload(true); }}
      />
    )}
      {/* Day Modal */}
      {dayModalKey && (
        <DayModal
          dayKey={dayModalKey}
          onClose={() => { setDayModalKey(null); log.on("[UI] close day modal"); }}
          daysMap={daysMap}
          deleteOrder={deleteOrder}
          editOrderItem={editOrderItem}
          removeItemFromOrder={removeItemFromOrder}
          onAddItem={(orderId: string) => { setAddItemFor(orderId); log.on("[UI] open add-item", { orderId }); }}
          noteOpen={noteOpen}
          toggleNote={toggleNote}
        />
      )}

      {/* Add Item Picker */}
      <AddItemModal
        showFor={addItemFor}
        onClose={() => { setAddItemFor(null); log.on("[UI] close add-item"); }}
        menuOptions={menuOptions}
        addSearch={addSearch}
        setAddSearch={setAddSearch}
        onConfirm={confirmAddItem}
      />

      {/* Mapping modal */}
      {mapOpen && (
        <MappingModal
  unknowns={unknowns}
  mapping={mapping}
  setMapping={setMapping}
  menuOptions={menuOptions}
  setIgnored={setIgnored}
  onClose={() => { setMapOpen(false); log.on("[UI] close mapping"); }}
  onIngest={(mappingObj) => doIngest(mappingObj, true)} // 👈 true = דלג על בדיקה חוזרת
  hasPendingFiles={hasPendingFiles}
  ingestBufferRef={ingestBufferRef}
  orders={orders as any}
  persist={persist as any}
/>
      )}

      {/* Upload PDF Modal */}
      <UploadModal
        show={showUpload}
        onClose={() => { setShowUpload(false); log.on("[UI] close upload"); }}
        files={files}
        setFiles={setFiles}
        error={error}
        loading={loading}
        onRunPreview={runPreviewThenIngest}
      />

      {/* Date-fix modal */}
      <DateFixModal
        show={dateFixOpen}
        onClose={() => { setDateFixOpen(false); log.on("[UI] close date-fix"); }}
        dateFixList={dateFixList}
        setDateFixList={setDateFixList}
        orders={orders}
        persist={persist}
      />
    </div>
  );
}
