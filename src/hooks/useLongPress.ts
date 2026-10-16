import { useRef, useCallback } from "react";

type LongPressOptions = {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
};

export function useLongPress({ onLongPress, onClick, delay = 600 }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const isLongPress = useRef(false);
  // Separate flag that persists until the click event fires (isLongPress is reset on pointerUp)
  const wasLongPress = useRef(false);

  const start = useCallback(
    (e: React.PointerEvent) => {
      isLongPress.current = false;
      wasLongPress.current = false;
      // NOTE: setPointerCapture removed — it prevented click events from reaching child
      // elements on desktop (pointer events are captured but mouse/click events are not,
      // causing the inner div's onClick to never fire on non-touch devices).

      timer.current = window.setTimeout(() => {
        isLongPress.current = true;
        wasLongPress.current = true;
        onLongPress();
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

      if (!isLongPress.current && onClick && e) {
        onClick();
      }

      isLongPress.current = false;
      // wasLongPress is intentionally NOT reset here — the click event fires after
      // pointerUp and needs wasLongPress to still be true to suppress navigation.
    },
    [onClick]
  );

  const cancelClear = useCallback(
    (e?: React.PointerEvent) => {
      wasLongPress.current = false;
      clear(e);
    },
    [clear]
  );

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerCancel: cancelClear,
    onPointerLeave: cancelClear,
    // Capture phase: intercepts click BEFORE it reaches child elements.
    // Suppresses navigation when the interaction was a long press, not a tap.
    onClickCapture: (e: React.MouseEvent) => {
      if (wasLongPress.current) {
        wasLongPress.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };
}
