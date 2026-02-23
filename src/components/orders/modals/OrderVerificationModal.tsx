'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { IngestJsonOrder } from '@/types/orders';

interface OrderVerificationModalProps {
  order: IngestJsonOrder;
  dishAccessories: Record<string, string[]>;
  onClose: () => void;
}

interface CheckedState {
  [key: string]: boolean;
}

// מידע על נלווה מאוחד
interface AggregatedAccessory {
  name: string;
  dishes: string[]; // שמות המנות שדורשות את הנלווה
  totalQty: number; // כמות כוללת (סכום qty של כל המנות)
}

export default function OrderVerificationModal({
  order,
  dishAccessories,
  onClose,
}: OrderVerificationModalProps) {
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});
  const [showAccessoryInfo, setShowAccessoryInfo] = useState<string | null>(null);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Build aggregated accessories - איחוד נלווים מכל המנות
  const aggregatedAccessories = useMemo(() => {
    const accessoryMap: Record<string, AggregatedAccessory> = {};

    order.items.forEach((item) => {
      const accessories = dishAccessories[item.title] || [];
      const qty = item.qty || 1;

      accessories.forEach((acc) => {
        if (!accessoryMap[acc]) {
          accessoryMap[acc] = {
            name: acc,
            dishes: [],
            totalQty: 0,
          };
        }
        accessoryMap[acc].dishes.push(item.title);
        accessoryMap[acc].totalQty += qty;
      });
    });

    return Object.values(accessoryMap);
  }, [order.items, dishAccessories]);

  // Calculate total checkable items (items only, accessories separate)
  const totalItems = useMemo(() => {
    let count = 0;
    order.items.forEach((item) => {
      count += item.qty || 1;
    });
    return count;
  }, [order.items]);

  const totalCheckable = totalItems + aggregatedAccessories.length;

  // Calculate checked count
  const checkedCount = useMemo(() => {
    return Object.values(checkedItems).filter(Boolean).length;
  }, [checkedItems]);

  const progress = totalCheckable > 0 ? (checkedCount / totalCheckable) * 100 : 0;
  const isComplete = checkedCount === totalCheckable && totalCheckable > 0;

  // Toggle item checkbox
  const toggleItem = (key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Check all items
  const checkAll = () => {
    const allKeys: CheckedState = {};
    order.items.forEach((item, idx) => {
      const qty = item.qty || 1;
      for (let q = 0; q < qty; q++) {
        allKeys[`item-${idx}-${q}`] = true;
      }
    });
    aggregatedAccessories.forEach((acc, accIdx) => {
      allKeys[`acc-${accIdx}`] = true;
    });
    setCheckedItems(allKeys);
  };

  // Uncheck all
  const uncheckAll = () => {
    setCheckedItems({});
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 text-white"
            style={{ backgroundColor: order.clientColor || '#73a1ecff' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold drop-shadow">{order.clientName}</h2>
                <p className="text-white/80 text-sm">וידוא הזמנה</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white text-2xl"
                title="סגור (ESC)"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">התקדמות</span>
              <span className="text-sm font-bold text-gray-700">
                {checkedCount} / {totalCheckable}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isComplete ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex gap-2">
            <button
              onClick={checkAll}
              className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
            >
              סמן הכל
            </button>
            <button
              onClick={uncheckAll}
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
              נקה הכל
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" dir="rtl">
            {/* Items Section */}
            <div>
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">📦</span>
                פריטים ({totalItems})
              </h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => {
                  const qty = item.qty || 1;

                  return (
                    <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Item Header */}
                      <div className="bg-gray-100 px-4 py-2 font-medium text-gray-800 flex items-center justify-between">
                        <span>{item.title}</span>
                        <span className="text-sm text-gray-500">
                          {qty} {item.unit || 'יח׳'}
                        </span>
                      </div>

                      {/* Per-quantity checklist */}
                      <div className="divide-y divide-gray-100">
                        {Array.from({ length: qty }).map((_, qIdx) => (
                          <div key={qIdx} className="px-4 py-2">
                            {/* Main item checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer py-1">
                              <input
                                type="checkbox"
                                checked={!!checkedItems[`item-${idx}-${qIdx}`]}
                                onChange={() => toggleItem(`item-${idx}-${qIdx}`)}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span
                                className={`font-medium ${
                                  checkedItems[`item-${idx}-${qIdx}`]
                                    ? 'line-through text-gray-400'
                                    : 'text-gray-700'
                                }`}
                              >
                                {item.title} {qty > 1 && `#${qIdx + 1}`}
                              </span>
                            </label>

                            {/* Item notes */}
                            {item.notes && qIdx === 0 && (
                              <div className="mr-8 mt-1 text-sm bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accessories Section - aggregated */}
            {aggregatedAccessories.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="text-lg">🧰</span>
                  נלווים למשלוח ({aggregatedAccessories.length})
                </h3>
                <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50">
                  <div className="divide-y divide-green-100">
                    {aggregatedAccessories.map((acc, accIdx) => (
                      <div key={accIdx} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={!!checkedItems[`acc-${accIdx}`]}
                            onChange={() => toggleItem(`acc-${accIdx}`)}
                            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span
                            className={`flex-1 font-medium ${
                              checkedItems[`acc-${accIdx}`]
                                ? 'line-through text-gray-400'
                                : 'text-gray-700'
                            }`}
                          >
                            {acc.name}
                          </span>
                          {/* Info button */}
                          <button
                            onClick={() => setShowAccessoryInfo(
                              showAccessoryInfo === acc.name ? null : acc.name
                            )}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors ${
                              showAccessoryInfo === acc.name
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                            title="הצג מנות קשורות"
                          >
                            ?
                          </button>
                        </div>
                        {/* Expanded info - which dishes need this accessory */}
                        {showAccessoryInfo === acc.name && (
                          <div className="mt-2 mr-8 text-sm bg-white border border-gray-200 rounded-lg p-3">
                            <p className="text-gray-500 mb-2">נדרש עבור:</p>
                            <ul className="space-y-1">
                              {acc.dishes.map((dish, i) => {
                                const item = order.items.find(it => it.title === dish);
                                const qty = item?.qty || 1;
                                return (
                                  <li key={i} className="flex items-center gap-2 text-gray-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    {dish}
                                    {qty > 1 && <span className="text-gray-400">({qty} יח׳)</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {isComplete ? (
              <div className="text-center">
                <div className="text-4xl mb-2">&#x2705;</div>
                <p className="text-lg font-bold text-green-600">ההזמנה מוכנה למשלוח!</p>
                <button
                  onClick={onClose}
                  className="mt-3 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                >
                  סגור
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>סמן את כל הפריטים לסיום</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
