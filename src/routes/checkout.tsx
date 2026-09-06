import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import { deliveryWindowsQuery, windowText } from "@/lib/delivery";
import { isPaymentsConfigured } from "@/lib/stripe";
import { StripeOrderCheckout } from "@/components/StripeOrderCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Fish N Fresh" },
      { name: "description", content: "Place your seafood order with cash on delivery or UPI." },
      { property: "og:title", content: "Checkout — Fish N Fresh" },
      { property: "og:description", content: "Delivery or pickup, COD or UPI — checkout in seconds." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
  const deliveryFee =
    fulfillment === "pickup" || subtotal >= freeOver ? 0 : Number(settings?.delivery_fee ?? 0);
  const gstPercent = settings?.gst_enabled ? Number(settings.gst_percent ?? 0) : 0;
  const gstAmount = Math.round((subtotal * gstPercent) / 100);
  const total = subtotal + deliveryFee + gstAmount;

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
        gst_percent: gstPercent,
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
            <Label htmlFor="address">Delivery address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>
        )}
        {fulfillment === "delivery" && (
          <div>
            <Label htmlFor="delivery-date">Delivery day &amp; time</Label>
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
                  No delivery windows for this day — we will call you to confirm a time.
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
        )}
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-xl" />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium">Payment method</p>
        <div className="flex gap-2">
          {(["cod", "upi", "card"] as const).map((p) => (
            <Button
              key={p}
              variant={payment === p ? "default" : "outline"}
              className="flex-1 rounded-xl"
              onClick={() => setPayment(p)}
            >
              {p === "cod" ? "Cash on delivery" : p === "upi" ? "UPI" : "Card"}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <Row label="Subtotal" value={inr(subtotal)} />
        <Row label="Delivery" value={deliveryFee === 0 ? "Free" : inr(deliveryFee)} />
        {gstPercent > 0 && <Row label={`GST (${gstPercent}%)`} value={inr(gstAmount)} />}
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
