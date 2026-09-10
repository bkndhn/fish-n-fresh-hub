import { useState, useEffect } from "react";
import { Bell, BellRing, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { registerPushNotification } from "@/lib/fcm";
import { toast } from "sonner";

export function NotificationPromptCard({ userId }: { userId?: string | null | undefined }) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnablePush = async () => {
    try {
      setLoading(true);
      const token = await registerPushNotification(userId, "customer");
      if (token) {
        setPermission("granted");
        toast.success("Live order delivery & catch alerts enabled!");
      } else {
        if (typeof window !== "undefined" && "Notification" in window) {
          setPermission(Notification.permission);
        }
        if (Notification.permission === "denied") {
          toast.error("Notifications blocked in your browser settings. Please allow notifications to receive live updates.");
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (permission === "granted") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span>
            <strong>Push alerts active:</strong> You'll receive real-time delivery milestones on this device.
          </span>
        </div>
        <span className="shrink-0 font-semibold text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="size-3" /> Enabled
        </span>
      </div>
    );
  }

  if (permission === "denied") {
    return null; // Don't nag if explicitly denied
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-r from-primary/5 via-background to-sky-500/5 shadow-2xs overflow-hidden">
      <CardContent className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <Bell className="size-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Get Live Order Status & Catch Alerts</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Receive instant notifications when your order is cleaned, dispatched on ice, or arriving.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleEnablePush}
          disabled={loading}
          className="rounded-xl h-8 text-xs font-semibold shrink-0 shadow-2xs gap-1.5 w-full sm:w-auto"
        >
          <BellRing className="size-3.5" />
          {loading ? "Enabling..." : "Enable Push Alerts"}
        </Button>
      </CardContent>
    </Card>
  );
}
