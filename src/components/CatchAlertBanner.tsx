import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Anchor, Bell, BellRing, Sparkles, X, Compass, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { registerPushNotificationToken } from "@/lib/fcm";
import { useSessionUser } from "@/lib/session";
import { settingsQuery } from "@/lib/queries";
import { getVerticalConfig } from "@/lib/verticals";

export function CatchAlertBanner() {
  const { user } = useSessionUser();
  const { data: settings } = useQuery(settingsQuery);
  const [dismissed, setDismissed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setSubscribed(true);
      }
    }
  }, []);

  const { data: latestBroadcast } = useQuery({
    queryKey: ["latest-catch-broadcast"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("catch_broadcasts")
          .select("*")
          .eq("is_active", true)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return null;
        return data;
      } catch {
        return null;
      }
    },
  });

  // Admin Killswitch / Toggle: If live alerts are disabled in store settings, do not display!
  const isAlertsEnabled = (settings as any)?.live_alerts_enabled ?? true;
  if (!isAlertsEnabled || dismissed) return null;

  // If there is no active broadcast and settings don't explicitly configure one, don't show hardcoded kasimedu harbour if not seafood!
  const vertical = getVerticalConfig((settings as any)?.business_vertical);

  const title =
    latestBroadcast?.title ||
    (settings as any)?.harbour_alert_title ||
    (vertical.id === "chicken_meat"
      ? "🍗 Morning Fresh Farm Harvest Arrival"
      : vertical.id === "all_meat"
      ? "🥩 Fresh Daily Farm & Harbour Arrival"
      : "🌅 Kasimedu Harbour Boat Landing Alert");

  const message =
    latestBroadcast?.message ||
    (settings as any)?.harbour_alert_message ||
    (vertical.id === "chicken_meat"
      ? "Daily morning harvest of antibiotic-free broiler & country chicken just arrived fresh at our counter."
      : vertical.id === "all_meat"
      ? "Fresh day-catch seafood, tender poultry and fresh cuts arrived for express home delivery."
      : "Morning 06:30 AM & 02:00 PM boats arriving with fresh Vanjaram (Seer), White Prawns, and Red Snapper.");

  const harbour =
    latestBroadcast?.harbour_source ||
    (settings as any)?.harbour_source_name ||
    (vertical.id === "chicken_meat"
      ? "Bio-Secure Farm Hub"
      : vertical.id === "all_meat"
      ? "Daily Central Hub"
      : "Kasimedu Harbour, Chennai");

  const handleSubscribePush = async () => {
    const token = await registerPushNotificationToken(user?.id || null, "customer");
    if (token) {
      setSubscribed(true);
      toast.success("🔔 Subscribed to Daily Arrival Alerts!");
    } else {
      toast.info("Please enable browser notifications in settings to receive daily alerts.");
    }
  };

  return (
    <aside
      aria-label="Daily Catch & Harvest Alerts"
      className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-primary/95 to-teal-900 text-white shadow-sm border-b border-sky-700/50"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-8 shrink-0 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-xs text-sm">
            {vertical.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                {title}
              </span>
              <Badge className="bg-sky-400/25 hover:bg-sky-400/30 text-sky-200 border-sky-400/40 text-[10px] py-0 px-1.5 font-mono">
                <Compass className="size-2.5 mr-0.5" /> {harbour}
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-sky-100/90 line-clamp-1 mt-0.5">
              {message}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!subscribed ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 sm:h-8 rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] sm:text-xs gap-1.5 shadow-xs"
              onClick={handleSubscribePush}
            >
              <Bell className="size-3 sm:size-3.5" />
              <span className="hidden xs:inline">Get Daily Alerts</span>
              <span className="xs:hidden">Alerts</span>
            </Button>
          ) : (
            <Badge className="bg-emerald-500/25 text-emerald-200 border-emerald-400/30 text-[11px] py-1 px-2.5 gap-1">
              <BellRing className="size-3 text-emerald-300" />
              <span className="hidden sm:inline">Alerts Active</span>
            </Badge>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="size-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
            aria-label="Dismiss banner"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
