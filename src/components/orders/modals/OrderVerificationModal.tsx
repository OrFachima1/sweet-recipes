'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { IngestJsonOrder } from '@/types/orders';

interface CategoryConfig {
  items: Record<string, { color: string; order: number }>;
  itemMapping: Record<string, string>;
}

interface OrderVerificationModalProps {
  order: IngestJsonOrder;
  dishAccessories: Record<string, string[]>;
  categoryConfig?: CategoryConfig;
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
  categoryConfig,
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

  // Helper functions for categories - local instead of global
  const getItemCategory = (itemTitle: string): string => {
    return categoryConfig?.itemMapping?.[itemTitle] || "אחר";
  };

  const getCategoryColor = (category: string): string => {
    return categoryConfig?.items?.[category]?.color || "#E5E7EB";
  };

  const getSortedCategories = (): string[] => {
    if (!categoryConfig) return ["אחר"];
    return Object.entries(categoryConfig.items)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([name]) => name)
      .concat(["אחר"]);
  };

  // Group items by category
  const groupedItems = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (order.items || []).forEach(item => {
      const category = getItemCategory(item.title);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    return grouped;
  }, [order.items, categoryConfig]);

  // Get sorted category order
  const categoryOrder = useMemo(() => {
    return getSortedCategories().filter(cat => groupedItems[cat] && groupedItems[cat].length > 0);
  }, [groupedItems, categoryConfig]);

  // Build aggregated accessories - איחוד נלווים מכל המנות
  const aggregatedAccessories = useMemo(() => {
    const accessoryMap: Record<string, AggregatedAccessory> = {};

    // בדיקה אם יש לפחות מנה אחת שמתחילה ב"סלט"
    const saladItems = order.items.filter(item =>
      item.title.startsWith('סלט')
    );
    const hasSalad = saladItems.length > 0;

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

    // 🥗 אם יש סלט - הוסף מגש אלומיניום וכפפות
    if (hasSalad) {
      const saladDishNames = saladItems.map(item => item.title);

      if (!accessoryMap['מגש אלומיניום']) {
        accessoryMap['מגש אלומיניום'] = {
          name: 'מגש אלומיניום',
          dishes: saladDishNames,
          totalQty: 1,
        };
      }

      if (!accessoryMap['כפפות']) {
        accessoryMap['כפפות'] = {
          name: 'כפפות',
          dishes: saladDishNames,
          totalQty: 1,
        };
      }
    }

    return Object.values(accessoryMap);
  }, [order.items, dishAccessories]);

  // Calculate total checkable items (items + accessories)
  const totalCheckable = order.items.length + aggregatedAccessories.length;

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
    order.items.forEach((_, idx) => {
      allKeys[`item-${idx}`] = true;
    });
    aggregatedAccessories.forEach((_, accIdx) => {
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
          className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto border-2 border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - styled like OrderCard */}
          <div
            className="px-5 py-4 text-white flex-shrink-0"
            style={{ backgroundColor: clientColor }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{order.clientName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-medium">
                    וידוא הזמנה
                  </span>
                  {order.estimatedTime && (
                    <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                      ⏰ {order.estimatedTime}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-2xl"
                title="סגור (ESC)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">התקדמות</span>
              <span className="text-sm font-bold" style={{ color: clientColor }}>
                {checkedCount} / {totalCheckable}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${progress}%`,
                  backgroundColor: isComplete ? '#22c55e' : clientColor
                }}
              />
            </div>
            {isComplete && (
              <p className="text-center text-green-600 font-medium mt-2 text-sm">
                ✓ הכל מוכן!
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 flex gap-2 flex-shrink-0">
            <button
              onClick={checkAll}
              className="flex-1 py-2 text-sm font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
            >
              סמן הכל
            </button>
            <button
              onClick={uncheckAll}
              className="flex-1 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all"
            >
              נקה הכל
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4" dir="rtl">
            {/* Items Section - By Category */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-base">
                📦 פריטים ({order.items.length})
              </h3>

              <div className="space-y-2">
                {categoryOrder.map(category => {
                  const categoryItems = groupedItems[category];
                  if (!categoryItems || categoryItems.length === 0) return null;

                  const categoryColor = getCategoryColor(category);

                  return (
                    <div key={category} className="flex gap-2">
                      {/* Category Label */}
                      <div
                        className="flex-shrink-0 w-16 rounded-lg flex items-center justify-center text-xs font-bold text-gray-700 px-2 py-1"
                        style={{
                          backgroundColor: categoryColor,
                          writingMode: categoryItems.length > 3 ? 'vertical-rl' : 'horizontal-tb',
                          textOrientation: categoryItems.length > 3 ? 'mixed' : 'initial'
                        }}
                      >
                        {category}
                      </div>

                      {/* Items in Category */}
                      <div className="flex-1 space-y-1">
                        {categoryItems.map((item: any) => {
                          const originalIndex = order.items.indexOf(item);
                          if (originalIndex === -1) return null;

                          const isChecked = checkedItems[`item-${originalIndex}`];
                          const qty = item.qty || 1;

                          return (
                            <div
                              key={originalIndex}
                              className={`rounded-lg p-2.5 border transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-green-50 border-green-300'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              style={{
                                backgroundColor: isChecked ? undefined : `${categoryColor}15`,
                                borderColor: isChecked ? undefined : categoryColor
                              }}
                              onClick={() => toggleItem(`item-${originalIndex}`)}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <div
                                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                    isChecked
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {isChecked && (
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>

                                {/* Item Title */}
                                <span className={`flex-1 font-medium text-sm ${
                                  isChecked ? 'line-through text-gray-400' : 'text-gray-700'
                                }`}>
                                  {item.title}
                                </span>

                                {/* Quantity Badge */}
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                  isChecked
                                    ? 'bg-green-200 text-green-700'
                                    : 'bg-white text-gray-600'
                                }`}>
                                  {qty} {item.unit || 'יח׳'}
                                </span>
                              </div>

                              {/* Item Notes */}
                              {item.notes && (
                                <div className="mt-2 mr-9 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-amber-800">
                                  <span className="font-medium">הערה:</span> {item.notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accessories Section - aggregated */}
            {aggregatedAccessories.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-base">
                  🧰 נלווים למשלוח ({aggregatedAccessories.length})
                </h3>

                <div className="rounded-xl overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-green-200">
                  <div className="divide-y divide-green-100">
                    {aggregatedAccessories.map((acc, accIdx) => {
                      const isChecked = checkedItems[`acc-${accIdx}`];

                      return (
                        <div
                          key={accIdx}
                          className={`px-4 py-3 cursor-pointer transition-all ${
                            isChecked ? 'bg-green-100/50' : 'hover:bg-green-50'
                          }`}
                          onClick={() => toggleItem(`acc-${accIdx}`)}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox */}
                            <div
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                isChecked
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-green-400'
                              }`}
                            >
                              {isChecked && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Quantity Badge */}
                            {acc.totalQty > 1 && (
                              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-green-600 text-white text-xs font-bold">
                                {acc.totalQty}
                              </span>
                            )}

                            {/* Accessory Name */}
                            <span className={`flex-1 font-medium text-sm ${
                              isChecked ? 'line-through text-gray-400' : 'text-gray-700'
                            }`}>
                              {acc.name}
                            </span>

                            {/* Info button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAccessoryInfo(
                                  showAccessoryInfo === acc.name ? null : acc.name
                                );
                              }}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                showAccessoryInfo === acc.name
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-white text-gray-500 hover:bg-gray-100 shadow-sm'
                              }`}
                              title="הצג מנות קשורות"
                            >
                              ?
                            </button>
                          </div>

                          {/* Expanded info - which dishes need this accessory */}
                          {showAccessoryInfo === acc.name && (
                            <div className="mt-2 mr-9 text-xs bg-white rounded-lg p-3 shadow-inner border border-gray-100">
                              <p className="text-gray-500 mb-2 font-medium">נדרש עבור:</p>
                              <ul className="space-y-1.5">
                                {acc.dishes.map((dish, i) => {
                                  const item = order.items.find(it => it.title === dish);
                                  const qty = item?.qty || 1;
                                  return (
                                    <li key={i} className="flex items-center gap-2 text-gray-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                      <span className="font-medium">{dish}</span>
                                      {qty > 1 && (
                                        <span className="text-gray-400 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
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
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {isComplete ? (
              <div className="text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-lg font-bold text-green-600 mb-3">ההזמנה מוכנה למשלוח!</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg text-base"
                >
                  סיום
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 mb-1 text-sm">סמן את כל הפריטים לסיום</p>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-400">
                  <span>נותרו</span>
                  <span className="font-bold" style={{ color: clientColor }}>{totalCheckable - checkedCount}</span>
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
