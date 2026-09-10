import { useState, useEffect } from "react";
import { Download, X, Share, PlusSquare, Smartphone, Monitor, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Global listener to capture beforeinstallprompt as early as script execution
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
  });
}

// Global helper to trigger PWA install modal from any button in the app
export function promptPwaInstall() {
  if (typeof window !== "undefined") {
    const prompt = (window as any).__pwaInstallPrompt;
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then((choice: any) => {
        if (choice.outcome === "accepted") {
          (window as any).__pwaInstallPrompt = null;
        }
      });
      return;
    }
    window.dispatchEvent(new CustomEvent("open-pwa-install"));
  }
}

export function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);

  useEffect(() => {
    // 1. Service Worker registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // 2. Check if already installed / standalone
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(standaloneCheck);
    if (standaloneCheck) return;

    // 3. Check iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    // 4. Check for existing prompt
    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    const onPromptReady = () => {
      if ((window as any).__pwaInstallPrompt) {
        setDeferredPrompt((window as any).__pwaInstallPrompt);
      }
    };
    window.addEventListener("pwa-prompt-ready", onPromptReady);

    // 5. Listen for beforeinstallprompt (Android / Desktop Chrome / Edge)
    const installHandler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e);
      const dismissed = sessionStorage.getItem("pwa_banner_dismissed");
      if (!dismissed) {
        setShowBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", installHandler);

    // Show banner on iOS or Android if not dismissed in this session
    const dismissed = sessionStorage.getItem("pwa_banner_dismissed");
    if (!dismissed) {
      setShowBanner(true);
    }

    // 6. Global trigger handler
    const manualOpenHandler = () => {
      const activePrompt = deferredPrompt || (window as any).__pwaInstallPrompt;
      if (activePrompt) {
        activePrompt.prompt();
        activePrompt.userChoice.then((choice: any) => {
          if (choice.outcome === "accepted") {
            setShowBanner(false);
            (window as any).__pwaInstallPrompt = null;
            setDeferredPrompt(null);
          }
        });
      } else if (isIosDevice) {
        setShowIosGuide(true);
      } else {
        setShowDesktopGuide(true);
      }
    };
    window.addEventListener("open-pwa-install", manualOpenHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", installHandler);
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("open-pwa-install", manualOpenHandler);
    };
  }, []);

  const handleNativeInstall = async () => {
    const activePrompt = deferredPrompt || (typeof window !== "undefined" && (window as any).__pwaInstallPrompt);
    if (!activePrompt) {
      if (isIos) setShowIosGuide(true);
      else setShowDesktopGuide(true);
      return;
    }
    activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      (window as any).__pwaInstallPrompt = null;
      setDeferredPrompt(null);
    }
  };

  const handleBannerInstallClick = () => {
    const activePrompt = deferredPrompt || (typeof window !== "undefined" && (window as any).__pwaInstallPrompt);
    if (activePrompt) {
      handleNativeInstall();
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowDesktopGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa_banner_dismissed", "1");
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Top Banner on Mobile & Desktop if not installed */}
      {showBanner && (
        <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between bg-primary/95 backdrop-blur-md px-3 sm:px-4 py-2 text-primary-foreground shadow-lg transition-all animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-white/20 shrink-0">
              <Download className="size-4 sm:size-5 text-white animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold truncate">Install Fish N Fresh App</p>
              <p className="text-[10px] sm:text-xs text-primary-foreground/80 truncate">
                {isIos ? "Add to Home Screen for fastest checkout" : "Instant catch updates & offline access"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl h-7 sm:h-8 px-3 text-xs font-bold shadow-sm"
              onClick={handleBannerInstallClick}
            >
              Install App
            </Button>
            <button
              className="p-1 sm:p-1.5 text-primary-foreground/80 hover:text-primary-foreground transition-opacity"
              onClick={handleDismiss}
              aria-label="Dismiss banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Step-by-Step Install Guide */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="rounded-3xl max-w-sm p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Smartphone className="size-5 text-primary" />
              Install on iPhone / iPad
            </DialogTitle>
            <DialogDescription className="text-xs">
              Follow these simple steps in Safari to add Fish N Fresh to your Home Screen:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px]">
                1
              </span>
              <div>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  Tap Safari Share Button <Share className="size-3.5 text-primary inline" />
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  At the bottom of your screen (or top on iPad), tap the square icon with an upward arrow.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px]">
                2
              </span>
              <div>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  Select "Add to Home Screen" <PlusSquare className="size-3.5 text-primary inline" />
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Scroll down the share sheet and tap the <strong>Add to Home Screen</strong> option.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/50 border">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[11px]">
                3
              </span>
              <div>
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  Tap "Add" <CheckCircle2 className="size-3.5 text-emerald-500 inline" />
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Tap <strong>Add</strong> at the top right corner. The app icon will appear right on your home screen!
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full rounded-xl mt-2 font-bold"
            onClick={() => setShowIosGuide(false)}
          >
            Got It
          </Button>
        </DialogContent>
      </Dialog>

      {/* Desktop / Browser Install Instructions Modal */}
      <Dialog open={showDesktopGuide} onOpenChange={setShowDesktopGuide}>
        <DialogContent className="rounded-3xl max-w-sm p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Monitor className="size-5 text-primary" />
              Install on Desktop / Chrome
            </DialogTitle>
            <DialogDescription className="text-xs">
              Install Fish N Fresh for direct desktop access and offline support:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              1. Look at your browser address bar at the top right.
            </p>
            <p className="leading-relaxed">
              2. Click the <strong>Install</strong> icon (computer with down arrow) next to the bookmark star.
            </p>
            <p className="leading-relaxed">
              3. Or click the <strong>three dots (⋮)</strong> menu in Chrome/Edge &rarr; <strong>Save and share</strong> &rarr; <strong>Install Fish N Fresh Hub</strong>.
            </p>
          </div>

          <Button
            className="w-full rounded-xl mt-2 font-bold"
            onClick={() => setShowDesktopGuide(false)}
          >
            Understood
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
