'use client';

import { IngestJsonOrder } from '@/types/orders';

interface DeliveryCardProps {
  order: IngestJsonOrder;
  onVerify?: () => void;
}

export default function DeliveryCard({ order, onVerify }: DeliveryCardProps) {
  const totalItems = order.items.reduce((sum, item) => sum + (item.qty || 1), 0);

  return (
    <div
      className="rounded-2xl shadow-lg overflow-hidden border border-gray-100"
      style={{ backgroundColor: order.clientColor || '#73a1ecff' }}
    >
      {/* Header */}
      <div className="px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold drop-shadow">{order.clientName}</h3>
          {order.estimatedTime && (
            <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-medium">
              {order.estimatedTime}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white px-4 py-3 space-y-3">
        {/* Item count */}
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span>{totalItems} פריטים</span>
        </div>

        {/* Phones */}
        <div className="space-y-1">
          {order.phone1 && (
            <a
              href={`tel:${order.phone1}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{order.phone1}</span>
            </a>
          )}
          {order.phone2 && (
            <a
              href={`tel:${order.phone2}`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{order.phone2}</span>
            </a>
          )}
          {!order.phone1 && !order.phone2 && (
            <span className="text-gray-400 text-sm">אין טלפון</span>
          )}
        </div>

        {/* Items list (collapsed) */}
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer hover:text-gray-900">הצג פריטים</summary>
          <ul className="mt-2 space-y-1 pr-4">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{item.title}</span>
                <span className="text-gray-500">{item.qty} {item.unit || ''}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* Verify Button */}
        {onVerify && (
          <button
            onClick={onVerify}
            className="w-full mt-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
          >
            וידוא הזמנה
          </button>
        )}
      </div>
    </div>
  );
}
