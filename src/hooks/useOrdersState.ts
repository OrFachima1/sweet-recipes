import { useState } from 'react';
import { IngestJsonOrder } from '@/types/orders';

export function useOrdersState() {
  // State בסיסי
  const [orders, setOrders] = useState<IngestJsonOrder[]>([]);
  const [menuOptions, setMenuOptions] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  
  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  
  // Selected/Active items
  const [selectedDayKey, setSelectedDayKey] = useState<string>('');
  const [addItemFor, setAddItemFor] = useState<string | null>(null);
  
  return {
    // Orders
    orders,
    setOrders,
    menuOptions,
    setMenuOptions,
    
    // View
    viewDate,
    setViewDate,
    viewMode,
    setViewMode,
    
    // Modals
    showUpload,
    setShowUpload,
    showManualOrder,
    setShowManualOrder,
    showSettings,
    setShowSettings,
    dayModalKey,
    setDayModalKey,
    
    // Selection
    selectedDayKey,
    setSelectedDayKey,
    addItemFor,
    setAddItemFor,
  };
}