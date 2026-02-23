'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { IngestJsonOrder, IngestJsonOrderItem } from '@/types/orders';

interface OrderVerificationModalProps {
  order: IngestJsonOrder;
  dishAccessories: Record<string, string[]>;
  onClose: () => void;
}

interface CheckedState {
  [key: string]: boolean;
}

export default function OrderVerificationModal({
  order,
  dishAccessories,
  onClose,
}: OrderVerificationModalProps) {
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Build items with accessories
  const itemsWithAccessories = useMemo(() => {
    return order.items.map((item, idx) => {
      const accessories = dishAccessories[item.title] || [];
      return {
        item,
        idx,
        accessories,
      };
    });
  }, [order.items, dishAccessories]);

  // Calculate total checkable items
  const totalCheckable = useMemo(() => {
    let count = 0;
    itemsWithAccessories.forEach(({ item, accessories }) => {
      count += item.qty || 1; // Each quantity counts
      count += accessories.length * (item.qty || 1); // Accessories per quantity
    });
    return count;
  }, [itemsWithAccessories]);

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
    itemsWithAccessories.forEach(({ item, idx, accessories }) => {
      const qty = item.qty || 1;
      for (let q = 0; q < qty; q++) {
        allKeys[`item-${idx}-${q}`] = true;
        accessories.forEach((acc, accIdx) => {
          allKeys[`acc-${idx}-${q}-${accIdx}`] = true;
        });
      }
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

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" dir="rtl">
            {itemsWithAccessories.map(({ item, idx, accessories }) => {
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
                            {item.title} #{qIdx + 1}
                          </span>
                        </label>

                        {/* Item notes */}
                        {item.notes && qIdx === 0 && (
                          <div className="mr-8 mt-1 text-sm bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                            {item.notes}
                          </div>
                        )}

                        {/* Accessories */}
                        {accessories.length > 0 && (
                          <div className="mr-8 mt-2 space-y-1">
                            {accessories.map((acc, accIdx) => (
                              <label
                                key={accIdx}
                                className="flex items-center gap-3 cursor-pointer py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!checkedItems[`acc-${idx}-${qIdx}-${accIdx}`]}
                                  onChange={() => toggleItem(`acc-${idx}-${qIdx}-${accIdx}`)}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span
                                  className={`text-sm ${
                                    checkedItems[`acc-${idx}-${qIdx}-${accIdx}`]
                                      ? 'line-through text-gray-400'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  {acc}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
