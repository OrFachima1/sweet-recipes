// src/hooks/useOrdersNavigation.ts
import { useState, useCallback, useEffect } from 'react';
import { fmtYMD, addMonths, addDays } from '@/utils/orders';

type ViewMode = "month" | "week" | "day";
type MainView = "calendar" | "clients";

interface UseOrdersNavigationProps {
  viewMode: ViewMode;
  viewDate: Date;
  setViewDate: (date: Date) => void;
}

export function useOrdersNavigation({
  viewMode,
  viewDate,
  setViewDate,
}: UseOrdersNavigationProps) {
  // ===== State =====
  const [selectedDayKey, setSelectedDayKey] = useState<string>(fmtYMD(new Date()));
  const [picker, setPicker] = useState<string>(fmtYMD(new Date()));
  const [mainView, setMainView] = useState<MainView>("calendar");

  // ===== Derived Values =====
  const today = fmtYMD(new Date());
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  // ===== Navigation Functions =====
  const goToday = useCallback(() => {
    const t = new Date();
    setViewDate(t);
    setSelectedDayKey(fmtYMD(t));
  }, [setViewDate]);

  const prev = useCallback(() => {
    if (viewMode === "month") {
      const d = addMonths(viewDate, -1);
      setViewDate(d);
      setSelectedDayKey(fmtYMD(d));
    } else if (viewMode === "week") {
      const nd = addDays(viewDate, -7);
      setViewDate(nd);
      setSelectedDayKey(fmtYMD(nd));
    } else {
      const nd = addDays(viewDate, -1);
      setViewDate(nd);
      setSelectedDayKey(fmtYMD(nd));
    }
  }, [viewMode, viewDate, setViewDate]);

  const next = useCallback(() => {
    if (viewMode === "month") {
      const d = addMonths(viewDate, 1);
      setViewDate(d);
      setSelectedDayKey(fmtYMD(d));
    } else if (viewMode === "week") {
      const nd = addDays(viewDate, 7);
      setViewDate(nd);
      setSelectedDayKey(fmtYMD(nd));
    } else {
      const nd = addDays(viewDate, 1);
      setViewDate(nd);
      setSelectedDayKey(fmtYMD(nd));
    }
  }, [viewMode, viewDate, setViewDate]);

  // ===== Date Picker Effect =====
  useEffect(() => {
    if (picker) {
      setSelectedDayKey(picker);
      setViewDate(new Date(picker));
    }
  }, [picker, setViewDate]);

  return {
    // State
    selectedDayKey,
    picker,
    mainView,
    today,
    monthLabel,

    // Setters
    setSelectedDayKey,
    setPicker,
    setMainView,

    // Navigation
    goToday,
    prev,
    next,
  };
}