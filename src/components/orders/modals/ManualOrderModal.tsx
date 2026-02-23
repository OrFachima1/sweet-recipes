"use client";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { DeliveryMethod } from "@/types/orders";

interface ManualOrderItem {
  title: string;
  qty: number;
  notes: string;
}

interface ManualOrderModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (order: {
    clientName: string;
    eventDate: string;
    items: ManualOrderItem[];
    orderNotes: string;
    clientColor?: string;
    // שדות משלוח
    deliveryMethod?: DeliveryMethod;
    estimatedTime?: string;
    phone1?: string;
    phone2?: string;
    address?: string;
  }) => void;
  menuOptions: string[];
}

interface PreviousOrder {
  clientName: string;
  eventDate: string;
  items: ManualOrderItem[];
  orderNotes?: string;
  createdAt?: Date;
  clientColor?: string; // ✅ צבע מההזמנה הקודמת
}

export default function ManualOrderModal({
  show,
  onClose,
  onSave,
  menuOptions,
}: ManualOrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientColor, setClientColor] = useState("#3B82F6"); // ברירת מחדל - כחול
  const [eventDate, setEventDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [items, setItems] = useState<ManualOrderItem[]>([
    { title: "", qty: 1, notes: "" },
  ]);
  const [searchTerms, setSearchTerms] = useState<string[]>([""]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());

  // שדות משלוח
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [address, setAddress] = useState("");

  // Client autocomplete
  const [clientSearch, setClientSearch] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [previousOrders, setPreviousOrders] = useState<PreviousOrder[]>([]);

  // Load client suggestions
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientSuggestions([]);
      return;
    }

    const loadClients = async () => {
      try {
        const ordersRef = collection(db, "orders");
        // שאילתה פשוטה בלי orderBy
        const snapshot = await getDocs(ordersRef);
        
        const clients = new Set<string>();
        snapshot.docs.forEach(doc => {
          const name = doc.data().clientName;
          if (name && name.toLowerCase().includes(clientSearch.toLowerCase())) {
            clients.add(name);
          }
        });
        
        // מיון בצד הלקוח
        const sortedClients = Array.from(clients).sort().slice(0, 5);
        setClientSuggestions(sortedClients);
      } catch (e) {
        console.error("Error loading clients:", e);
      }
    };

    loadClients();
  }, [clientSearch]);

  // Load previous orders for selected client
  useEffect(() => {
    if (!clientName || clientName.length < 2) {
      setPreviousOrders([]);
      return;
    }

    const loadPreviousOrders = async () => {
      try {
        const ordersRef = collection(db, "orders");
        // שאילתה פשוטה יותר - רק where בלי orderBy
        const q = query(
          ordersRef,
          where("clientName", "==", clientName)
        );
        const snapshot = await getDocs(q);
        
        // מיון בצד הלקוח במקום ב-Firestore
        const orders: PreviousOrder[] = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              clientName: data.clientName,
              eventDate: data.eventDate,
              items: data.items || [],
              orderNotes: data.orderNotes,
              clientColor: data.clientColor, // ✅ טעינת הצבע
              createdAt: data.createdAt?.toDate() || new Date(0)
            };
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5);
        
        setPreviousOrders(orders);
      } catch (e) {
        console.error("Error loading previous orders:", e);
        setPreviousOrders([]);
      }
    };

    loadPreviousOrders();
  }, [clientName]);

  if (!show) return null;

  const addItem = () => {
    setItems([...items, { title: "", qty: 1, notes: "" }]);
    setSearchTerms([...searchTerms, ""]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
    setSearchTerms(searchTerms.filter((_, i) => i !== index));
    setOpenNotes(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const updateItem = (index: number, field: keyof ManualOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const updateSearchTerm = (index: number, value: string) => {
    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = value;
    setSearchTerms(newSearchTerms);
    setActiveDropdown(index);
  };

  const selectMenuItem = (index: number, menuItem: string) => {
    updateItem(index, "title", menuItem);
    updateSearchTerm(index, "");
    setActiveDropdown(null);
  };

  const toggleNotes = (index: number) => {
    setOpenNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const loadPreviousOrder = (order: PreviousOrder) => {
    setItems(order.items.length > 0 ? order.items : [{ title: "", qty: 1, notes: "" }]);
    setSearchTerms(order.items.map(() => ""));
    setOrderNotes(order.orderNotes || "");
    alert("✅ הזמנה קודמת נטעגה!");
  };

  const handleSave = () => {
    if (!clientName.trim()) {
      alert("יש למלא שם לקוח");
      return;
    }
    if (!eventDate) {
      alert("יש לבחור תאריך אירוע");
      return;
    }

    const validItems = items.filter(item => item.title && item.title.trim() !== "");
    
    if (validItems.length === 0) {
      alert("יש להוסיף לפחות פריט אחד מהתפריט");
      return;
    }

    const menuSet = new Set(menuOptions);
    const invalidItems = validItems.filter(item => !menuSet.has(item.title));
    
    if (invalidItems.length > 0) {
      alert(`הפריטים הבאים לא קיימים בתפריט:\n${invalidItems.map(i => i.title).join(', ')}`);
      return;
    }

    onSave({
      clientName: clientName.trim(),
      eventDate,
      items: validItems,
      orderNotes: orderNotes.trim(),
      clientColor: clientColor,
      // שדות משלוח
      deliveryMethod,
      estimatedTime: estimatedTime || undefined,
      phone1: phone1.trim() || undefined,
      phone2: phone2.trim() || undefined,
      address: address.trim() || undefined,
    });

    // Reset
    setClientName("");
    setClientSearch("");
    setClientColor("#3B82F6");
    setEventDate("");
    setOrderNotes("");
    setItems([{ title: "", qty: 1, notes: "" }]);
    setSearchTerms([""]);
    setActiveDropdown(null);
    setOpenNotes(new Set());
    // Reset delivery fields
    setDeliveryMethod("pickup");
    setEstimatedTime("");
    setPhone1("");
    setPhone2("");
    setAddress("");
  };

  const getFilteredMenu = (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 1) return [];
    const term = searchTerm.toLowerCase();
    return menuOptions
      .filter(item => item.toLowerCase().includes(term))
      .slice(0, 10);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-rose-400 to-pink-400 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <div className="font-bold text-white text-xl">הוספת לקוח חדש</div>
              <div className="text-white/80 text-sm">מלא את פרטי ההזמנה</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Client Name with Autocomplete */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              שם לקוח *
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={clientSearch || clientName}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientName(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="הכנס שם לקוח..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
                />
                
                {/* Client Dropdown */}
                {showClientDropdown && clientSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                    {clientSuggestions.map((client, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setClientName(client);
                          setClientSearch("");
                          setShowClientDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-right hover:bg-rose-50 transition-all border-b border-gray-100 last:border-0 font-medium text-gray-800"
                      >
                        👤 {client}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color Picker */}
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-medium text-gray-600">צבע</label>
                <input
                  type="color"
                  value={clientColor}
                  onChange={(e) => setClientColor(e.target.value)}
                  className="w-16 h-[44px] rounded-xl border-2 border-gray-300 cursor-pointer"
                  title="בחר צבע ללקוח"
                />
              </div>
            </div>

            {/* Previous Orders */}
            {previousOrders.length > 0 && (
              <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-xs font-semibold text-rose-800 mb-2">
                  📋 הזמנות קודמות של {clientName}:
                </div>
                <div className="space-y-1">
                  {previousOrders.map((order, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPreviousOrder(order)}
                      className="w-full text-right px-3 py-2 rounded-lg bg-white hover:bg-rose-100 transition-all text-xs flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-gray-700">
                          {order.items.length} פריטים
                        </span>
                        {order.eventDate && (
                          <span className="text-gray-500 mr-2">
                            • {new Date(order.eventDate).toLocaleDateString('he-IL')}
                          </span>
                        )}
                      </div>
                      <span className="text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        טען ←
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              תאריך אירוע *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
            />
          </div>

          {/* Delivery Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              שיטת אספקה
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeliveryMethod("pickup")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  deliveryMethod === "pickup"
                    ? "border-rose-400 bg-rose-50 text-rose-700 font-semibold"
                    : "border-gray-300 hover:border-gray-400 text-gray-600"
                }`}
              >
                <span>🏪</span>
                <span>איסוף עצמי</span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMethod("delivery")}
                className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  deliveryMethod === "delivery"
                    ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                    : "border-gray-300 hover:border-gray-400 text-gray-600"
                }`}
              >
                <span>🚚</span>
                <span>משלוח</span>
              </button>
            </div>
          </div>

          {/* Estimated Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              שעה משוערת
            </label>
            <input
              type="time"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
            />
          </div>

          {/* Phone Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                טלפון 1
              </label>
              <input
                type="tel"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder="050-0000000"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                טלפון 2
              </label>
              <input
                type="tel"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="050-0000000"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
                dir="ltr"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              כתובת למשלוח
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="רחוב, עיר..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all"
            />
          </div>

          {/* Order Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              הערות להזמנה
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="הערות כלליות..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-rose-400 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Items - Compact View */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              פריטים * ({items.filter(i => i.title).length}/{items.length})
            </label>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const searchTerm = item.title ? "" : searchTerms[idx];
                const filteredMenu = getFilteredMenu(searchTerm);
                const showDropdown = activeDropdown === idx && filteredMenu.length > 0;
                const notesOpen = openNotes.has(idx);
                
                return (
                  <div
                    key={idx}
                    className="rounded-xl bg-gradient-to-l from-rose-50 to-pink-50 border border-rose-200"
                  >
                    {/* Main Row - Compact */}
                    <div className="p-3 flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-500 w-6">{idx + 1}.</span>
                      
                      {/* Menu Item */}
                      <div className="flex-1 relative">
                        {item.title ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 rounded-lg border border-rose-300 bg-white font-medium text-gray-800 text-sm">
                              {item.title}
                            </div>
                            <button
                              onClick={() => {
                                updateItem(idx, "title", "");
                                updateSearchTerm(idx, "");
                              }}
                              className="px-2 py-1 rounded text-xs bg-gray-200 hover:bg-gray-300 text-gray-700"
                            >
                              שנה
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={searchTerms[idx]}
                              onChange={(e) => updateSearchTerm(idx, e.target.value)}
                              onFocus={() => setActiveDropdown(idx)}
                              placeholder="חפש מנה..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-rose-400 focus:outline-none text-sm"
                            />
                            
                            {showDropdown && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                                {filteredMenu.map((menuItem, menuIdx) => (
                                  <button
                                    key={menuIdx}
                                    onClick={() => selectMenuItem(idx, menuItem)}
                                    className="w-full px-3 py-2 text-right hover:bg-rose-50 transition-all text-sm border-b border-gray-100 last:border-0"
                                  >
                                    {menuItem}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Quantity */}
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                        className="w-16 px-2 py-2 rounded-lg border border-gray-300 focus:border-rose-400 focus:outline-none text-sm text-center"
                      />

                      {/* Notes Toggle */}
                      <button
                        onClick={() => toggleNotes(idx)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          notesOpen || item.notes 
                            ? "bg-rose-500 text-white" 
                            : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                        }`}
                        title="הערות"
                      >
                        💬
                      </button>

                      {/* Remove */}
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Notes Field - Expandable */}
                    {notesOpen && (
                      <div className="px-3 pb-3">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateItem(idx, "notes", e.target.value)}
                          placeholder="הערות לפריט..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-rose-400 focus:outline-none text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Item Button - Bottom */}
            <button
              onClick={addItem}
              className="w-full mt-3 px-4 py-3 rounded-xl bg-gradient-to-l from-rose-100 to-pink-100 hover:from-rose-200 hover:to-pink-200 text-rose-700 font-semibold transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl">➕</span>
              <span>הוסף פריט</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-rose-500 to-pink-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <span>💾</span>
            <span>שמור הזמנה</span>
          </button>
        </div>
      </div>
    </div>
  );
}