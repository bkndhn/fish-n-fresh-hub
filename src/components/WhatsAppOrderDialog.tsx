import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
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
  AlertTriangle,
  Crosshair,
  MapPin,
  Copy,
  Check,
  Navigation,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { inr } from "@/lib/format";
import { useSessionUser } from "@/lib/session";
import {
  buildWhatsAppOrderMessage,
  getWhatsAppOrderDeepLink,
  recordWhatsAppOrderInCrm,
  getWhatsAppBusinessAutoReplyTemplate,
  type WhatsAppOrderSummary,
  type WhatsAppOrderItem,
} from "@/lib/whatsappOrdering";
import { isGstEnabled, type SiteSettings } from "@/lib/types";
import { reverseGeocodeNominatim, type GeocodedAddress } from "@/lib/maps";
import { MapPinPickerModal } from "@/components/MapPinPickerModal";

export interface WhatsAppDialogItem {
  productId: string;
  name: string;
  cutPreference?: string | undefined;
  qty: number;
  unit: string;
  price: number;
  totalPrice: number;
}

interface SavedAddressItem {
  id: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_default?: boolean;
}

interface WhatsAppOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: WhatsAppDialogItem[];
  subtotal: number;
  deliveryFee?: number;
  settings?: SiteSettings | null;
  onOrderDispatched?: () => void;
  excludedCount?: number;
}

export function WhatsAppOrderDialog({
  open,
  onOpenChange,
  items,
  subtotal,
  deliveryFee = 0,
  settings,
  onOrderDispatched,
  excludedCount = 0,
}: WhatsAppOrderDialogProps) {
  const { user } = useSessionUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressItem[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-Order Dispatched Confirmation State (including WhatsApp Business Auto-Reply sync)
  const [orderDispatchedData, setOrderDispatchedData] = useState<{
    orderNumber: string;
    autoReply: string;
    deepLink: string;
    customerPhone: string;
    navLink: string | null;
  } | null>(null);
  const [copiedAutoReply, setCopiedAutoReply] = useState(false);

  // Pre-fill user data and saved addresses
  useEffect(() => {
    if (open) {
      const savedPhone = localStorage.getItem("fnf_phone") || "";
      const savedName = localStorage.getItem("fnf_name") || "";
      const savedAddress = localStorage.getItem("fnf_address") || "";
      const savedLat = localStorage.getItem("fnf_lat");
      const savedLng = localStorage.getItem("fnf_lng");

      setName(user?.user_metadata?.["full_name"] || savedName || "");
      setPhone(user?.phone || user?.user_metadata?.["phone"] || savedPhone || "");
      setAddress(savedAddress || "");
      if (savedLat && savedLng) {
        const parsedLat = parseFloat(savedLat);
        const parsedLng = parseFloat(savedLng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          setCoords({ lat: parsedLat, lng: parsedLng });
        }
      } else {
        setCoords(null);
      }
      setPreferredDate(new Date().toISOString().split("T")[0] ?? "");
      setOrderDispatchedData(null);
      setCopiedAutoReply(false);

      // Load saved addresses from AddressBook localStorage
      try {
        const raw = localStorage.getItem("fishnfresh_saved_addresses_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedAddresses(parsed);
          }
        }
      } catch {
        // ignore parse error
      }
    }
  }, [open, user]);

  const isGstActive = isGstEnabled(settings);
  const effectiveDeliveryFee = fulfillment === "pickup" ? 0 : deliveryFee;
  const netTotal = subtotal + effectiveDeliveryFee;
  const targetStorePhone =
    settings?.whatsapp_order_phone ||
    settings?.contact_phone ||
    settings?.whatsapp_number ||
    "9843061919";

  // 1. Live GPS Location Fetch & Reverse Geocode Auto-fill
  const handleLocateMe = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        localStorage.setItem("fnf_lat", String(lat));
        localStorage.setItem("fnf_lng", String(lng));

        toast.info("GPS coordinates locked! Fetching doorstep address...");
        try {
          const geocoded = await reverseGeocodeNominatim(lat, lng);
          if (geocoded?.displayName) {
            setAddress(geocoded.displayName);
            localStorage.setItem("fnf_address", geocoded.displayName);
            toast.success("Doorstep address auto-filled from live GPS!");
          } else {
            toast.success(`Doorstep GPS attached (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        } catch {
          toast.success(`Doorstep GPS attached (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = "Could not fetch GPS location";
        if (err.code === 1) msg = "Location permission denied. Please allow GPS access in your browser.";
        else if (err.code === 2) msg = "Location unavailable. Please verify device GPS is active.";
        else if (err.code === 3) msg = "Location request timed out.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  // 2. Map Pin Picker Confirmation
  const handlePinConfirm = (data: GeocodedAddress) => {
    setCoords({ lat: data.lat, lng: data.lng });
    setAddress(data.displayName || data.address);
    localStorage.setItem("fnf_lat", String(data.lat));
    localStorage.setItem("fnf_lng", String(data.lng));
    localStorage.setItem("fnf_address", data.displayName || data.address);
    setPinPickerOpen(false);
    toast.success("Doorstep map pin attached to order!");
  };

  // 3. Saved Address Chip Quick Select
  const handleSelectSavedAddress = (item: SavedAddressItem) => {
    setSelectedAddressId(item.id);
    setAddress(item.address);
    if (item.lat && item.lng) {
      setCoords({ lat: item.lat, lng: item.lng });
      localStorage.setItem("fnf_lat", String(item.lat));
      localStorage.setItem("fnf_lng", String(item.lng));
    } else {
      setCoords(null);
    }
    localStorage.setItem("fnf_address", item.address);
    toast.success(`Loaded saved address: ${item.label}`);
  };

  // 4. Send Order Handler
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

      const storePhone = targetStorePhone;
      const storeName = settings?.store_name || "Fish N Fresh Hub";
      const orderNumber = `WA-${Date.now().toString().slice(-6)}`;
      const navLink = coords?.lat && coords?.lng ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : null;

      const orderSummary: WhatsAppOrderSummary = {
        orderNumber,
        storeName,
        storePhone,
        customer: {
          name: name.trim(),
          phone: cleanPhone,
          address: fulfillment === "delivery" ? address.trim() : undefined,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          googleMapsLink: navLink ?? undefined,
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
      const autoReply = getWhatsAppBusinessAutoReplyTemplate(orderSummary, orderNumber);

      // Record in Supabase CRM with lat, lng, map_link, and itemization
      const crmRes = await recordWhatsAppOrderInCrm(orderSummary);

      toast.success(
        crmRes.success
          ? `Order #${orderNumber} recorded! Opening WhatsApp...`
          : "Opening WhatsApp with your order..."
      );

      // Open WhatsApp chat in new window/tab
      window.open(deepLink, "_blank");

      if (onOrderDispatched) {
        onOrderDispatched();
      }

      // Transition dialog to post-order confirmation & WhatsApp Business auto-reply sync view
      setOrderDispatchedData({
        orderNumber,
        autoReply,
        deepLink,
        customerPhone: cleanPhone,
        navLink,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate WhatsApp order";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAutoReply = () => {
    if (!orderDispatchedData?.autoReply) return;
    navigator.clipboard.writeText(orderDispatchedData.autoReply);
    setCopiedAutoReply(true);
    toast.success("WhatsApp Business Auto-Reply template copied to clipboard!");
    setTimeout(() => setCopiedAutoReply(false), 3000);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          {/* Post-Order Dispatch Confirmation & WhatsApp Business Auto-Reply Sync Screen */}
          {orderDispatchedData ? (
            <div className="space-y-4 pt-2">
              <div className="text-center space-y-2">
                <div className="size-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <Badge className="bg-emerald-600 text-white font-mono text-xs px-2.5 py-0.5">
                    Order Ref: #{orderDispatchedData.orderNumber}
                  </Badge>
                  <h3 className="text-lg font-bold text-foreground mt-2">
                    WhatsApp Order Sent!
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Your itemized order details, live navigation link, and cut specifications have been sent to our store desk on WhatsApp.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Re-Open & Live Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(orderDispatchedData.deepLink, "_blank")}
                  className="rounded-xl h-10 text-xs font-semibold gap-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <MessageSquare className="size-4 text-emerald-600" />
                  Re-Open WhatsApp Chat
                </Button>
                <Button
                  type="button"
                  asChild
                  className="rounded-xl h-10 text-xs font-bold gap-2 bg-primary"
                >
                  <Link to="/orders" search={{ phone: orderDispatchedData.customerPhone }}>
                    <Navigation className="size-3.5" />
                    Track Order Live
                  </Link>
                </Button>
              </div>

              {/* Doorstep Navigation Link Pill if attached */}
              {orderDispatchedData.navLink && (
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[240px]">Live Doorstep GPS Navigation Link Attached</span>
                  </div>
                  <a
                    href={orderDispatchedData.navLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0"
                  >
                    Test Map Link
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              )}

              {/* WhatsApp Business Account Auto-Reply Option & Template */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                    <Sparkles className="size-4 text-emerald-600" />
                    <span className="font-bold">WhatsApp Business Auto-Reply Sync</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-black/40">
                    Store Operator Tool
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  If operating this store on <strong>WhatsApp Business</strong>, copy this auto-reply message to confirm receipt with live order tracking:
                </p>
                <div className="relative">
                  <pre className="p-3 rounded-xl bg-background border border-border font-sans text-[11px] text-foreground leading-relaxed whitespace-pre-wrap select-all max-h-40 overflow-y-auto">
                    {orderDispatchedData.autoReply}
                  </pre>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyAutoReply}
                    className="absolute top-2 right-2 rounded-lg text-xs h-7 px-2.5 gap-1.5 shadow-xs"
                  >
                    {copiedAutoReply ? (
                      <>
                        <Check className="size-3 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy Auto-Reply</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  💡 Tip: Set this in WhatsApp Business app &rarr; Settings &rarr; Quick Replies with shortcut <code>/confirm</code>.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl h-10 text-xs font-semibold"
                >
                  Done &amp; Return to Store
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Main WhatsApp Order Builder Screen */
            <>
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
                      Itemized catch details, cut styles, and doorstep GPS navigation link sent directly to store WhatsApp.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Target Store WhatsApp Receiving Desk Banner */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      WA
                    </div>
                    <div>
                      <p className="font-bold text-xs">Store WhatsApp Desk</p>
                      <p className="text-[10px] opacity-80">Order will be dispatched to this chat</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-white/80 dark:bg-black/40">
                    +{targetStorePhone.replace(/\D/g, "")}
                  </Badge>
                </div>

                {/* Out-of-Stock Exclusions Notice */}
                {excludedCount > 0 && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p>
                      Ordering <strong>{items.length} available items</strong>. {excludedCount} out-of-stock item{excludedCount > 1 ? "s were" : " was"} excluded.
                    </p>
                  </div>
                )}

                {/* Itemized Available Items Review */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Itemized Catch Details ({items.length} item{items.length === 1 ? "" : "s"})
                    </Label>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {inr(subtotal)}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-2xl border border-border/80 bg-muted/20 p-2.5 divide-y divide-border/40">
                    {items.map((it) => (
                      <div key={it.productId + (it.cutPreference || "")} className="pt-1.5 first:pt-0 flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground truncate">{it.name}</span>
                            {it.cutPreference && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal bg-background/80">
                                {it.cutPreference}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {it.qty} {it.unit} × {inr(it.price)} / {it.unit}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-foreground shrink-0">{inr(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>

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

                {/* Delivery Address with Live GPS Fetch, Pin on Map & Saved Address Chips */}
                {fulfillment === "delivery" && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <Label htmlFor="wa_address" className="text-xs font-semibold">
                        Delivery Address *
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleLocateMe}
                          disabled={isLocating}
                          className="h-7 px-2 text-[11px] rounded-lg gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Fetch GPS coordinates & auto-fill address"
                        >
                          {isLocating ? (
                            <Loader2 className="size-3 animate-spin text-emerald-600" />
                          ) : (
                            <Crosshair className="size-3 text-emerald-600" />
                          )}
                          <span>{isLocating ? "Locating..." : "Locate Me"}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPinPickerOpen(true)}
                          className="h-7 px-2 text-[11px] rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          title="Pick exact doorstep pin on interactive map"
                        >
                          <MapPin className="size-3" />
                          <span>Pin on Map</span>
                        </Button>
                      </div>
                    </div>

                    {/* Saved Address Quick Chips */}
                    {savedAddresses.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                          Saved:
                        </span>
                        {savedAddresses.map((saved) => (
                          <button
                            key={saved.id}
                            type="button"
                            onClick={() => handleSelectSavedAddress(saved)}
                            className={`shrink-0 text-[11px] px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                              selectedAddressId === saved.id
                                ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                                : "bg-card border-border/80 text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <MapPin className="size-2.5 opacity-70" />
                            <span>{saved.label || "Saved"}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <Textarea
                      id="wa_address"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setSelectedAddressId(null);
                      }}
                      placeholder="Door / Flat No, Street, Landmark, Area, City"
                      className="text-xs min-h-[64px] resize-none"
                    />

                    {/* GPS Coordinates Attached Badge */}
                    {coords && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/25 text-[11px] text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-1.5">
                          <Navigation className="size-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Doorstep GPS attached: <strong>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCoords(null);
                            localStorage.removeItem("fnf_lat");
                            localStorage.removeItem("fnf_lng");
                            toast.info("GPS coordinates detached");
                          }}
                          className="size-5 rounded-full hover:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300"
                          title="Remove GPS coordinates"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    )}
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
                  className="rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 shadow-xs"
                >
                  <MessageSquare className="size-4" />
                  {isSubmitting ? "Generating WhatsApp Link..." : `Send Order on WhatsApp (${inr(netTotal)})`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Map Pin Picker Modal */}
      {pinPickerOpen && (
        <MapPinPickerModal
          open={pinPickerOpen}
          onOpenChange={setPinPickerOpen}
          initialLat={coords?.lat}
          initialLng={coords?.lng}
          initialAddress={address}
          title="Pin Doorstep on Map for WhatsApp Order"
          confirmLabel="Attach Doorstep Pin"
          onConfirm={handlePinConfirm}
        />
      )}
    </>
  );
}
