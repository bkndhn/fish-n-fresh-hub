import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { deliveryWindowsQuery, windowText } from "@/lib/delivery";
import { isPaymentsConfigured } from "@/lib/stripe";
import { StripeOrderCheckout } from "@/components/StripeOrderCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSessionUser } from "@/lib/session";

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

  const total = subtotal + deliveryFee + gstAmount;

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
    if (!name || phone.length < 10 || (fulfillment === "delivery" && !address)) {
      toast.error("Please fill in your name, phone and address");
      return;
    }
    if (payment === "card" && !isPaymentsConfigured()) {
      toast.error("Card payments are not available right now");
      return;
    }
    
    setSaving(true);
    
    const { data: suspension } = await supabase
      .from("customer_suspensions")
      .select("reason")
      .eq("phone", phone)
      .maybeSingle();
      
    if (suspension) {
      toast.error(`Account suspended: ${suspension.reason}`);
      setSaving(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: name,
        customer_phone: phone,
        customer_address: fulfillment === "delivery" ? address : null,
        items: items as unknown as never,
        subtotal,
        delivery_fee: deliveryFee,
        gst_amount: gstAmount,
        
        total,
        status: "pending",
        payment_method: payment,
        fulfillment_type: fulfillment,
        delivery_date: fulfillment === "delivery" ? deliveryDate : null,
        delivery_slot: fulfillment === "delivery" && slot ? slot : null,
        notes,
        user_id: userId,
        created_by: userId,
      })
      .select("id")
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
    if (payment === "upi" && settings?.upi_id) {
      window.location.href = `upi://pay?pa=${settings.upi_id}&pn=${encodeURIComponent(settings.upi_name)}&am=${total}&cu=INR`;
    }
    toast.success("Order placed!");
    navigate({ to: "/orders" });
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

  return (
    <AppShell>
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
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="address">Delivery address</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-primary"
                onClick={useMyLocation}
                disabled={fetchingLocation}
              >
                <MapPin className="mr-1 size-3" />
                {fetchingLocation ? "Locating..." : "Use My Location"}
              </Button>
            </div>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 rounded-xl"
              placeholder="Full address with landmark"
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
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-xl" />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">Payment method</p>
        <div className="flex gap-2">
          <Button
            variant={payment === "cod" ? "default" : "outline"}
            className="flex-1 rounded-xl"
            onClick={() => setPayment("cod")}
            disabled={settings?.require_online_payment ?? false}
          >
            Cash on delivery {settings?.require_online_payment && "(Disabled)"}
          </Button>
          <Button
            variant={payment === "upi" ? "default" : "outline"}
            className="flex-1 rounded-xl"
            onClick={() => setPayment("upi")}
          >
            UPI
          </Button>
          <Button
            variant={payment === "card" ? "default" : "outline"}
            className="flex-1 rounded-xl"
            onClick={() => setPayment("card")}
          >
            Card
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <Row label="Subtotal" value={inr(subtotal)} />
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
