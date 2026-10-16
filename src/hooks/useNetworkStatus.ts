"use client";

import { useEffect, useState } from "react";

type NetworkStatus = {
  isOnline: boolean;
  isSlowConnection: boolean;
};

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const checkSlow = () => {
      const conn = (navigator as any).connection;
      if (conn) {
        setIsSlowConnection(conn.effectiveType === "slow-2g" || conn.effectiveType === "2g");
      }
    };
    checkSlow();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const conn = (navigator as any).connection;
    if (conn) {
      conn.addEventListener("change", checkSlow);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn) conn.removeEventListener("change", checkSlow);
    };
  }, []);

  return { isOnline, isSlowConnection };
}
