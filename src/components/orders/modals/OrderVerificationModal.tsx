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

  const clientColor = order.clientColor || '#8B5CF6';

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gradient-to-br from-purple-50 via-white to-pink-50 w-full max-w-2xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto relative border border-purple-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - styled like OrderCard */}
          <div
            className="px-6 py-5 text-white relative overflow-hidden"
            style={{ backgroundColor: clientColor }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/10 rounded-full" />

            <div className="relative flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold drop-shadow-lg">{order.clientName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-medium">
                    וידוא הזמנה
                  </span>
                  {order.estimatedTime && (
                    <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                      {order.estimatedTime}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-2xl backdrop-blur"
                title="סגור (ESC)"
              >
                &times;
              </button>
            </div>
          </div>

          {/* Progress Bar - enhanced */}
          <div className="px-6 py-4 bg-white/80 border-b border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">התקדמות</span>
              <span className="text-sm font-bold" style={{ color: clientColor }}>
                {checkedCount} / {totalCheckable}
              </span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${progress}%`,
                  backgroundColor: isComplete ? '#22c55e' : clientColor
                }}
              />
            </div>
            {isComplete && (
              <p className="text-center text-green-600 font-medium mt-2 animate-pulse">
                הכל מוכן!
              </p>
            )}
          </div>

          {/* Actions - styled buttons */}
          <div className="px-6 py-3 bg-white/60 border-b border-purple-100 flex gap-3">
            <button
              onClick={checkAll}
              className="flex-1 py-2.5 text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              סמן הכל
            </button>
            <button
              onClick={uncheckAll}
              className="flex-1 py-2.5 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-all"
            >
              נקה הכל
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" dir="rtl">
            {/* Items Section */}
            <div>
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-lg">
                <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  📦
                </span>
                פריטים ({totalItems})
              </h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => {
                  const qty = item.qty || 1;
                  const allChecked = Array.from({ length: qty }).every(
                    (_, qIdx) => checkedItems[`item-${idx}-${qIdx}`]
                  );

                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl overflow-hidden transition-all duration-300 ${
                        allChecked
                          ? 'bg-green-50 border-2 border-green-200'
                          : 'bg-white border-2 border-purple-100 shadow-sm'
                      }`}
                    >
                      {/* Item Header */}
                      <div
                        className="px-4 py-3 font-medium flex items-center justify-between"
                        style={{
                          backgroundColor: allChecked ? '#dcfce7' : `${clientColor}15`
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {allChecked && (
                            <span className="text-green-600 text-lg">✓</span>
                          )}
                          <span className={allChecked ? 'text-green-700' : 'text-gray-800'}>
                            {item.title}
                          </span>
                        </div>
                        <span className={`text-sm px-3 py-1 rounded-full ${
                          allChecked
                            ? 'bg-green-200 text-green-700'
                            : 'bg-white/80 text-gray-600'
                        }`}>
                          {qty} {item.unit || 'יח׳'}
                        </span>
                      </div>

                      {/* Per-quantity checklist */}
                      <div className="divide-y divide-gray-100">
                        {Array.from({ length: qty }).map((_, qIdx) => (
                          <div key={qIdx} className="px-4 py-3">
                            {/* Main item checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={!!checkedItems[`item-${idx}-${qIdx}`]}
                                  onChange={() => toggleItem(`item-${idx}-${qIdx}`)}
                                  className="sr-only"
                                />
                                <div
                                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    checkedItems[`item-${idx}-${qIdx}`]
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300 hover:border-purple-400'
                                  }`}
                                >
                                  {checkedItems[`item-${idx}-${qIdx}`] && (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`font-medium transition-all ${
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
                              <div className="mr-10 mt-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-800">
                                <span className="font-medium">הערה:</span> {item.notes}
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
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-lg">
                  <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    🧰
                  </span>
                  נלווים למשלוח ({aggregatedAccessories.length})
                </h3>
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
                  <div className="divide-y divide-green-100">
                    {aggregatedAccessories.map((acc, accIdx) => (
                      <div key={accIdx} className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {/* Custom checkbox */}
                          <label className="cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!checkedItems[`acc-${accIdx}`]}
                              onChange={() => toggleItem(`acc-${accIdx}`)}
                              className="sr-only"
                            />
                            <div
                              className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                                checkedItems[`acc-${accIdx}`]
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-green-400 hover:border-green-500'
                              }`}
                            >
                              {checkedItems[`acc-${accIdx}`] && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </label>

                          <span
                            className={`flex-1 font-medium flex items-center gap-2 ${
                              checkedItems[`acc-${accIdx}`]
                                ? 'line-through text-gray-400'
                                : 'text-gray-700'
                            }`}
                          >
                            {acc.totalQty > 1 && (
                              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-green-600 text-white text-sm font-bold">
                                {acc.totalQty}
                              </span>
                            )}
                            {acc.name}
                          </span>

                          {/* Info button */}
                          <button
                            onClick={() => setShowAccessoryInfo(
                              showAccessoryInfo === acc.name ? null : acc.name
                            )}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                              showAccessoryInfo === acc.name
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-white text-gray-500 hover:bg-gray-100 shadow'
                            }`}
                            title="הצג מנות קשורות"
                          >
                            ?
                          </button>
                        </div>

                        {/* Expanded info - which dishes need this accessory */}
                        {showAccessoryInfo === acc.name && (
                          <div className="mt-3 mr-10 text-sm bg-white rounded-xl p-4 shadow-inner border border-gray-100">
                            <p className="text-gray-500 mb-2 font-medium">נדרש עבור:</p>
                            <ul className="space-y-2">
                              {acc.dishes.map((dish, i) => {
                                const item = order.items.find(it => it.title === dish);
                                const qty = item?.qty || 1;
                                return (
                                  <li key={i} className="flex items-center gap-2 text-gray-700">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="font-medium">{dish}</span>
                                    {qty > 1 && (
                                      <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                        {qty} יח׳
                                      </span>
                                    )}
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
          <div className="px-6 py-5 border-t border-purple-100 bg-white/80">
            {isComplete ? (
              <div className="text-center">
                <div className="text-5xl mb-3 animate-bounce">🎉</div>
                <p className="text-xl font-bold text-green-600 mb-4">ההזמנה מוכנה למשלוח!</p>
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl text-lg"
                >
                  סיום
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 mb-2">סמן את כל הפריטים לסיום</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <span>נותרו</span>
                  <span className="font-bold text-purple-600">{totalCheckable - checkedCount}</span>
                  <span>פריטים</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
