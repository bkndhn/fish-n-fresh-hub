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

declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
    prompt(): Promise<void>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

// Global listener to capture beforeinstallprompt as early as script execution
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
  });
}

// Global helper to trigger PWA install from any button in the app.
// Reads window.__pwaInstallPrompt at call time — never a stale closure.
export function promptPwaInstall() {
  if (typeof window !== "undefined") {
    const prompt = window.__pwaInstallPrompt;
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then((choice) => {
        if (choice.outcome === "accepted") {
          window.__pwaInstallPrompt = null;
          try {
            localStorage.setItem("fnf_pwa_installed", "true");
          } catch (_) {}
          window.dispatchEvent(new CustomEvent("pwa-app-installed"));
        }
      });
      return;
    }
    // Open dedicated install presentation sheet
    window.dispatchEvent(new CustomEvent("open-pwa-install"));
  }
}

export function PwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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

    // 2. Already installed / standalone — hide everything
    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://") ||
      (typeof localStorage !== "undefined" && localStorage.getItem("fnf_pwa_installed") === "true");
    setIsStandalone(standaloneCheck);
    if (standaloneCheck) return;

    // 3. Detect iOS (Safari never fires beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    const dismissed = sessionStorage.getItem("pwa_banner_dismissed");

    // 4. Pick up prompt that already fired before this component mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
      if (!dismissed) setShowBanner(true);
    }

    // 5. iOS — show banner immediately (user taps → iOS guide sheet)
    if (isIosDevice && !dismissed) {
      setShowBanner(true);
    }

    // 6. beforeinstallprompt arrives AFTER mount (most common on Android / Desktop)
    const installHandler = (e: Event) => {
      e.preventDefault();
      const bEvent = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = bEvent;
      setDeferredPrompt(bEvent);
      if (!sessionStorage.getItem("pwa_banner_dismissed")) {
        setShowBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", installHandler);

    // 7. Native app installation complete event
    const onAppInstalled = () => {
      setIsStandalone(true);
      setShowBanner(false);
      setShowIosGuide(false);
      setShowDesktopGuide(false);
      window.__pwaInstallPrompt = null;
      setDeferredPrompt(null);
      try {
        localStorage.setItem("fnf_pwa_installed", "true");
      } catch (_) {}
    };
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pwa-app-installed", onAppInstalled);

    // 8. Sync state when global store is updated
    const onPromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    };
    window.addEventListener("pwa-prompt-ready", onPromptReady);

    // 9. Global trigger from promptPwaInstall() helper.
    const manualOpenHandler = () => {
      const activePrompt = window.__pwaInstallPrompt;
      if (activePrompt) {
        activePrompt.prompt();
        activePrompt.userChoice.then((choice) => {
          if (choice.outcome === "accepted") {
            onAppInstalled();
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
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("pwa-app-installed", onAppInstalled);
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("open-pwa-install", manualOpenHandler);
    };
  }, []);

  // Always pull the freshest prompt — avoids any residual stale-state issues
  const getActivePrompt = () =>
    (typeof window !== "undefined" && window.__pwaInstallPrompt) || deferredPrompt;

  const handleNativeInstall = async () => {
    const activePrompt = getActivePrompt();
    if (!activePrompt) {
      if (isIos) setShowIosGuide(true);
      else setShowDesktopGuide(true);
      return;
    }
    activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setShowDesktopGuide(false);
      window.__pwaInstallPrompt = null;
      setDeferredPrompt(null);
      setIsStandalone(true);
      try {
        localStorage.setItem("fnf_pwa_installed", "true");
      } catch (_) {}
    }
  };

  const handleBannerInstallClick = () => {
    const activePrompt = getActivePrompt();
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

      {/* iOS Step-by-Step Install Guide (shown only on iOS Safari) */}
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

      {/* Native App Install Presentation Modal */}
      <Dialog open={showDesktopGuide} onOpenChange={setShowDesktopGuide}>
        <DialogContent className="rounded-3xl max-w-sm p-5 sm:p-6 border-border/80 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-3">
            <img
              src="/logo.png"
              alt="Fish N Fresh Hub"
              className="size-16 rounded-2xl object-contain shadow-md border border-border/60 p-1 bg-background"
            />
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Install Fish N Fresh Hub
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official PWA · Fast, lightweight &amp; secure
              </p>
            </div>
          </div>

          <div className="space-y-2.5 my-3 text-xs bg-muted/40 p-3.5 rounded-2xl border border-border/60">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Express 35-min fresh catch checkout</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Real-time morning boat arrival alerts</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Works seamlessly even with spotty internet</span>
            </div>
          </div>

          {getActivePrompt() ? (
            <Button
              className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-10"
              onClick={handleNativeInstall}
            >
              <Download className="mr-1.5 size-4" />
              Install App Now
            </Button>
          ) : (
            <div className="space-y-2.5">
              <Button
                className="w-full rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-10"
                onClick={handleNativeInstall}
              >
                <Download className="mr-1.5 size-4" />
                Install App
              </Button>
              <div className="p-2.5 rounded-xl bg-muted/30 border text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">If install dialog doesn't appear automatically:</p>
                <p>• <strong>Mobile Chrome:</strong> Tap top menu <strong className="text-foreground">(⋮)</strong> &rarr; tap <strong className="text-foreground">Install app</strong></p>
                <p>• <strong>Desktop Chrome/Edge:</strong> Click the <strong className="text-foreground">Install icon</strong> at the right side of the address bar</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
