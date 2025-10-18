import { useRef, useCallback } from "react";

type LongPressOptions = {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
};

export function useLongPress({ onLongPress, onClick, delay = 600 }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback(
    (e: React.PointerEvent) => {
      isLongPress.current = false;
      const target = e.currentTarget as Element;
      
      try {
        target.setPointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if setPointerCapture fails
      }

      timer.current = window.setTimeout(() => {
        isLongPress.current = true;
        onLongPress();
        
        // Add haptic feedback on supported devices
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e?: React.PointerEvent) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      if (e) {
        try {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        } catch (err) {
          // Ignore if releasePointerCapture fails
        }
      }

      // If it wasn't a long press, trigger onClick
      if (!isLongPress.current && onClick && e) {
        onClick();
      }

      isLongPress.current = false;
    },
    [onClick]
  );

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}