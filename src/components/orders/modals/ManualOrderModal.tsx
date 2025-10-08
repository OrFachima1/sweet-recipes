"use client";
import React, { useState } from "react";

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
  }) => void;
  menuOptions: string[];
}

export default function ManualOrderModal({
  show,
  onClose,
  onSave,
  menuOptions,
}: ManualOrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [items, setItems] = useState<ManualOrderItem[]>([
    { title: "", qty: 1, notes: "" },
  ]);
  const [searchTerms, setSearchTerms] = useState<string[]>([""]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  if (!show) return null;

  const addItem = () => {
    setItems([...items, { title: "", qty: 1, notes: "" }]);
    setSearchTerms([...searchTerms, ""]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
    setSearchTerms(searchTerms.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ManualOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    
    console.log(`📝 Updated item ${index}:`, newItems[index]);
  };

  const updateSearchTerm = (index: number, value: string) => {
    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = value;
    setSearchTerms(newSearchTerms);
    setActiveDropdown(index);
    
    console.log(`🔍 Search term ${index}:`, value);
  };

  const selectMenuItem = (index: number, menuItem: string) => {
    console.log(`✅ Selected: "${menuItem}" for item ${index}`);
    
    updateItem(index, "title", menuItem);
    updateSearchTerm(index, "");
    setActiveDropdown(null);
  };

  const handleSave = () => {
    console.log("💾 Attempting to save...");
    console.log("Items:", items);
    
    if (!clientName.trim()) {
      alert("יש למלא שם לקוח");
      return;
    }
    if (!eventDate) {
      alert("יש לבחור תאריך אירוע");
      return;
    }

    const validItems = items.filter(item => {
      const isValid = item.title && item.title.trim() !== "";
      console.log(`Item "${item.title}" valid?`, isValid);
      return isValid;
    });
    
    console.log("Valid items:", validItems);
    
    if (validItems.length === 0) {
      alert("יש להוסיף לפחות פריט אחד מהתפריט");
      return;
    }

    // בדיקה שכל הפריטים מהתפריט
    const menuSet = new Set(menuOptions);
    const invalidItems = validItems.filter(item => !menuSet.has(item.title));
    
    if (invalidItems.length > 0) {
      alert(`הפריטים הבאים לא קיימים בתפריט:\n${invalidItems.map(i => i.title).join(', ')}`);
      return;
    }

    console.log("✅ Saving order with items:", validItems);
    
    onSave({
      clientName: clientName.trim(),
      eventDate,
      items: validItems,
      orderNotes: orderNotes.trim(),
    });

    // Reset form
    setClientName("");
    setEventDate("");
    setOrderNotes("");
    setItems([{ title: "", qty: 1, notes: "" }]);
    setSearchTerms([""]);
    setActiveDropdown(null);
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
        <div className="bg-gradient-to-l from-emerald-500 to-teal-500 px-6 py-5 flex items-center justify-between flex-shrink-0">
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
          {/* Client Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              שם לקוח *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="הכנס שם לקוח..."
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all"
            />
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
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all"
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
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                פריטים *
              </label>
              <button
                onClick={addItem}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium text-sm transition-all"
              >
                + הוסף פריט
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const searchTerm = item.title ? "" : searchTerms[idx];
                const filteredMenu = getFilteredMenu(searchTerm);
                const showDropdown = activeDropdown === idx && filteredMenu.length > 0;
                
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-gradient-to-l from-gray-50 to-gray-100 border border-gray-200 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-bold text-gray-600 mt-2">{idx + 1}.</span>
                      
                      <div className="flex-1 space-y-3">
                        {/* Menu Item Selection */}
                        <div className="relative">
                          {item.title ? (
                            // Selected item - show as readonly with edit button
                            <div className="flex items-center gap-2">
                              <div className="flex-1 px-4 py-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 font-medium text-gray-800">
                                ✓ {item.title}
                              </div>
                              <button
                                onClick={() => {
                                  updateItem(idx, "title", "");
                                  updateSearchTerm(idx, "");
                                }}
                                className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm transition-all"
                              >
                                שנה
                              </button>
                            </div>
                          ) : (
                            // Search mode
                            <>
                              <input
                                type="text"
                                value={searchTerms[idx]}
                                onChange={(e) => updateSearchTerm(idx, e.target.value)}
                                onFocus={() => setActiveDropdown(idx)}
                                placeholder="חפש מנה מהתפריט..."
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all"
                              />
                              
                              {/* Dropdown */}
                              {showDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                                  {filteredMenu.map((menuItem, menuIdx) => (
                                    <button
                                      key={menuIdx}
                                      onClick={() => selectMenuItem(idx, menuItem)}
                                      className="w-full px-4 py-3 text-right hover:bg-emerald-50 transition-all border-b border-gray-100 last:border-0"
                                    >
                                      <span className="font-medium text-gray-800">{menuItem}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            כמות
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all"
                          />
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            הערות לפריט
                          </label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItem(idx, "notes", e.target.value)}
                            placeholder="הערות..."
                            className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-emerald-500 focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all flex-shrink-0 mt-2"
                          title="הסר פריט"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Debug Info */}
            {items.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                פריטים תקינים: {items.filter(i => i.title && i.title.trim()).length} / {items.length}
              </div>
            )}
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
            className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 text-white font-bold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <span>💾</span>
            <span>שמור הזמנה</span>
          </button>
        </div>
      </div>
    </div>
  );
}