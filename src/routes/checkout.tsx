import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { MapPin, Copy, QrCode, Smartphone, Tag, MessageCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { AddressBook } from "@/components/AddressBook";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { deliveryWindowsQuery, windowText } from "@/lib/delivery";
import { isPaymentsConfigured } from "@/lib/stripe";
import { StripeOrderCheckout } from "@/components/StripeOrderCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSessionUser } from "@/lib/session";
import { checkSuspension } from "@/lib/suspensions.functions";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Fish N Fresh" },
      { name: "description", content: "Place your seafood order with cash on delivery or UPI." },
      { property: "og:title", content: "Checkout — Fish N Fresh" },
      { property: "og:description", content: "Delivery or pickup, COD or UPI — checkout in seconds." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: products } = useQuery(productsQuery);
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  useEffect(() => {
    if (user) {
      if (!name) setName((user.user_metadata?.['full_name'] as string) || "");
      if (!phone) setPhone((user.user_metadata?.['phone'] as string) || "");
    }
  }, [user]);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState<"cod" | "upi" | "card">("cod");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [upiUtr, setUpiUtr] = useState("");
  const [orderSuccess, setOrderSuccess] = useState<{ id: string; order_number?: string; total: number; phone: string; name: string } | null>(null);
  
  const { data: windows } = useQuery(deliveryWindowsQuery);
  const [slot, setSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const todaysWindows = (windows ?? []).filter((w) =>
    (w.weekdays ?? []).includes(new Date(`${deliveryDate}T00:00:00`).getDay()),
  );

  const freeOver = Number(settings?.free_delivery_over ?? 500);
  
  // Dynamic Delivery Fee
  let deliveryFee = 0;
  if (fulfillment === "delivery" && subtotal < freeOver) {
    const baseFee = Number(settings?.base_delivery_fee ?? settings?.delivery_fee ?? 40);
    const perKm = Number(settings?.per_km_charge ?? 0);
    deliveryFee = distanceKm ? baseFee + Math.round(distanceKm * perKm) : baseFee;
  }

  // Smart GST Calculation
  let gstAmount = 0;
  items.forEach(cartItem => {
    const liveProduct = products?.find(p => p.id === cartItem.product_id);
    if (liveProduct && liveProduct.gst_percent > 0 && !liveProduct.gst_included) {
      gstAmount += ((cartItem.price * cartItem.qty) * liveProduct.gst_percent) / 100;
    }
  });
  gstAmount = Math.round(gstAmount);

  const discount = appliedPromo?.discount ?? 0;
  const total = Math.max(0, subtotal - discount + deliveryFee + gstAmount);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("active", true)
        .maybeSingle();

      if (error || !data) {
        toast.error("Invalid coupon code");
        setValidatingCoupon(false);
        return;
      }

      if (data.min_order && subtotal < Number(data.min_order)) {
        toast.error(`Minimum order of ${inr(Number(data.min_order))} required`);
        setValidatingCoupon(false);
        return;
      }

      let discountVal = 0;
      if (data.discount_type === "percentage") {
        discountVal = Math.round((subtotal * Number(data.value)) / 100);
      } else {
        discountVal = Math.min(subtotal, Number(data.value));
      }

      setAppliedPromo({ code: data.code || couponCode.trim().toUpperCase(), discount: discountVal });
      toast.success(`Coupon ${data.code} applied: -${inr(discountVal)}`);
    } catch {
      toast.error("Could not validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedPromo(null);
    setCouponCode("");
  }

  function useMyLocation() {
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (settings?.shop_lat && settings?.shop_lng) {
          const d = getDistance(settings.shop_lat, settings.shop_lng, latitude, longitude);
          setDistanceKm(d);
        }
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          if (data?.display_name) setAddress(data.display_name);
        } catch (e) {
          // Ignore reverse geocode failure
        }
        setFetchingLocation(false);
      },
      () => {
        toast.error("Could not get location. Please enable location permissions.");
        setFetchingLocation(false);
      }
    );
  }

  async function placeOrder() {
    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanName.length < 2 || cleanPhone.length < 10 || (fulfillment === "delivery" && !address)) {
      toast.error("Please fill in your name, phone and address");
      return;
    }
    if (payment === "card" && !isPaymentsConfigured()) {
      toast.error("Card payments are not available right now");
      return;
    }
    
    setSaving(true);

    try {
      const suspension = await checkSuspension({ data: { phone: cleanPhone } });
      if (suspension.suspended) {
        toast.error(`Account suspended: ${suspension.reason ?? "Contact support"}`);
        setSaving(false);
        return;
      }
    } catch {
      // suspension check unavailable - continue with the order
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    const orderNotes = [notes.trim(), upiUtr ? `UPI UTR: ${upiUtr}` : ""].filter(Boolean).join(" | ");

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_address: fulfillment === "delivery" ? address : null,
        items: items as unknown as never,
        subtotal,
        delivery_fee: deliveryFee,
        gst_amount: gstAmount,
        discount,
        coupon_code: appliedPromo?.code ?? null,
        total,
        status: "pending",
        payment_method: payment,
        fulfillment_type: fulfillment,
        delivery_date: fulfillment === "delivery" ? deliveryDate : null,
        delivery_slot: fulfillment === "delivery" && slot ? slot : null,
        notes: orderNotes || null,
        user_id: userId,
        created_by: userId,
      })
      .select("id, order_number")
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error("Could not place order. Please try again.");
      return;
    }
    localStorage.setItem("fnf_phone", phone);
    clear();

    if (payment === "card") {
      setCheckoutOrderId(data.id);
      return;
    }

    setOrderSuccess({
      id: data.id,
      order_number: data.order_number ?? data.id.slice(0, 8),
      total,
      phone: cleanPhone,
      name: cleanName,
    });
    toast.success("Order placed successfully!");
  }

  if (orderSuccess) {
    const waNumber = (settings?.support_phone || settings?.whatsapp_number || "919843061919").replace(/\D/g, "");
    const itemsSummary = items.map((i) => `${i.name} x${i.qty}`).join(", ");
    const waText = encodeURIComponent(
      `*Fish N Fresh — New Order Placed*\n\n` +
      `Order: #${orderSuccess.order_number}\n` +
      `Customer: ${orderSuccess.name} (${orderSuccess.phone})\n` +
      `Total: ${inr(orderSuccess.total)}\n` +
      `Payment: ${payment.toUpperCase()}${upiUtr ? ` (UTR: ${upiUtr})` : ""}\n` +
      `Fulfillment: ${fulfillment === "delivery" ? `Delivery to: ${address}` : "Self Pickup"}\n` +
      (slot ? `Slot: ${slot}\n` : "") +
      `\nPlease confirm and pack my fresh seafood order!`
    );

    return (
      <AppShell>
        <div className="mx-auto max-w-md py-8 text-center space-y-4">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
            <CheckCircle2 className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Order Confirmed!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Order #{orderSuccess.order_number} has been received and sent to our fresh packing hub.
            </p>
          </div>

          <div className="rounded-2xl border p-4 text-left space-y-2 bg-card text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold font-display text-base">{inr(orderSuccess.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span className="capitalize font-medium">{payment === "cod" ? "Cash on Delivery" : payment.toUpperCase()}</span>
            </div>
            {upiUtr && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">UPI UTR</span>
                <span className="font-mono">{upiUtr}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize font-medium">{fulfillment}</span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Button
              asChild
              className="w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              <a
                href={`https://wa.me/${waNumber}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 size-4" /> Send Confirmation on WhatsApp
              </a>
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => navigate({ to: "/track/$id", params: { id: orderSuccess.id } })}
            >
              Track Live Order Status
            </Button>

            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => navigate({ to: "/orders" })}
            >
              View All Orders
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (checkoutOrderId) {
    return (
      <AppShell>
        <h1 className="text-2xl font-bold">Pay for your order</h1>
        <div className="mt-3">
          <PaymentTestModeBanner />
        </div>
        <StripeOrderCheckout
          orderId={checkoutOrderId}
          returnUrl={`${window.location.origin}/payment-status?order=${checkoutOrderId}`}
        />
      </AppShell>
    );
  }

  if (items.length === 0) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">Your cart is empty.</p>
      </AppShell>
    );
  }

  const isStoreOpen = settings?.is_open ?? true;
  const upiId = settings?.upi_id || "9843061919@upi";
  const upiName = settings?.upi_name || "Fish N Fresh";
  const upiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiDeepLink)}`;

  return (
    <AppShell>
      {!isStoreOpen && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">Shop is currently closed</p>
            <p className="mt-0.5 opacity-90">
              You can still place an order! We will freshly catch, clean and pack your seafood for the earliest delivery window.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="mt-4 flex gap-2">
        {(["delivery", "pickup"] as const).map((f) => (
          <Button
            key={f}
            variant={fulfillment === f ? "default" : "outline"}
            className="flex-1 rounded-xl capitalize"
            onClick={() => setFulfillment(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="mt-1 rounded-xl"
          />
        </div>
        {fulfillment === "delivery" && (
          <div className="space-y-1.5 pt-2">
            <Label>Delivery Address</Label>
            <AddressBook 
              selectedAddress={address} 
              onSelect={(addr, lat, lng) => {
                setAddress(addr);
                if (settings?.shop_lat && settings?.shop_lng && lat && lng) {
                  const d = getDistance(settings.shop_lat, settings.shop_lng, lat, lng);
                  setDistanceKm(d);
                }
              }} 
            />
          </div>
        )}
        
        <div>
          <Label htmlFor="delivery-date">
            {fulfillment === "pickup" ? "Pickup day & time" : "Delivery day & time"}
          </Label>
          <Input
            id="delivery-date"
            type="date"
            value={deliveryDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setDeliveryDate(e.target.value);
              setSlot("");
            }}
            className="mt-1 rounded-xl"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {todaysWindows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No slots available for this day — we will call you to confirm.
              </p>
            ) : (
              todaysWindows.map((w) => {
                const value = windowText(w);
                return (
                  <Button
                    key={w.id}
                    type="button"
                    size="sm"
                    variant={slot === value ? "default" : "outline"}
                    className="rounded-xl"
                    onClick={() => setSlot(slot === value ? "" : value)}
                  >
                    {value}
                  </Button>
                );
              })
            )}
          </div>
        </div>

        {/* Promo Code Box */}
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Tag className="size-3.5 text-primary" /> Apply Coupon / Promo Code
          </Label>
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-xl bg-green-50 dark:bg-green-950/40 p-2.5 border border-green-200 dark:border-green-900">
              <div>
                <p className="text-xs font-bold text-green-700 dark:text-green-300">
                  {appliedPromo.code} applied!
                </p>
                <p className="text-[11px] text-green-600 dark:text-green-400">
                  You saved {inr(appliedPromo.discount)}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={removeCoupon}>
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code (e.g. FRESH50)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="rounded-xl text-xs uppercase"
              />
              <Button
                type="button"
                size="sm"
                className="rounded-xl shrink-0"
                disabled={!couponCode.trim() || validatingCoupon}
                onClick={applyCoupon}
              >
                {validatingCoupon ? "Checking..." : "Apply"}
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Notes & Instructions (optional)</Label>
          <Textarea 
            id="notes" 
            placeholder="e.g. Ring bell twice, leave with security, curry cut preference..."
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            className="mt-1 rounded-xl" 
          />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">Payment method</p>
        <div className="flex gap-2">
          <Button
            variant={payment === "cod" ? "default" : "outline"}
            className="flex-1 rounded-xl text-xs sm:text-sm"
            onClick={() => setPayment("cod")}
            disabled={settings?.require_online_payment ?? false}
          >
            Cash on delivery {settings?.require_online_payment && "(Disabled)"}
          </Button>
          <Button
            variant={payment === "upi" ? "default" : "outline"}
            className="flex-1 rounded-xl text-xs sm:text-sm"
            onClick={() => setPayment("upi")}
          >
            UPI / QR Code
          </Button>
          <Button
            variant={payment === "card" ? "default" : "outline"}
            className="flex-1 rounded-xl text-xs sm:text-sm"
            onClick={() => setPayment("card")}
          >
            Card
          </Button>
        </div>

        {payment === "upi" && (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Scan & Pay via UPI (0% Fee)</span>
              <span className="text-xs font-bold text-primary">{inr(total)}</span>
            </div>

            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border">
              <img
                src={upiQrUrl}
                alt="UPI QR Code"
                className="size-44 object-contain"
              />
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-background p-2.5 border text-xs">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] text-muted-foreground">Store UPI ID</p>
                <p className="font-mono font-medium truncate">{upiId}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(upiId);
                  toast.success("UPI ID copied!");
                }}
              >
                <Copy className="mr-1 size-3" /> Copy
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl sm:hidden border-primary/40 text-primary"
              onClick={() => {
                window.location.href = upiDeepLink;
              }}
            >
              <Smartphone className="mr-2 size-4" /> Open UPI App on this Phone
            </Button>

            <div className="space-y-1.5 pt-1">
              <Label htmlFor="upi-utr" className="text-xs">
                12-Digit UPI Transaction / UTR No. (Optional)
              </Label>
              <Input
                id="upi-utr"
                placeholder="e.g. 423456789012"
                value={upiUtr}
                onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className="rounded-xl bg-background font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Enter your transaction ID from GPay/PhonePe to speed up packing and verification.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <Row label="Subtotal" value={inr(subtotal)} />
        {discount > 0 && (
          <div className="flex justify-between text-green-600 font-medium">
            <span>Coupon Discount ({appliedPromo?.code})</span>
            <span>-{inr(discount)}</span>
          </div>
        )}
        <Row label="Delivery" value={deliveryFee === 0 ? "Free" : inr(deliveryFee)} />
        {gstAmount > 0 && <Row label="GST (Smart Calculation)" value={inr(gstAmount)} />}
        <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
          <span>Total</span>
          <span>{inr(total)}</span>
        </div>
      </div>

      <Button className="mt-4 w-full rounded-xl" disabled={saving} onClick={placeOrder}>
        {saving ? "Placing order…" : `Place order · ${inr(total)}`}
      </Button>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
