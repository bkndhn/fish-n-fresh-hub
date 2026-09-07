import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state on the client side only
    setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);

    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-destructive py-1.5 text-xs font-bold text-destructive-foreground shadow-md animate-in slide-in-from-top-full">
      <WifiOff className="size-3.5" />
      You are offline. Browsing in offline mode.
    </div>
  );
}
