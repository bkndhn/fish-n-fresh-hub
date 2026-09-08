import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCustomerOrderDeliveryPin, type DeliveryPinData } from "@/lib/deliveryPin";

interface CustomerDeliveryPinCardProps {
  orderId: string;
  orderStatus?: string;
  fulfillmentType?: string;
  className?: string;
}

export function CustomerDeliveryPinCard({
  orderId,
  orderStatus,
  fulfillmentType = "delivery",
  className = "",
}: CustomerDeliveryPinCardProps) {
  const [pinData, setPinData] = useState<DeliveryPinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPin() {
      if (!orderId) return;
      try {
        const data = await getCustomerOrderDeliveryPin(orderId);
        if (mounted && data) {
          setPinData(data);
        }
      } catch (e) {
        console.warn("Could not load delivery pin:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPin();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const isDelivered = orderStatus === "delivered" || !!pinData?.verified_at;
  const isPickup = fulfillmentType === "pickup";

  if (loading) {
    return (
      <Card className={`border-primary/20 bg-primary/5 animate-pulse ${className}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-primary/20 rounded" />
            <div className="h-6 w-36 bg-primary/20 rounded" />
          </div>
          <div className="h-8 w-20 bg-primary/20 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // If no pin found yet, generate fallback or show ready state
  const pinCode = pinData?.pin_code;
  if (!pinCode && !isDelivered) {
    return null;
  }

  const digits = pinCode ? pinCode.split("") : [];

  const handleCopy = () => {
    if (!pinCode) return;
    navigator.clipboard.writeText(pinCode);
    setCopied(true);
    toast.success("Delivery PIN copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={`relative overflow-hidden border-2 border-primary/30 bg-linear-to-br from-primary/10 via-background to-primary/5 shadow-md ${className}`}>
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

      <CardContent className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              {isDelivered ? <CheckCircle2 className="size-5" /> : <Lock className="size-4.5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-bold text-foreground">
                  {isPickup ? "Counter Pickup Secret PIN" : "Doorstep Delivery PIN"}
                </p>
                <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-extrabold text-primary border border-primary/20">
                  Customer Only
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isDelivered
                  ? "Order verified & delivered securely"
                  : `Share with ${isPickup ? "counter staff" : "delivery rider"} upon arrival`}
              </p>
            </div>
          </div>

          {pinCode && !isDelivered && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 text-xs font-semibold px-2.5 border-primary/30 hover:bg-primary/10 text-primary shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="size-3 mr-1 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3 mr-1" /> Copy PIN
                </>
              )}
            </Button>
          )}
        </div>

        {/* Big Digit Display */}
        {isDelivered ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Verified &amp; Handed Over. Seafood authenticity and delivery confirmed.</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              {digits.map((d, i) => (
                <div
                  key={i}
                  className="flex size-11 items-center justify-center rounded-xl border-2 border-primary/40 bg-background font-display text-xl font-extrabold text-foreground shadow-xs ring-2 ring-primary/10"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-muted/60 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground max-w-xs leading-tight">
              <span className="font-semibold text-foreground">Anti-Theft Protection:</span> Never share this PIN over phone or WhatsApp. Only share verbally when the rider is at your door.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
