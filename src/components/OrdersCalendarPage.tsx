"use client";
import React, { useEffect, useMemo, useCallback } from "react";
import { fmtYMD } from "@/utils/orders";
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
import ViewToggle from "@/components/orders/ViewToggle";
import ClientsView from "@/components/orders/ClientsView";
import ConfirmReviewModal from "@/components/orders/modals/ConfirmReviewModal";
import ReviewModal from "@/components/orders/modals/ReviewModal";
import SettingsModal from "@/components/orders/modals/SettingModal";
import RevenueModal from "@/components/orders/modals/RevenueModal";
import HomeButton from "@/components/HomeButton";
import { useClients } from "@/hooks/useClients";
import { useUser, useRole } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// ===== Custom Hooks =====
import { useOrdersWithColors } from '@/hooks/useOrdersWithColors';
import { useOrdersState } from '@/hooks/useOrdersState';
import { useOrdersActions } from '@/hooks/useOrdersActions';
import { useOrdersSettings } from '@/hooks/useOrdersSettings';
import { useOrdersUpload } from '@/hooks/useOrdersUpload';
import { useOrdersNavigation } from '@/hooks/useOrdersNavigation';
import { useOrdersModals } from '@/hooks/useOrdersModals';
import { useOrdersFirebase } from '@/hooks/useOrdersFirebase';
import type { IngestJsonOrder } from '@/types/orders';



export default function OrdersCalendarPage({
  apiBase = "http://127.0.0.1:8000",
}: { apiBase?: string }) {
  // ===== Auth & Role =====
  const { user, loading: authLoading } = useUser();
  const { role, displayName } = useRole(user?.uid);
  const isManager = role === "manager";

  // ===== Core State & Actions =====
  const state = useOrdersState();
  const actions = useOrdersActions({
    orders: state.orders,
    setOrders: state.setOrders,
  });
  const settings = useOrdersSettings(user?.uid);
  const {clients, getClientColor, ensureClient, updateClientColor } = useClients(user?.uid);
  const ordersWithColors = useOrdersWithColors(state.orders, clients);

  // ===== Navigation =====
  const navigation = useOrdersNavigation({
    viewMode: state.viewMode,
    viewDate: state.viewDate,
    setViewDate: state.setViewDate,
  });

  // ===== Modals =====
  const modals = useOrdersModals();

  // ===== Upload & Review =====
  const upload = useOrdersUpload({
    apiBase,
    isManager,
    mapping: settings.mapping,
    ignored: settings.ignored,
    menuOptions: state.menuOptions,
    getClientColor,
    ensureClient,
  });

  // ===== Firebase =====
  const firebase = useOrdersFirebase({
    user,
    isManager,
    getClientColor,
    setOrders: state.setOrders,
    orders: state.orders,
    settings,
    setMenuOptions: state.setMenuOptions,
  });

  // ===== ESC to close modal =====
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.dayModalKey) {
        state.setDayModalKey(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [state.dayModalKey, state]);

  // ===== Derived Data =====
  const daysMap = useMemo(() => {
  const m = new Map<string, IngestJsonOrder[]>();
  for (const o of ordersWithColors) {  // ✅ שינוי: state.orders → ordersWithColors
    const day = o?.eventDate ? fmtYMD(new Date(o.eventDate)) : null;
    if (!day) continue;
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(o);
  }
  return m;
}, [ordersWithColors]);  // ✅ שינוי: state.orders → ordersWithColors


  // ===== Add Item =====
  const confirmAddItem = useCallback((title: string) => {
  if (!isManager) {
    alert("אין לך הרשאה לערוך הזמנות");
    return;
  }
  if (!state.addItemFor || !title) return;

  const next = ordersWithColors.map(o =>  // ✅ שינוי
    o.__id !== state.addItemFor
      ? o
      : { ...o, items: [...o.items, { title, qty: 1, unit: "יח'", notes: "" }] }
  );
  firebase.persist(next);
  state.setAddItemFor(null);
}, [isManager, state.addItemFor, ordersWithColors, firebase, state]);  // ✅ שינוי

  // ===== Update Mapping & Ignored =====
  const updateMapping = useCallback((newMapping: Record<string, string>) => {
    settings.updateMapping(newMapping);
    firebase.saveSettings(newMapping, settings.ignored);
  }, [settings, firebase]);

  const updateIgnored = useCallback((newIgnored: string[]) => {
    settings.updateIgnored(newIgnored);
    firebase.saveSettings(settings.mapping, newIgnored);
  }, [settings, firebase]);
const editOrderNotes = useCallback((orderId: string, notes: string) => {
  if (!isManager) {
    alert("אין לך הרשאה לערוך הזמנות");
    return;
  }
  
  const cleanNotes = notes?.trim() || null;
  
  const next = ordersWithColors.map(o =>  // ✅ שינוי
    o.__id !== orderId 
      ? o 
      : { 
          ...o, 
          orderNotes: cleanNotes
        }
  );
  
  firebase.persist(next);
}, [isManager, ordersWithColors, firebase]);  // ✅ שינוי
const editEventDate = useCallback((orderId: string, newDate: string) => {
  if (!isManager) {
    alert("אין לך הרשאה לערוך הזמנות");
    return;
  }
  
  const next = ordersWithColors.map(o =>
    o.__id !== orderId 
      ? o 
      : { 
          ...o, 
          eventDate: newDate
        }
  );
  
  firebase.persist(next);
}, [isManager, ordersWithColors, firebase]);
  // ===== Loading State =====
  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">טוען...</div>;
  }

  if (!user) {
    return <div className="p-8 text-center text-gray-500">נא להתחבר</div>;
  }

  const dayKey = navigation.selectedDayKey;
  const today = navigation.today;
  const monthLbl = navigation.monthLabel;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* כפתור בית */}
      <HomeButton />

      {/* כפתורי מנהל - Fixed position */}
      {isManager && (
        <>
          <button
            onClick={() => modals.setShowSettings(true)}
            className="fixed left-[3.75rem] top-3 md:left-[4.25rem] md:top-4 z-50 h-11 w-11 md:h-12 md:w-12 rounded-2xl border shadow bg-white/90 hover:bg-white hover:border-gray-300 active:scale-95 grid place-items-center backdrop-blur transition-all"
            aria-label="הגדרות"
            title="הגדרות"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => modals.setShowRevenue(true)}
            className="fixed left-[6.75rem] top-3 md:left-[7.5rem] md:top-4 z-50 h-11 w-11 md:h-12 md:w-12 rounded-2xl border shadow bg-white/90 hover:bg-white hover:border-gray-300 active:scale-95 grid place-items-center backdrop-blur transition-all"
            aria-label="הכנסות"
            title="הכנסות"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </>
      )}

      {/* Header - Layout חדש */}
      <div className="flex items-center justify-between mb-6 gap-2 md:gap-4">
        {/* ימין - שלום משתמש */}
        <div className="text-xl md:text-2xl font-bold text-gray-900 flex-1 md:flex-none">
          <div className="flex flex-col md:flex-row md:items-center md:gap-2">
            <span>שלום {displayName || user?.email || 'עובד'}</span>
            {isManager && <span className="text-sm md:text-xl text-blue-600">(מנהל)</span>}
          </div>
        </div>

        {/* מרכז - טוגל לוח שנה/לקוחות */}
        <div className="flex-shrink-0 absolute left-1/2 transform -translate-x-1/2">
          <ViewToggle
            currentView={navigation.mainView}
            onToggle={navigation.setMainView}
          />
        </div>

        {/* שמאל - ריק */}
        <div className="w-10 md:w-11 flex-shrink-0"></div>
      </div>

      {/* Calendar Views */}
      {navigation.mainView === "calendar" && (() => {
        // Store viewMode before type narrowing to avoid TypeScript errors in tabs
        const currentViewMode = state.viewMode;
        return (
        <>
          {state.viewMode === "month" && (
            <MonthView
              viewDate={state.viewDate}
              selectedDayKey={navigation.selectedDayKey}
              setSelectedDayKey={navigation.setSelectedDayKey}
              setViewDate={state.setViewDate}
              daysMap={daysMap}
              todayKey={today}
              onOpenDayModal={(key: string) => state.setDayModalKey(key)}
              onPrev={navigation.prev}
              onNext={navigation.next}
              onToday={navigation.goToday}
              monthLabel={monthLbl}
              onAddClient={isManager ? () => state.setShowUpload(true) : undefined}
              viewMode={state.viewMode}
              onChangeViewMode={state.setViewMode}
            />
          )}

          {state.viewMode === "week" && (
            <WeekView
              viewDate={state.viewDate}
              selectedDayKey={navigation.selectedDayKey}
              setSelectedDayKey={navigation.setSelectedDayKey}
              setViewDate={state.setViewDate}
              daysMap={daysMap}
              todayKey={today}
              onOpenDayModal={(key: string) => state.setDayModalKey(key)}
              onPrevWeek={navigation.prev}
              onNextWeek={navigation.next}
              onToday={navigation.goToday}
              monthLabel={monthLbl}
              onAddClient={isManager ? () => state.setShowUpload(true) : undefined}
              viewMode={state.viewMode}
              onChangeViewMode={state.setViewMode}
            />
          )}

          {state.viewMode === "day" && (
  <div className="rounded-xl md:rounded-3xl overflow-hidden shadow-lg md:shadow-2xl bg-white border-2 md:border-4 border-gray-200">
    <div className="bg-red-100 px-3 py-3 md:px-6 md:py-6">
      {/* שורה אחת: הוסף לקוח + טאבים + היום */}
      <div className="relative flex items-center justify-between mb-3">
        {/* שמאל - הוסף לקוח */}
        <div className="flex-shrink-0">
          {isManager && (
            <button
              onClick={() => state.setShowUpload(true)}
              className="inline-flex items-center gap-1 md:gap-2 px-2 py-1 md:px-3 md:py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md text-xs md:text-sm font-medium"
            >
              <span className="text-base md:text-lg leading-none">＋</span>
              <span className="hidden sm:inline">הוסף לקוח</span>
            </button>
          )}
        </div>

        {/* מרכז - טאבי תצוגה (absolute למרכז מושלם) */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => state.setViewMode("month")}
            className={`px-2.5 md:px-3 py-1 text-xs md:text-sm rounded-lg transition-all ${
              currentViewMode === "month"
                ? "bg-white/90 text-gray-900 font-semibold shadow-sm"
                : "bg-white/40 text-gray-600 hover:bg-white/60"
            }`}
          >
            חודשית
          </button>
          <button
            onClick={() => state.setViewMode("week")}
            className={`px-2.5 md:px-3 py-1 text-xs md:text-sm rounded-lg transition-all ${
              currentViewMode === "week"
                ? "bg-white/90 text-gray-900 font-semibold shadow-sm"
                : "bg-white/40 text-gray-600 hover:bg-white/60"
            }`}
          >
            שבועית
          </button>
          <button
            onClick={() => state.setViewMode("day")}
            className={`px-2.5 md:px-3 py-1 text-xs md:text-sm rounded-lg transition-all ${
              currentViewMode === "day"
                ? "bg-white/90 text-gray-900 font-semibold shadow-sm"
                : "bg-white/40 text-gray-600 hover:bg-white/60"
            }`}
          >
            יומית
          </button>
        </div>

        {/* ימין - היום */}
        <div className="flex-shrink-0">
          <button
            onClick={navigation.goToday}
            className="text-[10px] md:text-xs px-2 md:px-3 py-1 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
          >
            היום
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 md:gap-6">
        <button 
          onClick={navigation.prev} 
          className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-2xl md:text-4xl text-gray-900" 
          title="יום קודם"
        >
          ‹
        </button>

        <div className="text-center min-w-[200px] md:min-w-[300px]">
          <div className="text-3xl md:text-5xl font-bold text-gray-900">
            {new Date(dayKey).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
          </div>
          <div className="text-sm md:text-lg font-medium text-gray-700 mt-0.5 md:mt-1">
            {new Date(dayKey).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric' })}
          </div>
          <div className="text-xs md:text-sm px-3 md:px-4 py-0.5 md:py-1 rounded-full bg-white/60 text-gray-700 font-medium inline-block mt-1 md:mt-2">
            {(daysMap.get(dayKey) || []).length} הזמנות
          </div>
        </div>

        <button 
          onClick={navigation.next} 
          className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-2xl md:text-4xl text-gray-900" 
          title="יום הבא"
        >
          ›
        </button>
      </div>
    </div>

    <div className="p-2 md:p-4 bg-gradient-to-br from-white to-gray-50">
      <DayOrdersList
        dayKey={dayKey}
        daysMap={daysMap}
        isManager={isManager}
        menuOptions={state.menuOptions}
        deleteOrder={isManager ? actions.deleteOrder : undefined}
        editOrderItem={isManager ? actions.editOrderItem : undefined}
        removeItemFromOrder={isManager ? actions.removeItemFromOrder : undefined}
        onAddItem={isManager ? (orderId: string) => state.setAddItemFor(orderId) : undefined}
        onEditOrderNotes={isManager ? editOrderNotes : undefined}
        noteOpen={modals.noteOpen}
        toggleNote={modals.toggleNote}
        onEditEventDate={isManager ? editEventDate : undefined}  // 🔥 הוסף את השורה הזו
        onEditColor={isManager ? async (clientName, newColor) => {
          await updateClientColor(clientName, newColor);
        } : undefined}
        getClientColor={getClientColor}
        recipeLinks={settings.recipeLinks}
      />
    </div>
  </div>
)}

        </>
        );
      })()}

      {/* Clients View */}
      {navigation.mainView === "clients" && (
        <ClientsView
          orders={ordersWithColors}
          onAddClient={isManager ? () => state.setShowUpload(true) : undefined}
          recipeLinks={settings.recipeLinks}
          onEditEventDate={isManager ? editEventDate : undefined}  // 🔥 הוסף את השורה הזו

          // 🔥 כל הפרופס הנדרשים לעריכה ומעקב
          onEditItem={isManager ? actions.editOrderItem : undefined}
          onEditOrderNotes={isManager ? editOrderNotes : undefined}
          onRemoveItem={isManager ? actions.removeItemFromOrder : undefined}
          onDeleteOrder={isManager ? actions.deleteOrder : undefined}
          onAddItem={isManager ? (orderId: string) => state.setAddItemFor(orderId) : undefined}
          
          // 🔥 פרופס למעקב אחר הערות
          noteOpen={modals.noteOpen}
          toggleNote={modals.toggleNote}
          
          // 🔥 מידע נוסף
          isManager={isManager}
          menuOptions={state.menuOptions}
        />
      )}

      {/* Day Modal */}
      {state.dayModalKey && (
        <DayModal
          dayKey={state.dayModalKey}
          menuOptions={state.menuOptions}
          onClose={() => state.setDayModalKey(null)}
          daysMap={daysMap}
          deleteOrder={isManager ? actions.deleteOrder : undefined}
          editOrderItem={isManager ? actions.editOrderItem : undefined}
          removeItemFromOrder={isManager ? actions.removeItemFromOrder : undefined}
          onAddItem={isManager ? (orderId: string) => state.setAddItemFor(orderId) : undefined}
          onEditOrderNotes={isManager ? editOrderNotes : undefined}
          noteOpen={modals.noteOpen}
          toggleNote={modals.toggleNote}
          isManager={isManager}
          onEditEventDate={isManager ? editEventDate : undefined}  // 🔥 הוסף את השורה הזו

          // 🔥 תיקון קריטי: העברת updateClientColor ו-getClientColor
          updateClientColor={isManager ? updateClientColor : undefined}
          getClientColor={getClientColor}
          recipeLinks={settings.recipeLinks}
        />
      )}

      {/* Add Item Modal */}
      {isManager && (
        <AddItemModal
          showFor={state.addItemFor}
          onClose={() => state.setAddItemFor(null)}
          menuOptions={state.menuOptions}
          addSearch={modals.addSearch}
          setAddSearch={modals.setAddSearch}
          onConfirm={confirmAddItem}
        />
      )}

      {/* Mapping Modal */}
      {isManager && upload.mapOpen && (
        <MappingModal
          unknowns={upload.unknowns}
          mapping={settings.mapping}
          setMapping={updateMapping}
          menuOptions={state.menuOptions}
          ignored={settings.ignored}
          setIgnored={updateIgnored}
          onClose={() => upload.setMapOpen(false)}
          onIngest={(mappingObj) => upload.doIngest(mappingObj, true)}
          hasPendingFiles={upload.hasPendingFiles}
          ingestBufferRef={upload.ingestBufferRef}
          orders={state.orders}
          persist={firebase.persist}
        />
      )}

      {/* Upload Modal */}
      {isManager && (
        <UploadModal
          show={state.showUpload}
          onClose={() => state.setShowUpload(false)}
          files={upload.files}
          setFiles={upload.setFiles}
          loading={upload.loading}
          error={upload.error}
          onRunPreview={upload.runPreviewThenIngest}
          apiBase={apiBase}
          onManualStart={() => {
            state.setShowUpload(false);
            state.setShowManualOrder(true);
          }}
        />
      )}

      {/* Confirm Review Modal */}
      {isManager && upload.reviewData && (
        <ConfirmReviewModal
          show={upload.showConfirmReview}
          onConfirm={() => {
            upload.setShowConfirmReview(false);
            upload.setShowReview(true);
          }}
          onSkip={async () => {
            upload.setShowConfirmReview(false);
            await upload.finalizeOrders(upload.reviewData!.orders, firebase.persist, state.orders);
          }}
        />
      )}

      {/* Review Modal */}
      {isManager && upload.reviewData && (
        <ReviewModal
          show={upload.showReview}
          onClose={() => {
            upload.setShowReview(false);
            upload.setReviewData(null);
          }}
          orders={upload.reviewData.orders}
          files={upload.reviewData.files}
          onSave={async (finalOrders: any) => {
            await upload.finalizeOrders(finalOrders, firebase.persist, state.orders);
          }}
        />
      )}

      {/* Date Fix Modal */}
      {isManager && (
        <DateFixModal
          show={upload.dateFixOpen}
          onClose={() => upload.setDateFixOpen(false)}
          dateFixList={upload.dateFixList}
          setDateFixList={upload.setDateFixList}
          orders={state.orders}
          persist={async (next: any) => {
            await firebase.persist(next);
            upload.setDateFixOpen(false);
          }}
        />
      )}

      {/* Settings Modal */}
      {isManager && (
        <SettingsModal
          show={modals.showSettings}
          onClose={() => modals.setShowSettings(false)}
          menuOptions={state.menuOptions}
          onUpdateMenu={async (newMenu) => {
            try {
              await setDoc(doc(db, "orderSettings", "menu"), {
                items: newMenu,
                updatedAt: serverTimestamp(),
              });
              state.setMenuOptions(newMenu);
            } catch (e) {
              console.error("שגיאה:", e);
              alert("שגיאה בשמירה");
            }
          }}
          mapping={settings.mapping}
          onUpdateMapping={updateMapping}
          ignored={settings.ignored}
          onUpdateIgnored={updateIgnored}
          categories={settings.categoryConfig || { items: {}, itemMapping: {} }}
          onUpdateCategories={async (newConfig) => {
            try {
              await setDoc(doc(db, "orderSettings", "categoryConfig"), newConfig);
              settings.updateCategoryConfig(newConfig);
            } catch (e) {
              console.error("שגיאה:", e);
              alert("שגיאה בשמירה");
            }
          }}
       recipeLinks={settings.recipeLinks}
      onUpdateRecipeLinks={(newLinks) => {
        settings.updateRecipeLinks(newLinks); // הכתיבה ל-DB תתבצע בתוך ההוק
      }}
      prices={settings.prices}
      onUpdatePrices={(newPrices: Record<string, number>) => {
        settings.updatePrices(newPrices);
      }}

        />
      )}

      {/* Manual Order Modal */}
      {isManager && (
        <ManualOrderModal
          show={state.showManualOrder}
          onClose={() => state.setShowManualOrder(false)}
          onSave={actions.saveManualOrder}
          menuOptions={state.menuOptions}
        />
      )}

      {/* Revenue Modal */}
      {isManager && (
        <RevenueModal
          show={modals.showRevenue}
          onClose={() => modals.setShowRevenue(false)}
          orders={ordersWithColors}
          prices={settings.prices}
        />
      )}
    </div>
  );
}