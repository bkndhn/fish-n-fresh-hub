import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock,
  Fish,
  Home,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RotateCcw,
  ShoppingBag,
  Truck,
  AlertTriangle,
  ExternalLink,
  Compass,
  Route as RouteIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { CustomerDeliveryPinCard } from "@/components/CustomerDeliveryPinCard";
import { InlineDeliveryRouteMap } from "@/components/InlineDeliveryRouteMap";
import { getVerticalConfig } from "@/lib/verticals";

export const Route = createFileRoute("/track/$id")({
  head: () => ({
    meta: [
      { title: "Live Order & Delivery Tracking — Fish N Fresh" },
      { name: "description", content: "Real-time live status of your fresh seafood order, from cleaning to your doorstep." },
      { property: "og:title", content: "Live Order Tracking — Fish N Fresh" },
      { property: "og:description", content: "Follow your seafood order step by step with real-time ETA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: TrackPage,
});

const TRACK_STEPS = [
  { key: "pending", label: "Order Placed", desc: "Received at our fish counter", icon: ShoppingBag },
  { key: "confirmed", label: "Confirmed", desc: "Order approved by shop manager", icon: CheckCircle2 },
  { key: "cleaning", label: "Cleaning & Cutting", desc: "Fresh catch scaled, descaled & cut", icon: Fish },
  { key: "packed", label: "Iced & Packed", desc: "Sealed in insulated temperature pack", icon: PackageCheck },
  { key: "out_for_delivery", label: "Out for Delivery", desc: "Partner on the way to your doorstep", icon: Truck },
  { key: "delivered", label: "Delivered", desc: "Enjoy your fresh seafood feast!", icon: Home },
] as const;

function TrackPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);

  const { data: order, isLoading } = useQuery({
    queryKey: ["track", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for live delivery transitions
  useEffect(() => {
    const channel = supabase
      .channel(`track-order-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["track", id] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const currentStepIndex = useMemo(() => {
    if (!order) return 0;
    if (order.status === "cancelled") return -1;
    switch (order.status) {
      case "pending":
        return 0;
      case "confirmed":
        return 1;
      case "packed":
        return 3;
      case "out_for_delivery":
        return 4;
      case "delivered":
        return 5;
      default:
        return 1;
    }
  }, [order]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-24 text-center">
          <div className="mx-auto size-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-sm text-muted-foreground font-medium">Connecting to live delivery GPS…</p>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="py-20 text-center max-w-md mx-auto">
          <p className="text-base font-semibold text-foreground">Order Not Found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We could not locate this order. Please verify the link or sign in to your account.
          </p>
          <Button asChild className="mt-5 rounded-xl">
            <Link to="/orders">View My Orders</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const isOutForDelivery = order.status === "out_for_delivery";
  const progressPct = isCancelled ? 0 : Math.round((currentStepIndex / (TRACK_STEPS.length - 1)) * 100);

  const [routeModalOpen, setRouteModalOpen] = useState(false);

  const supportPhone = settings?.support_phone || settings?.whatsapp_number || "919999999999";
  const storeWhatsAppUrl = getWhatsAppUrl(
    settings?.whatsapp_number || settings?.support_phone || "",
    `Hi ${settings?.store_name || "Fish N Fresh"}, I'm tracking order #${order.order_number ?? order.id.slice(0, 8)} and need assistance.`
  );

  const mapNavigationUrl = getGoogleMapsDirUrl(
    order.location_lat,
    order.location_lng,
    order.customer_address,
    settings?.shop_lat,
    settings?.shop_lng
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 pb-12">
        {/* Header Title Card */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Order #{order.order_number ?? order.id.slice(0, 8)}
              </h1>
              <Badge
                variant={isCancelled ? "destructive" : isDelivered ? "default" : "secondary"}
                className="capitalize text-xs font-semibold"
              >
                {String(order.status).replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Placed on {formatIST(order.created_at)} ·{" "}
              <span className="capitalize font-medium text-foreground">{order.fulfillment_type}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" asChild>
              <Link to="/orders">All Orders</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              asChild
            >
              <a href={storeWhatsAppUrl} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="mr-1.5 size-4" /> Help on WhatsApp
              </a>
            </Button>
          </div>
        </div>

        {/* Customer Secret Delivery & Handover PIN Card (Visible ONLY to Customer) */}
        {!isCancelled && (
          <CustomerDeliveryPinCard
            orderId={order.id}
            orderStatus={order.status}
            fulfillmentType={order.fulfillment_type}
          />
        )}

        {/* Live Delivery Hero Card */}
        {isCancelled ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
            <AlertTriangle className="mx-auto size-8 text-rose-500 mb-2" />
            <h3 className="font-bold text-foreground">This Order Was Cancelled</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.cancel_reason || "If you were charged, a refund has been initiated to your original payment method."}
            </p>
          </div>
        ) : (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
            <CardContent className="p-6">
              {/* ETA Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    {isDelivered ? (
                      <CheckCircle2 className="size-6" />
                    ) : isOutForDelivery ? (
                      <Truck className="size-6 animate-bounce" />
                    ) : (
                      <Clock className="size-6 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {isDelivered
                        ? "Order Delivered Successfully!"
                        : isOutForDelivery
                        ? "Out For Delivery Right Now!"
                        : order.status === "packed"
                        ? "Packed on Ice & Ready for Dispatch"
                        : "Preparing Your Fresh Catch"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isDelivered
                        ? "Delivered to your doorstep fresh and chilled."
                        : order.eta_minutes
                        ? `Estimated arrival at your doorstep: ~${order.eta_minutes} minutes`
                        : "Our cutters are preparing your order with strict hygiene standards."}
                    </p>
                  </div>
                </div>

                {order.eta_minutes && !isDelivered && (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Live ETA</p>
                    <p className="text-xl font-bold font-display text-primary">~{order.eta_minutes} mins</p>
                  </div>
                )}
              </div>

              {/* Step Progress Tracker */}
              <div className="pt-6">
                {/* Horizontal Progress Bar for Desktop */}
                <div className="relative hidden sm:block">
                  <div className="absolute top-5 left-6 right-6 h-1 bg-muted rounded-full">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="relative flex justify-between">
                    {TRACK_STEPS.map((s, idx) => {
                      const isDone = idx <= currentStepIndex;
                      const isCurrent = idx === currentStepIndex;
                      const StepIcon = s.icon;
                      return (
                        <div key={s.key} className="flex flex-col items-center text-center max-w-[100px]">
                          <div
                            className={`flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                              isDone
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "border-border bg-card text-muted-foreground"
                            } ${isCurrent ? "ring-4 ring-primary/20 scale-110" : ""}`}
                          >
                            <StepIcon className="size-4.5" />
                          </div>
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              isDone ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {s.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground hidden md:block leading-tight mt-0.5">
                            {s.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Stepper for Mobile with Connected Lines */}
                <div className="sm:hidden space-y-0 relative pl-1">
                  {TRACK_STEPS.map((s, idx) => {
                    const isDone = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    const isLast = idx === TRACK_STEPS.length - 1;
                    const StepIcon = s.icon;
                    return (
                      <div key={s.key} className="flex items-start gap-3 relative pb-5 last:pb-1">
                        {/* Connecting vertical line */}
                        {!isLast && (
                          <div
                            className={`absolute left-4 top-8 bottom-0 w-0.5 -translate-x-1/2 transition-colors duration-500 ${
                              idx < currentStepIndex ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        )}

                        {/* Step Icon Badge */}
                        <div
                          className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            isDone
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-border bg-card text-muted-foreground"
                          } ${isCurrent ? "ring-4 ring-primary/25 scale-110" : ""}`}
                        >
                          <StepIcon className="size-4" />
                        </div>

                        {/* Step Label & Subtext */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold ${isDone ? "text-foreground" : "text-muted-foreground"}`}>
                              {s.label}
                            </p>
                            {isCurrent && !isDelivered && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-extrabold text-primary">
                                <span className="size-1.5 rounded-full bg-primary animate-ping" />
                                In Progress
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Interactive Delivery GPS Route Map (Swiggy / Zomato standard) */}
        {!isCancelled && order.fulfillment_type !== "pickup" && (
          <InlineDeliveryRouteMap
            storeLat={settings?.shop_lat ?? null}
            storeLng={settings?.shop_lng ?? null}
            storeAddress={settings?.store_address ?? "Store Hub"}
            destLat={order.location_lat ?? null}
            destLng={order.location_lng ?? null}
            destAddress={order.customer_address ?? undefined}
            customerName={order.customer_name}
            customerPhone={order.customer_phone}
            orderNumber={order.order_number ?? order.id.slice(0, 8)}
            etaMinutes={order.eta_minutes ?? null}
            driverName={order.driver_name}
            verticalEmoji={getVerticalConfig(settings?.business_vertical).emoji}
            onExpand={() => setRouteModalOpen(true)}
          />
        )}

        {/* Assigned Driver / Delivery Partner Card */}
        {order.driver_name && (
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-base">
                  {order.driver_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-foreground">{order.driver_name}</p>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Rider Partner
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Delivering in temperature-controlled bag
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <Button size="sm" variant="outline" className="rounded-xl h-8.5 text-xs font-semibold" asChild>
                  <a href={`tel:${supportPhone}`} className="flex items-center justify-center">
                    <Phone className="mr-1.5 size-3.5 text-primary" /> Call Rider
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl h-8.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                  asChild
                >
                  <a
                    href={getWhatsAppUrl(
                      supportPhone,
                      `Hi, I am customer of order #${order.order_number ?? order.id.slice(0, 8)}. Calling regarding delivery status.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center"
                  >
                    <WhatsAppIcon className="mr-1.5 size-4" /> WhatsApp
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Address & Payment Summary Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Destination Address Card */}
          <Card className="border-border/70 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" /> Delivery Destination
                </p>
                {order.location_lat && order.location_lng ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Exact Doorstep Pin
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {order.customer_address ?? "Store takeaway / self-pickup"}
              </p>
              {order.delivery_slot && (
                <p className="text-xs text-primary font-medium">Slot: {order.delivery_slot}</p>
              )}
              {order.delivery_note && (
                <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground italic">
                  Note: {order.delivery_note}
                </p>
              )}

              {/* Map & Live Route Quick Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 text-xs font-semibold px-2.5 text-primary border-primary/25 hover:bg-primary/5 flex-1"
                  onClick={() => setRouteModalOpen(true)}
                  title="View store-to-doorstep route with live ETA on interactive map"
                >
                  <RouteIcon className="size-3.5 mr-1.5 text-primary" /> View Live Route
                </Button>
                {mapNavigationUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 text-xs font-semibold px-2.5 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 shrink-0"
                    asChild
                  >
                    <a href={mapNavigationUrl} target="_blank" rel="noreferrer" title="Open turn-by-turn navigation in Google Maps">
                      <Compass className="size-3.5 mr-1 text-blue-500" /> Directions
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment & Total Card */}
          <Card className="border-border/70 shadow-xs">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Status
                </p>
                <Badge
                  variant={order.payment_status === "paid" ? "default" : "outline"}
                  className="capitalize text-[10px]"
                >
                  {order.payment_status}
                </Badge>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-border/50">
                <span className="text-sm font-medium text-muted-foreground">Total Order Value</span>
                <span className="text-xl font-bold font-display text-foreground">
                  {formatINR(Number(order.total))}
                </span>
              </div>

              {order.payment_method === "cod" && order.payment_status !== "paid" ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Cash on Delivery: Please keep exact cash of <strong>{formatINR(Number(order.total))}</strong> ready.
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Paid online via {order.payment_method?.toUpperCase()}. Contactless delivery available.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ordered Seafood Items */}
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Fish className="size-3.5 text-primary" /> Items in this Order ({(order.items as any[])?.length || 0})
            </p>
            <div className="divide-y divide-border/50">
              {((order.items as any[]) ?? []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-xs">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{it.name}</p>
                    <p className="text-muted-foreground">
                      Quantity: {it.qty} {it.unit || "kg"} {it.cut_preference ? `· ${it.cut_preference}` : ""}
                    </p>
                  </div>
                  <span className="font-bold text-foreground">{formatINR(Number(it.price) * Number(it.qty))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Delivery Route Modal */}
      <DeliveryRouteModal
        open={routeModalOpen}
        onOpenChange={setRouteModalOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        customerName={order.customer_name}
        customerPhone={order.customer_phone}
        customerAddress={order.customer_address}
        destinationLat={order.location_lat ?? null}
        destinationLng={order.location_lng ?? null}
        storeAddress={settings?.store_address ?? "Fish & Fresh Store"}
        storeLat={settings?.shop_lat ?? null}
        storeLng={settings?.shop_lng ?? null}
        verticalEmoji={getVerticalConfig(settings?.business_vertical).emoji}
      />
    </AppShell>
  );
}
export default TrackPage;

