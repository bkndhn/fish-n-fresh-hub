import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Register Service Worker required for PWA installability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if the user hasn't explicitly dismissed it recently
      const dismissed = localStorage.getItem("pwa_dismissed");
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!isVisible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("pwa_dismissed", "true");
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between bg-primary p-3 text-primary-foreground shadow-md md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-white/20">
          <Download className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Install Fish N Fresh App</p>
          <p className="text-xs opacity-90">Order faster & get updates</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" className="rounded-xl px-4" onClick={handleInstall}>
          Install
        </Button>
        <button className="p-2 opacity-80 hover:opacity-100" onClick={handleDismiss}>
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
