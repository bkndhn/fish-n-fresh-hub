import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { MapPin, Copy, QrCode, Smartphone, Tag, MessageCircle, AlertTriangle, CheckCircle2, Zap, Clock, Gift, Wallet, Sparkles, Upload, X, Check, Store } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCustomerBranch } from "@/lib/customerBranchContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { AddressBook } from "@/components/AddressBook";
import { MapPinPickerModal } from "@/components/MapPinPickerModal";
import { calculateDistanceKm, getGoogleMapsDirUrl, forwardGeocodeAddress, getOsrmRoadRoute } from "@/lib/maps";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { deliveryWindowsQuery, windowText } from "@/lib/delivery";
import { isPaymentsConfigured } from "@/lib/stripe";
import { StripeOrderCheckout } from "@/components/StripeOrderCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useSessionUser } from "@/lib/session";
import { checkSuspension } from "@/lib/suspensions.functions";
import { getStoreStatus, isDateHoliday, getNextWorkingDate } from "@/lib/storeSchedule";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { registerOrderDeliveryPin } from "@/lib/deliveryPin";
import { CustomerDeliveryPinCard } from "@/components/CustomerDeliveryPinCard";
import { getOrCreateUserWallet, calculateMaxRedeemable, redeemWalletBalance, validateReferralCode } from "@/lib/wallet";
import { notifyOrderStatusChange } from "@/lib/fcm";
import { checkCartStockAvailability, deductOrderStock } from "@/lib/inventorySync";
import { sendOrderConfirmedEmailServer } from "@/lib/emails.functions";
import { evaluateCartRewardRule, recordCampaignConversion, type MarketingCampaign } from "@/lib/campaigns";
import type { SiteSettings } from '@/lib/types';

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

function playOrderSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.09);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.09 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + index * 0.09);
      osc.stop(ctx.currentTime + index * 0.09 + 0.35);
    });
  } catch {
    // audio policy
  }
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
  const { data: products } = useQuery(productsQuery());
  const { activeBranch, isWithinDeliveryRadius, setIsLocationModalOpen } = useCustomerBranch();
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const hubLat = activeBranch?.lat ?? settings?.shop_lat;
  const hubLng = activeBranch?.lng ?? settings?.shop_lng;
  
  useEffect(() => {
    const savedEmail = localStorage.getItem("fnf_email") || "";
    if (savedEmail && !email) setEmail(savedEmail);
    if (user) {
      if (!name) setName((user.user_metadata?.['full_name'] as string) || "");
      if (!phone) setPhone((user.user_metadata?.['phone'] as string) || "");
      if (!email && user.email) setEmail(user.email);
    }
  }, [user]);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
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
  const [upiScreenshot, setUpiScreenshot] = useState<string | null>(null);
  const [paymentTimerSeconds, setPaymentTimerSeconds] = useState(600);
  const [orderSuccess, setOrderSuccess] = useState<{ id: string; order_number?: string; total: number; phone: string; name: string; branch_name?: string } | null>(null);

  useEffect(() => {
    if (payment !== "upi") return;
    const interval = setInterval(() => {
      setPaymentTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [payment]);
  
  const { data: windows } = useQuery(deliveryWindowsQuery);
  const [slot, setSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Delivery Speed & Turnaround (Express 30-45 mins vs Morning Harbour Scheduled)
  const [deliverySpeed, setDeliverySpeed] = useState<"express" | "scheduled">("express");

  // FreshCash Loyalty & Referral Wallet
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [appliedReferral, setAppliedReferral] = useState<{ code: string; bonus: number } | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);

  const { data: userWallet } = useQuery({
    queryKey: ["customer-wallet", user?.id],
    queryFn: () => (user ? getOrCreateUserWallet(user.id) : null),
    enabled: Boolean(user),
  });

  const storeStatus = getStoreStatus(settings);
  const selectedHoliday = isDateHoliday(
    deliveryDate,
    (settings as SiteSettings)?.working_days,
    (settings as SiteSettings)?.custom_holidays
  );

  // Auto-adjust delivery date to next working date if store is closed or current selection is a holiday
  useEffect(() => {
    if (settings) {
      const status = getStoreStatus(settings);
      if (!status.isOpen && status.nextWorkingDate) {
        setDeliveryDate(status.nextWorkingDate);
      }
    }
  }, [settings]);

  const todaysWindows = (windows ?? []).filter((w) =>
    (w.weekdays ?? []).includes(new Date(`${deliveryDate}T00:00:00`).getDay()),
  );

  const freeOver = Number(settings?.free_delivery_over ?? 500);

  // Delivery Speed Express Surcharge
  const isExpressActive =
    fulfillment === "delivery" &&
    deliverySpeed === "express" &&
    ((settings as SiteSettings)?.express_delivery_enabled ?? true);
  const expressFee = isExpressActive ? Number((settings as SiteSettings)?.express_delivery_fee ?? 25) : 0;

  // Dynamic Delivery Fee
  let deliveryFee = 0;
  if (fulfillment === "delivery") {
    if (subtotal < freeOver) {
      const baseFee = Number(settings?.base_delivery_fee ?? settings?.delivery_fee ?? 40);
      const perKm = Number(settings?.per_km_charge ?? 0);
      deliveryFee = distanceKm ? baseFee + Math.round(distanceKm * perKm) : baseFee;
    }
    deliveryFee += expressFee;
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

  // Automated Marketing Campaigns & Cart Rules
  const { data: activeCampaigns = [] } = useQuery({
    queryKey: ["checkout-active-campaigns"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("marketing_campaigns")
          .select("*")
          .eq("is_active", true);
        if (error || !data) return [];
        return data as MarketingCampaign[];
      } catch {
        return [];
      }
    },
  });

  const autoCartReward = !appliedPromo
    ? evaluateCartRewardRule(subtotal, activeCampaigns)
    : { eligible: false, discountAmount: 0, title: "" };
  const autoRewardDiscount = autoCartReward.eligible ? autoCartReward.discountAmount : 0;

  // FreshCash Wallet calculations
  const walletEnabled = (settings as SiteSettings)?.wallet_enabled ?? true;
  const maxBurnPercent = Number((settings as SiteSettings)?.max_wallet_burn_percent ?? 50);
  const availableWalletBal = Number(userWallet?.balance || 0);
  const maxRedeemableFreshCash = calculateMaxRedeemable(availableWalletBal, subtotal, maxBurnPercent);
  const walletDiscount = useWalletBalance && walletEnabled ? maxRedeemableFreshCash : 0;
  const referralDiscount = appliedReferral ? appliedReferral.bonus : 0;

  const discount = (appliedPromo?.discount ?? 0) + autoRewardDiscount + referralDiscount;
  const total = Math.max(0, subtotal - discount - walletDiscount + deliveryFee + gstAmount);

  async function applyReferralCode() {
    if (!referralInput.trim()) return;
    setValidatingReferral(true);
    try {
      const res = await validateReferralCode(referralInput, user?.id);
      if (res.valid) {
        const bonus = Number((settings as SiteSettings)?.referral_reward_referee ?? 50);
        setAppliedReferral({ code: referralInput.trim().toUpperCase(), bonus });
        toast.success(`Referral code ${referralInput.trim().toUpperCase()} applied! -${inr(bonus)} discount`);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Could not validate referral code");
    } finally {
      setValidatingReferral(false);
    }
  }

  function removeReferralCode() {
    setAppliedReferral(null);
    setReferralInput("");
  }

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

      if (data.valid_from && new Date(data.valid_from).getTime() > Date.now()) {
        toast.error("This coupon offer has not started yet");
        setValidatingCoupon(false);
        return;
      }

      if (data.valid_to && new Date(data.valid_to).getTime() < Date.now()) {
        toast.error("This coupon offer has expired");
        setValidatingCoupon(false);
        return;
      }

      let discountVal = 0;
      if (data.discount_type === "percentage" || data.discount_type === "percent") {
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
        setCustomerLat(latitude);
        setCustomerLng(longitude);
        if (hubLat && hubLng) {
          const d = calculateDistanceKm(hubLat, hubLng, latitude, longitude);
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
    if (!storeStatus.canAcceptOrder) {
      toast.error(storeStatus.statusDescription || "Store is closed and not accepting orders right now.");
      return;
    }
    if (selectedHoliday.isHoliday) {
      toast.error(`Store is closed on ${deliveryDate} (${selectedHoliday.reason}). Please select an open date.`);
      return;
    }

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

    // Pre-flight live stock check before processing payment or creating order
    const stockCheck = await checkCartStockAvailability(items);
    if (!stockCheck.available) {
      toast.error(stockCheck.message || "Some items in your cart are currently out of stock.");
      setSaving(false);
      return;
    }

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
    const finalSlot =
      fulfillment === "delivery"
        ? deliverySpeed === "express"
          ? `⚡ Express (30–${(settings as SiteSettings)?.express_sla_mins || 35} Mins Priority Dispatch)`
          : slot || null
        : null;

    const orderNotes = [
      activeBranch ? `Hub: ${activeBranch.name} (${activeBranch.code})` : "",
      notes.trim(),
      upiUtr ? `UPI UTR: ${upiUtr}` : "",
      upiScreenshot ? "Payment Screenshot Proof Attached" : "",
      appliedReferral ? `Referral: ${appliedReferral.code} (-${inr(appliedReferral.bonus)})` : "",
      walletDiscount > 0 ? `FreshCash Redeemed: -${inr(walletDiscount)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    // Ensure doorstep GPS coordinates are accurate: auto-geocode if not manually pinned
    let finalLat = customerLat;
    let finalLng = customerLng;
    if (fulfillment === "delivery" && (!finalLat || !finalLng) && address.trim().length >= 4) {
      try {
        const geo = await forwardGeocodeAddress(address);
        if (geo) {
          finalLat = geo.lat;
          finalLng = geo.lng;
          setCustomerLat(geo.lat);
          setCustomerLng(geo.lng);
        }
      } catch {
        // Continue with null if offline
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_email: email.trim() || null,
        customer_address: fulfillment === "delivery" ? address : null,
        location_lat: fulfillment === "delivery" ? finalLat : null,
        location_lng: fulfillment === "delivery" ? finalLng : null,
        items: items as unknown as Database["public"]["Tables"]["orders"]["Insert"]["items"],
        subtotal,
        delivery_fee: deliveryFee,
        gst_amount: gstAmount,
        discount,
        coupon_code: appliedPromo?.code ?? (autoCartReward.eligible ? "AUTO_CART_REWARD" : (appliedReferral?.code || null)),
        total,
        status: "pending",
        payment_method: payment,
        payment_status: (payment === "upi" && upiUtr.length === 12) ? "paid" : "pending",
        actual_payment_ref: upiUtr || null,
        upi_paid: Boolean(payment === "upi" && upiUtr.length === 12),
        fulfillment_type: fulfillment,
        delivery_date: fulfillment === "delivery" ? deliveryDate : null,
        delivery_slot: finalSlot,
        notes: orderNotes || null,
        user_id: userId,
        created_by: userId,
        branch_id: activeBranch?.id || null,
      })
      .select("id, order_number")
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error("Could not place order. Please try again.");
      return;
    }

    playOrderSuccessChime();

    // Record campaign conversion if applicable
    if (autoCartReward.eligible && autoCartReward.campaignId) {
      void recordCampaignConversion(autoCartReward.campaignId, "A");
    } else if (appliedPromo?.code) {
      const codeUpper = appliedPromo.code.toUpperCase();
      const matchedCamp = activeCampaigns.find(
        (c) =>
          c.variant_a_code?.toUpperCase() === codeUpper ||
          c.variant_b_code?.toUpperCase() === codeUpper
      );
      if (matchedCamp) {
        const variant = matchedCamp.variant_b_code?.toUpperCase() === codeUpper ? "B" : "A";
        void recordCampaignConversion(matchedCamp.id, variant);
      }
    }

    // Deduct redeemed FreshCash from customer wallet
    if (walletDiscount > 0 && userId) {
      try {
        await redeemWalletBalance({
          userId,
          amount: walletDiscount,
          orderId: data.id,
        });
      } catch (wErr) {
        console.warn("Wallet deduction notice:", wErr);
      }
    }

    // Trigger FCM instant push confirmation
    try {
      await notifyOrderStatusChange({
        orderId: data.id,
        orderNumber: data.order_number ?? undefined,
        newStatus: "confirmed",
        customerName: cleanName,
      });
    } catch (fcmErr) {
      console.warn("FCM push notice:", fcmErr);
    }

    // Atomically reduce product stock (Server Function + RPC)
    const snapshotItems = [...items];
    await deductOrderStock(data.id, snapshotItems);

    // Trigger Transactional Order Confirmation Email with GST Invoice attachment
    const cleanEmail = email.trim();
    if (cleanEmail) {
      localStorage.setItem("fnf_email", cleanEmail);
      try {
        void sendOrderConfirmedEmailServer({
          data: { orderId: data.id, customerEmail: cleanEmail },
        });
      } catch (emailErr) {
        console.warn("Order confirmation email notice:", emailErr);
      }
    }

    localStorage.setItem("fnf_phone", phone);
    clear();

    // Securely provision customer One-Time Delivery PIN
    try {
      await registerOrderDeliveryPin(data.id, userId || "");
    } catch (pinErr) {
      console.warn("Delivery PIN provisioning notice:", pinErr);
    }

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
      ...(activeBranch?.name ? { branch_name: activeBranch.name } : {}),
    });
    toast.success("Order placed successfully!");
  }

  if (orderSuccess) {
    const waNumber = (settings?.support_phone || settings?.whatsapp_number || "919843061919").replace(/\D/g, "");
    const mapsLink = getGoogleMapsDirUrl(customerLat, customerLng, address);
    const waText = encodeURIComponent(
      `*Fish N Fresh — New Order Placed*\n\n` +
      `Order: #${orderSuccess.order_number}\n` +
      (orderSuccess.branch_name ? `Hub: ${orderSuccess.branch_name}\n` : "") +
      `Customer: ${orderSuccess.name} (${orderSuccess.phone})\n` +
      `Total: ${inr(orderSuccess.total)}\n` +
      `Payment: ${payment.toUpperCase()}${upiUtr ? ` (UTR: ${upiUtr})` : ""}\n` +
      `Fulfillment: ${fulfillment === "delivery" ? `Delivery to: ${address}` : "Self Pickup"}\n` +
      (fulfillment === "delivery" && mapsLink ? `📍 Navigation: ${mapsLink}\n` : "") +
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
            {orderSuccess.branch_name && (
              <div className="flex justify-between border-b pb-2 text-xs">
                <span className="text-muted-foreground">Fulfillment Hub</span>
                <span className="font-semibold text-primary">{orderSuccess.branch_name}</span>
              </div>
            )}
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

          {/* Customer Secret Delivery PIN Card */}
          <CustomerDeliveryPinCard orderId={orderSuccess.id} fulfillmentType={fulfillment} />

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
                <WhatsAppIcon className="mr-2 size-4" /> Send Confirmation on WhatsApp
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

  const upiId = settings?.upi_id || "9843061919@upi";
  const upiName = settings?.upi_name || "Fish N Fresh";
  const upiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR&tn=${encodeURIComponent("Fish N Fresh Seafood")}`;
  const gpayDeepLink = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR&tn=${encodeURIComponent("Fish N Fresh Seafood")}`;
  const phonepeDeepLink = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR&tn=${encodeURIComponent("Fish N Fresh Seafood")}`;
  const paytmDeepLink = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${total}&cu=INR&tn=${encodeURIComponent("Fish N Fresh Seafood")}`;
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiDeepLink)}`;

  return (
    <AppShell>
      {!storeStatus.canAcceptOrder ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive dark:border-destructive/50">
          <AlertTriangle className="size-5 shrink-0 mt-0.5 text-destructive" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-destructive">{storeStatus.statusTitle}</p>
            <p className="opacity-90">{storeStatus.statusDescription}</p>
            {storeStatus.isLunchBreak ? (
              <p className="font-semibold pt-1">
                Orders will resume today at <span className="underline">{storeStatus.lunchEndFormatted}</span>. Your cart items are saved!
              </p>
            ) : (
              <p className="font-semibold pt-1">
                New orders are paused. Next ordering window opens on <span className="underline">{storeStatus.nextWorkingDate}</span> at {storeStatus.openTimeFormatted}.
              </p>
            )}
          </div>
        </div>
      ) : !storeStatus.isOpen ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-800 dark:text-amber-300">
                {storeStatus.statusTitle}
              </span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                Pre-Orders Open
              </span>
            </div>
            <p className="opacity-90">{storeStatus.statusDescription}</p>
            <p className="font-medium pt-1 text-primary">
              Your order will be freshly cut, packed, and delivered on <span className="underline font-bold">{storeStatus.nextWorkingDate}</span>.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2 font-medium">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Store Open ({storeStatus.openTimeFormatted} – {storeStatus.closeTimeFormatted})</span>
          </div>
          <span className="text-[11px] opacity-75 hidden sm:inline">Fresh catch delivered today</span>
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

      {/* Fulfillment Hub Card */}
      {activeBranch && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/5 p-3 sm:p-3.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Store className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Fulfilling Hub</p>
                <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary bg-primary/10">
                  {activeBranch.delivery_radius_km} km zone
                </Badge>
              </div>
              <p className="font-bold text-foreground text-xs sm:text-sm truncate">{activeBranch.name}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLocationModalOpen(true)}
            className="h-8 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 rounded-xl shrink-0"
          >
            Change Hub
          </Button>
        </div>
      )}

      {/* Delivery Radius Boundary Advisory */}
      {fulfillment === "delivery" && distanceKm !== null && activeBranch && distanceKm > (activeBranch.delivery_radius_km || 15) && (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-800 dark:text-amber-300">
              Distance Advisory (~{distanceKm.toFixed(1)} km)
            </p>
            <p className="opacity-90 leading-relaxed">
              Your doorstep is located beyond this hub's standard {activeBranch.delivery_radius_km || 12} km express delivery radius. Fulfilling your order may take extra transit turnaround time.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="mt-1 rounded-xl"
            placeholder="10-digit mobile number"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="email">Email Address</Label>
            <span className="text-[11px] text-muted-foreground">For GST Tax Invoice &amp; Live Tracking</span>
          </div>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 rounded-xl"
            placeholder="e.g. yourname@gmail.com"
          />
        </div>
        {fulfillment === "delivery" && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="address" className="font-semibold text-xs sm:text-sm">
                Delivery Address & Pincode *
              </Label>
              <div className="flex items-center gap-2">
                {customerLat && customerLng && (
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    📍 Pinned
                  </span>
                )}
                {distanceKm && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    📍 {distanceKm.toFixed(1)} km from store
                  </span>
                )}
              </div>
            </div>

            <AddressBook 
              selectedAddress={address} 
              onSelect={async (addr, lat, lng) => {
                setAddress(addr);
                let finalLat = lat ?? null;
                let finalLng = lng ?? null;
                if (!finalLat || !finalLng) {
                  setFetchingLocation(true);
                  try {
                    const geo = await forwardGeocodeAddress(addr);
                    if (geo) {
                      finalLat = geo.lat;
                      finalLng = geo.lng;
                    }
                  } finally {
                    setFetchingLocation(false);
                  }
                }
                setCustomerLat(finalLat);
                setCustomerLng(finalLng);
                if (hubLat && hubLng && finalLat && finalLng) {
                  const road = await getOsrmRoadRoute(hubLat, hubLng, finalLat, finalLng);
                  setDistanceKm(road.distanceKm);
                }
              }} 
            />

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPinPickerOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5 h-8 border-primary/40 text-primary hover:bg-primary/10 bg-primary/5 shadow-2xs"
              >
                <MapPin className="size-3.5 text-primary" />
                <span>{customerLat && customerLng ? "Adjust Doorstep Pin on Map" : "📍 Pin Exact Doorstep on Map"}</span>
              </Button>

              {customerLat && customerLng && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  {customerLat.toFixed(4)}, {customerLng.toFixed(4)}
                </span>
              )}
            </div>

            <Textarea
              id="address"
              rows={2}
              placeholder="Full address with flat/house no, street, landmark, and 6-digit pincode…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={async () => {
                if (!customerLat && !customerLng && address.trim().length >= 6) {
                  setFetchingLocation(true);
                  try {
                    const geo = await forwardGeocodeAddress(address);
                    if (geo) {
                      setCustomerLat(geo.lat);
                      setCustomerLng(geo.lng);
                      if (hubLat && hubLng) {
                        const road = await getOsrmRoadRoute(hubLat, hubLng, geo.lat, geo.lng);
                        setDistanceKm(road.distanceKm);
                      }
                      toast.info(`📍 Doorstep located near ${geo.displayName.slice(0, 35)}…`);
                    }
                  } finally {
                    setFetchingLocation(false);
                  }
                }
              }}
              className="mt-1 rounded-xl text-xs sm:text-sm resize-none"
            />
            {fetchingLocation && (
              <p className="text-[11px] text-primary animate-pulse flex items-center gap-1.5 pt-0.5 font-medium">
                <span className="size-1.5 rounded-full bg-primary animate-ping" />
                Auto-detecting exact doorstep GPS coordinates from address…
              </p>
            )}
          </div>
        )}

        {/* Delivery Speed / Turnaround Selector */}
        {fulfillment === "delivery" && (
          <div className="space-y-2.5 rounded-2xl border border-border bg-muted/20 p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Zap className="size-4 text-amber-500 fill-amber-500" /> Delivery Speed & Turnaround
              </Label>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                Express SLA
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Express Delivery Option */}
              <button
                type="button"
                onClick={() => {
                  setDeliverySpeed("express");
                }}
                className={`relative rounded-xl border p-3 text-left transition-all flex items-start gap-2.5 ${
                  deliverySpeed === "express"
                    ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 shadow-xs ring-1 ring-amber-500"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="size-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="size-4.5 fill-current" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-foreground">
                      ⚡ Express ({(settings as SiteSettings)?.express_sla_mins || 35} Mins)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      +{inr(Number((settings as SiteSettings)?.express_delivery_fee ?? 25))}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Fastest SLA · Packed on crushed ice & dispatched immediately
                  </p>
                </div>
              </button>

              {/* Scheduled Morning Harbour Slot Option */}
              <button
                type="button"
                onClick={() => {
                  setDeliverySpeed("scheduled");
                  setSlot("");
                }}
                className={`relative rounded-xl border p-3 text-left transition-all flex items-start gap-2.5 ${
                  deliverySpeed === "scheduled"
                    ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/30 shadow-xs ring-1 ring-sky-500"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-foreground">
                      🌅 Scheduled Slot
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Morning 06:30 AM & 02:00 PM harbour boat catch arrival slots
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}
        
        {/* Date & Slot selection (shown if pickup or scheduled delivery) */}
        {(fulfillment === "pickup" || deliverySpeed === "scheduled") && (
          <div>
            <Label htmlFor="delivery-date">
              {fulfillment === "pickup" ? "Pickup day & time" : "Delivery day & time slot"}
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
          {selectedHoliday.isHoliday && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Store closed on selected date</p>
                <p className="mt-0.5">
                  We are closed for {selectedHoliday.reason}. Please select a working day (Next available:{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryDate(storeStatus.nextWorkingDate);
                      setSlot("");
                    }}
                    className="font-bold underline hover:opacity-80"
                  >
                    {storeStatus.nextWorkingDate}
                  </button>
                  ).
                </p>
              </div>
            </div>
          )}
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
      )}

        {/* FreshCash Loyalty Wallet Balance Redemption */}
        {walletEnabled && availableWalletBal > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Wallet className="size-4 text-primary" /> FreshCash Loyalty Wallet
              </Label>
              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-mono">
                {inr(availableWalletBal)} Balance
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  Redeem FreshCash on this order
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Save up to {maxBurnPercent}% ({inr(maxRedeemableFreshCash)}) with your wallet credits
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={useWalletBalance ? "default" : "outline"}
                className="rounded-xl h-8 text-xs font-semibold shrink-0"
                onClick={() => setUseWalletBalance(!useWalletBalance)}
              >
                {useWalletBalance ? `Applied (-${inr(walletDiscount)})` : `Apply (-${inr(maxRedeemableFreshCash)})`}
              </Button>
            </div>
          </div>
        )}

        {/* Friend Referral Code Box */}
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Gift className="size-3.5 text-primary" /> Have a Friend's Referral / Invite Code?
          </Label>
          {appliedReferral ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5 border border-emerald-200 dark:border-emerald-900">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Invite Code {appliedReferral.code} Applied!
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Welcome bonus discount: -{inr(appliedReferral.bonus)}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={removeReferralCode}>
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter friend's code (e.g. FNF-8X2M9)"
                value={referralInput}
                onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                className="rounded-xl text-xs uppercase font-mono"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl shrink-0 text-xs"
                disabled={!referralInput.trim() || validatingReferral}
                onClick={applyReferralCode}
              >
                {validatingReferral ? "Checking..." : "Apply Code"}
              </Button>
            </div>
          )}
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
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">Scan & Pay via UPI (0% Fee)</span>
              <span className="text-xs font-bold text-primary">{inr(total)}</span>
            </div>

            {/* UPI Session Countdown Timer */}
            <div className="flex items-center justify-between text-xs rounded-xl bg-background/80 p-2.5 border border-border/60">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="size-3.5 text-primary" /> Session Active
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                    paymentTimerSeconds < 120
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 animate-pulse"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {Math.floor(paymentTimerSeconds / 60)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {(paymentTimerSeconds % 60)
                    .toString()
                    .padStart(2, "0")} remaining
                </span>
                {paymentTimerSeconds === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-1.5 text-primary"
                    onClick={() => setPaymentTimerSeconds(600)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* UPI QR Code Container */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-xl border shadow-2xs">
              <img
                src={upiQrUrl}
                alt="UPI QR Code"
                className="size-44 object-contain rounded-lg"
              />
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app
              </p>
            </div>

            {/* Store UPI ID & Copy */}
            <div className="flex items-center justify-between rounded-xl bg-background p-2.5 border text-xs">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] text-muted-foreground">Store Official UPI ID</p>
                <p className="font-mono font-medium truncate">{upiId}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs rounded-lg shrink-0 gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(upiId);
                  toast.success("UPI ID copied to clipboard!");
                }}
              >
                <Copy className="size-3" /> Copy ID
              </Button>
            </div>

            {/* Direct 1-Tap UPI App Deep Links for Mobile */}
            <div className="space-y-1.5 pt-0.5 sm:hidden">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Or Pay Directly Using Installed App:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-semibold border-border hover:border-primary/40 gap-1.5"
                  onClick={() => {
                    window.location.href = gpayDeepLink;
                  }}
                >
                  <span>Google Pay</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-semibold border-border hover:border-primary/40 gap-1.5"
                  onClick={() => {
                    window.location.href = phonepeDeepLink;
                  }}
                >
                  <span>PhonePe</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-semibold border-border hover:border-primary/40 gap-1.5"
                  onClick={() => {
                    window.location.href = paytmDeepLink;
                  }}
                >
                  <span>Paytm</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
                  onClick={() => {
                    window.location.href = upiDeepLink;
                  }}
                >
                  <Smartphone className="size-3.5" />
                  <span>Any UPI App</span>
                </Button>
              </div>
            </div>

            {/* 12-Digit UTR Input with real-time validation */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="upi-utr" className="text-xs font-semibold">
                  12-Digit UPI Transaction / UTR No.
                </Label>
                {upiUtr.length === 12 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" /> 12-Digit UTR Valid
                  </span>
                ) : upiUtr.length > 0 ? (
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                    {upiUtr.length}/12 digits
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Optional but recommended</span>
                )}
              </div>
              <Input
                id="upi-utr"
                placeholder="e.g. 423456789012"
                value={upiUtr}
                onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className={`rounded-xl bg-background font-mono text-sm tracking-wider ${
                  upiUtr.length === 12 ? "border-emerald-500 ring-1 ring-emerald-500/30" : ""
                }`}
              />
              <p className="text-[10px] text-muted-foreground">
                Enter your 12-digit UTR from GPay/PhonePe/Paytm to instantly verify and expedite packing.
              </p>
            </div>

            {/* Payment Screenshot Proof Attachment */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Payment Screenshot Proof</Label>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>
              {upiScreenshot ? (
                <div className="relative flex items-center gap-3 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <img
                    src={upiScreenshot}
                    alt="Payment Proof"
                    className="size-11 object-cover rounded-lg border border-border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
                      Screenshot Attached
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Will be verified by the packing counter
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setUpiScreenshot(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-border hover:border-primary/50 bg-background cursor-pointer text-xs text-muted-foreground hover:text-primary transition">
                  <Upload className="size-3.5" />
                  <span>Attach payment receipt screenshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("File is too large. Max 5MB allowed.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setUpiScreenshot(evt.target?.result as string);
                          toast.success("Payment screenshot attached!");
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <Row label="Subtotal" value={inr(subtotal)} />
        {appliedPromo && appliedPromo.discount > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400 font-medium text-xs sm:text-sm">
            <span>Coupon Discount ({appliedPromo.code})</span>
            <span>-{inr(appliedPromo.discount)}</span>
          </div>
        )}
        {autoCartReward.eligible && autoRewardDiscount > 0 && !appliedPromo && (
          <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <Gift className="size-3.5" /> {autoCartReward.title}
            </span>
            <span>-{inr(autoRewardDiscount)}</span>
          </div>
        )}
        {appliedReferral && appliedReferral.bonus > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium text-xs sm:text-sm">
            <span>Referral Welcome Bonus ({appliedReferral.code})</span>
            <span>-{inr(appliedReferral.bonus)}</span>
          </div>
        )}
        {walletDiscount > 0 && (
          <div className="flex justify-between text-primary font-semibold text-xs sm:text-sm">
            <span className="flex items-center gap-1">
              <Wallet className="size-3" /> FreshCash Redeemed
            </span>
            <span>-{inr(walletDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            Delivery Fee
            {isExpressActive && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] py-0 px-1 font-mono">
                ⚡ Express
              </Badge>
            )}
          </span>
          <span className="font-medium">{deliveryFee === 0 ? "Free" : inr(deliveryFee)}</span>
        </div>
        {gstAmount > 0 && <Row label="GST (Smart Calculation)" value={inr(gstAmount)} />}
        <div className="flex justify-between border-t border-border pt-2 font-display text-lg font-bold">
          <span>Total</span>
          <span>{inr(total)}</span>
        </div>
      </div>

      <Button
        className="mt-4 w-full rounded-xl text-sm font-semibold"
        disabled={saving || !storeStatus.canAcceptOrder || selectedHoliday.isHoliday}
        onClick={placeOrder}
      >
        {saving
          ? "Placing order…"
          : !storeStatus.canAcceptOrder
            ? `Orders Paused · ${storeStatus.statusTitle}`
            : selectedHoliday.isHoliday
              ? "Store Closed on Selected Date"
              : !storeStatus.isOpen
                ? `Place Pre-Order · ${inr(total)}`
                : `Place order · ${inr(total)}`}
      </Button>

      {/* Interactive Map Pin Picker Modal */}
      <MapPinPickerModal
        open={pinPickerOpen}
        onOpenChange={setPinPickerOpen}
        initialLat={customerLat}
        initialLng={customerLng}
        initialAddress={address}
        title="Pin Your Delivery Doorstep"
        onConfirm={async (geocoded) => {
          setAddress(geocoded.address);
          setCustomerLat(geocoded.lat);
          setCustomerLng(geocoded.lng);
          if (settings?.shop_lat && settings?.shop_lng) {
            const road = await getOsrmRoadRoute(
              settings.shop_lat,
              settings.shop_lng,
              geocoded.lat,
              geocoded.lng
            );
            setDistanceKm(road.distanceKm);
          }
        }}
      />
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
