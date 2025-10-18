import { useState, useCallback, useEffect } from "react";

/**
 * Hook to manage weighing progress with localStorage persistence
 */
export function useWeighProgress() {
  const [weighed, setWeighed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('weigh_progress');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [showConfetti, setShowConfetti] = useState(false);
  const [prevWeighedSize, setPrevWeighedSize] = useState(0);

  const toggleWeighed = useCallback((name: string) => {
    setWeighed(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      try {
        localStorage.setItem('weigh_progress', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const clearProgress = useCallback(() => {
    setWeighed(new Set());
    try {
      localStorage.removeItem('weigh_progress');
    } catch {}
  }, []);

  const checkCompletion = useCallback((totalIngredients: number) => {
    if (totalIngredients === 0) return;
    if (weighed.size > prevWeighedSize && weighed.size === totalIngredients) {
      setShowConfetti(true);
    }
    setPrevWeighedSize(weighed.size);
  }, [weighed.size, prevWeighedSize]);

  return {
    weighed,
    toggleWeighed,
    clearProgress,
    showConfetti,
    setShowConfetti,
    checkCompletion,
  };
}