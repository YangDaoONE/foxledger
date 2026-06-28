import { useEffect, useState } from "react";

export function getNetworkOnlineState() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => getNetworkOnlineState());

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
