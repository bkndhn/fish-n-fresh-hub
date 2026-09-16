import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare,
  Truck,
  Store,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { inr } from "@/lib/format";
import { useSessionUser } from "@/lib/session";
import {
  buildWhatsAppOrderMessage,
  getWhatsAppOrderDeepLink,
  recordWhatsAppOrderInCrm,
  type WhatsAppOrderSummary,
  type WhatsAppOrderItem,
} from "@/lib/whatsappOrdering";
import { isGstEnabled, type SiteSettings } from "@/lib/types";

export interface WhatsAppDialogItem {
  productId: string;
  name: string;
  cutPreference?: string | undefined;
  qty: number;
  unit: string;
  price: number;
  totalPrice: number;
}

interface WhatsAppOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: WhatsAppDialogItem[];
  subtotal: number;
  deliveryFee?: number;
  settings?: SiteSettings | null;
  onOrderDispatched?: () => void;
}

export function WhatsAppOrderDialog({
  open,
  onOpenChange,
  items,
  subtotal,
  deliveryFee = 0,
  settings,
  onOrderDispatched,
}: WhatsAppOrderDialogProps) {
  const { user } = useSessionUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill user data
  useEffect(() => {
    if (open) {
      const savedPhone = localStorage.getItem("fnf_phone") || "";
      const savedName = localStorage.getItem("fnf_name") || "";
      const savedAddress = localStorage.getItem("fnf_address") || "";

      setName(user?.user_metadata?.full_name || savedName || "");
      setPhone(user?.phone || user?.user_metadata?.phone || savedPhone || "");
      setAddress(savedAddress || "");
      setPreferredDate(new Date().toISOString().split("T")[0]);
    }
  }, [open, user]);

  const isGstActive = isGstEnabled(settings);
  const effectiveDeliveryFee = fulfillment === "pickup" ? 0 : deliveryFee;
  const netTotal = subtotal + effectiveDeliveryFee;

  const handleSendOrder = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (fulfillment === "delivery" && !address.trim()) {
      toast.error("Please enter your doorstep delivery address");
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem("fnf_phone", phone);
      localStorage.setItem("fnf_name", name);
      if (address) localStorage.setItem("fnf_address", address);

      const storePhone =
        settings?.whatsapp_order_phone ||
        settings?.contact_phone ||
        settings?.whatsapp_number ||
        "9843061919";
      const storeName = settings?.store_name || "Fish N Fresh Hub";

      const orderSummary: WhatsAppOrderSummary = {
        storeName,
        storePhone,
        customer: {
          name: name.trim(),
          phone: cleanPhone,
          address: fulfillment === "delivery" ? address.trim() : undefined,
          fulfillment,
          preferredDate: preferredDate || undefined,
          notes: notes.trim() || undefined,
        },
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          cutPreference: it.cutPreference,
          qty: it.qty,
          unit: it.unit,
          price: it.price,
          totalPrice: it.totalPrice,
        })),
        subtotal,
        deliveryFee: effectiveDeliveryFee,
        gstAmount: 0,
        isGstEnabled: isGstActive,
        total: netTotal,
      };

      const message = buildWhatsAppOrderMessage(orderSummary);
      const deepLink = getWhatsAppOrderDeepLink(storePhone, message);

      // Record in Supabase CRM for analytics and counter visibility
      const crmRes = await recordWhatsAppOrderInCrm(orderSummary);

      toast.success(
        crmRes.success
          ? `Order ${crmRes.orderNumber} recorded! Opening WhatsApp...`
          : "Opening WhatsApp with your order..."
      );

      window.open(deepLink, "_blank");

      if (onOrderDispatched) {
        onOrderDispatched();
      }

      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate WhatsApp order";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Order via WhatsApp Direct
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] text-white">
                  Fast &amp; Direct
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Your cart details will be itemized and sent directly to our store WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Fulfillment Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Delivery or Store Pickup</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFulfillment("delivery")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  fulfillment === "delivery"
                    ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <Truck className="size-4 shrink-0" />
                <div>
                  <p className="text-xs">Doorstep Delivery</p>
                  <p className="text-[10px] opacity-75">Delivered to your home</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("pickup")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  fulfillment === "pickup"
                    ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <Store className="size-4 shrink-0" />
                <div>
                  <p className="text-xs">Store Self-Pickup</p>
                  <p className="text-[10px] opacity-75">Collect fresh from dock</p>
                </div>
              </button>
            </div>
          </div>

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wa_name" className="text-xs">Your Full Name *</Label>
              <Input
                id="wa_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Arun Kumar"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa_phone" className="text-xs">Mobile Number *</Label>
              <Input
                id="wa_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="text-xs font-mono h-9"
              />
            </div>
          </div>

          {/* Delivery Address (only if delivery) */}
          {fulfillment === "delivery" && (
            <div className="space-y-1">
              <Label htmlFor="wa_address" className="text-xs">Delivery Address *</Label>
              <Textarea
                id="wa_address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Door / Flat No, Street, Landmark, Area, City"
                className="text-xs min-h-[70px] resize-none"
              />
            </div>
          )}

          {/* Preferred Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="wa_date" className="text-xs flex items-center gap-1.5">
                <Calendar className="size-3 text-muted-foreground" /> Preferred Date
              </Label>
              <Input
                id="wa_date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wa_notes" className="text-xs">Special Instructions</Label>
              <Input
                id="wa_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Clean thoroughly, pack with extra ice"
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Order Summary Box */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Items ({items.length})</span>
              <span>{inr(subtotal)}</span>
            </div>
            {fulfillment === "delivery" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>{effectiveDeliveryFee === 0 ? "FREE" : inr(effectiveDeliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground border-t border-border/50 pt-1.5 text-sm">
              <span>Total Payable</span>
              <span className="text-emerald-600 dark:text-emerald-400">{inr(netTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-10 text-xs font-semibold"
          >
            Back to Cart
          </Button>
          <Button
            type="button"
            onClick={handleSendOrder}
            disabled={isSubmitting}
            className="rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1"
          >
            <MessageSquare className="size-4" />
            {isSubmitting ? "Generating WhatsApp Link..." : `Send Order on WhatsApp (${inr(netTotal)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
