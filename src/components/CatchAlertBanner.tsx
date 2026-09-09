import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Anchor, Bell, BellRing, Sparkles, X, Compass, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { registerPushNotificationToken } from "@/lib/fcm";
import { useSessionUser } from "@/lib/session";

export function CatchAlertBanner() {
  const { user } = useSessionUser();
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

  if (dismissed) return null;

  const handleSubscribePush = async () => {
    const token = await registerPushNotificationToken({
      userId: user?.id || null,
      role: "customer",
    });
    if (token) {
      setSubscribed(true);
      toast.success("🔔 Subscribed to Daily Morning Catch Alerts!");
    } else {
      toast.info("Please enable browser notifications in settings to receive boat landing alerts.");
    }
  };

  const title = latestBroadcast?.title || "🌅 Kasimedu Harbour Boat Landing Alert";
  const message =
    latestBroadcast?.message ||
    "Morning 06:30 AM & 02:00 PM boats arriving with fresh Vanjaram (Seer), White Prawns, and Red Snapper. Chemical-free direct from dock.";
  const harbour = latestBroadcast?.harbour_source || "Kasimedu Harbour, Chennai";

  return (
    <aside aria-label="Harbour Catch Alerts" className="relative overflow-hidden bg-gradient-to-r from-sky-900 via-primary/95 to-teal-900 text-white shadow-sm border-b border-sky-700/50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-8 shrink-0 rounded-xl bg-white/15 flex items-center justify-center text-white backdrop-blur-xs">
            <Anchor className="size-4 animate-pulse" />
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
              <span className="hidden xs:inline">Get Boat Alerts</span>
              <span className="xs:hidden">Alerts</span>
            </Button>
          ) : (
            <Badge className="bg-emerald-500/25 text-emerald-200 border-emerald-400/30 text-[11px] py-1 px-2.5 gap-1">
              <BellRing className="size-3" />
              <span className="hidden sm:inline">Alerts Active</span>
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="size-7 rounded-full p-0 text-sky-200 hover:bg-white/15 hover:text-white"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss harbour banner"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
