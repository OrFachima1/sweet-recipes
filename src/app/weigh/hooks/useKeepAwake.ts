import { useEffect } from "react";

/**
 * Hook to keep the screen awake during weighing
 * Uses Wake Lock API when available
 */
export function useKeepAwake(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    
    let wakeLock: any = null;
    
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch (e) {
        console.warn("Wake Lock failed", e);
      }
    })();
    
    return () => {
      wakeLock?.release?.();
    };
  }, [enabled]);
}