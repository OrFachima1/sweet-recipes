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
import { useClients } from "@/hooks/useClients";
import { useUser, useRole } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// ===== Custom Hooks =====
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
  const { getClientColor, ensureClient, updateClientColor } = useClients(user?.uid);

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
    for (const o of state.orders) {
      const day = o?.eventDate ? fmtYMD(new Date(o.eventDate)) : null;
      if (!day) continue;
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(o);
    }
    return m;
  }, [state.orders]);

  // ===== Add Item =====
  const confirmAddItem = useCallback((title: string) => {
    if (!isManager) {
      alert("אין לך הרשאה לערוך הזמנות");
      return;
    }
    if (!state.addItemFor || !title) return;

    const next = state.orders.map(o =>
      o.__id !== state.addItemFor
        ? o
        : { ...o, items: [...o.items, { title, qty: 1, unit: "יח'", notes: "" }] }
    );
    firebase.persist(next);
    state.setAddItemFor(null);
  }, [isManager, state.addItemFor, state.orders, firebase, state]);

  // ===== Update Mapping & Ignored =====
  const updateMapping = useCallback((newMapping: Record<string, string>) => {
    settings.updateMapping(newMapping);
    firebase.saveSettings(newMapping, settings.ignored);
  }, [settings, firebase]);

  const updateIgnored = useCallback((newIgnored: string[]) => {
    settings.updateIgnored(newIgnored);
    firebase.saveSettings(settings.mapping, newIgnored);
  }, [settings, firebase]);

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
// ===== Edit Order Notes =====
const editOrderNotes = (orderId: string, notes: string) => {
  if (!isManager) {
    alert("אין לך הרשאה לערוך הזמנות");
    return;
  }
  
  console.log('🔍 Before update:', state.orders.find(o => o.__id === orderId));
  
  const next = state.orders.map(o =>
    o.__id !== orderId ? o : { ...o, orderNotes: notes }
  );
  
  console.log('🔍 After update:', next.find(o => o.__id === orderId));
  console.log('🔍 Total orders before:', state.orders.length);
  console.log('🔍 Total orders after:', next.length);
  
  firebase.persist(next);
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* Header - שלום + הגדרות */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-2xl font-bold text-gray-900">
          שלום {displayName || user?.email || 'עובד'} {isManager && <span className="text-blue-600">(מנהל)</span>}
        </div>
        <button
          onClick={() => modals.setShowSettings(true)}
          className="px-4 py-2 rounded-lg bg-white border-2 border-gray-300 hover:border-blue-500 transition-all shadow-sm flex items-center gap-2"
        >
          <span>⚙️</span>
          <span>הגדרות</span>
        </button>
      </div>

      {navigation.mainView === "calendar" && (
        <Toolbar
          viewMode={state.viewMode}
          onChangeViewMode={state.setViewMode}
          picker={navigation.picker}
          onPickerChange={navigation.setPicker}
        />
      )}
        
      {/* Main View Toggle */}
      <ViewToggle
        currentView={navigation.mainView}
        onToggle={navigation.setMainView}
      />

      {/* Calendar Views */}
      {navigation.mainView === "calendar" && (
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
            />
          )}

          {state.viewMode === "day" && (
            <div className="rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-gray-200">
              <div className="bg-red-100 px-6 py-6">
                <div className="flex items-center justify-between mb-3">
                  {isManager && (
                    <button
                      onClick={() => state.setShowUpload(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md font-medium"
                    >
                      <span className="text-xl leading-none">＋</span>
                      <span>הוסף לקוח</span>
                    </button>
                  )}

                  <button
                    onClick={navigation.goToday}
                    className="text-xs px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/80 transition-all font-medium text-gray-900 shadow-sm"
                  >
                    היום
                  </button>
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button onClick={navigation.prev} className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900" title="יום קודם">
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

                  <button onClick={navigation.next} className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/70 transition-all flex items-center justify-center text-4xl text-gray-900" title="יום הבא">
                    ›
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-white to-gray-50">
                <DayOrdersList
                  dayKey={dayKey}
                  daysMap={daysMap}
                  deleteOrder={isManager ? actions.deleteOrder : undefined}
                  editOrderItem={isManager ? actions.editOrderItem : undefined}
                  removeItemFromOrder={isManager ? actions.removeItemFromOrder : undefined}
                  onAddItem={isManager ? (orderId: string) => state.setAddItemFor(orderId) : undefined}
                  onEditOrderNotes={isManager ? editOrderNotes : undefined} // 🔥 הוסף שורה זו!
                  noteOpen={modals.noteOpen}
                  toggleNote={modals.toggleNote}
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
      )}

      {/* Clients View */}
      {navigation.mainView === "clients" && (
       <ClientsView
        orders={state.orders}
        onAddClient={isManager ? () => state.setShowUpload(true) : undefined}
        recipeLinks={settings.recipeLinks}
        onEditItem={isManager ? actions.editOrderItem : undefined} // 🔥 הוסף שורה זו!
        onEditOrderNotes={isManager ? editOrderNotes : undefined} // 🔥 הוסף שורה זו!
      />
      )}

      {/* Day Modal */}
      {state.dayModalKey && (
        <DayModal
          dayKey={state.dayModalKey}
          onClose={() => state.setDayModalKey(null)}
          daysMap={daysMap}
          deleteOrder={isManager ? actions.deleteOrder : undefined}
          editOrderItem={isManager ? actions.editOrderItem : undefined}
          removeItemFromOrder={isManager ? actions.removeItemFromOrder : undefined}
          onAddItem={isManager ? (orderId: string) => state.setAddItemFor(orderId) : undefined}
          onEditOrderNotes={isManager ? editOrderNotes : undefined} // 🔥 הוסף שורה זו!
          noteOpen={modals.noteOpen}
          toggleNote={modals.toggleNote}
          isManager={isManager}
          updateClientColor={updateClientColor}
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
    </div>
  );
}