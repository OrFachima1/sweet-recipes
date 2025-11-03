// src/hooks/useOrdersModals.ts
import { useState, useCallback, useEffect } from 'react';

export function useOrdersModals() {
  // ===== Modal States =====
  const [addSearch, setAddSearch] = useState<string>("");
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  // ===== Note Functions =====
  const noteKey = useCallback((orderId: string, idx: number) => `${orderId}:${idx}`, []);
  
  const toggleNote = useCallback((orderId: string, idx: number) => {
    setNoteOpen(prev => ({ 
      ...prev, 
      [noteKey(orderId, idx)]: !prev[noteKey(orderId, idx)] 
    }));
  }, [noteKey]);

  return {
    // State
    addSearch,
    noteOpen,
    showSettings,
    showRevenue,

    // Setters
    setAddSearch,
    setNoteOpen,
    setShowSettings,
    setShowRevenue,

    // Functions
    noteKey,
    toggleNote,
  };
}