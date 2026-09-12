import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarClock,
  Check,
  MessageCircle,
  Phone,
  Truck,
  Undo2,
  MapPin,
  Navigation,
  Compass,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Clock,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Search,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, ORDER_STATUSES, myRolesQuery, type OrderRow } from "@/lib/admin";
import { cancelAndRefundOrder } from "@/lib/refunds.functions";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Tracking | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Track every Fish N Fresh delivery status and send progress updates to customers on WhatsApp.",
      },
      { property: "og:title", content: "Delivery Tracking | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Follow each order from packing to doorstep and message customers with one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryTracking,
});

const FLOW = ORDER_STATUSES.filter((s) => s !== "cancelled");

const STATUS_MESSAGE: Record<string, string> = {
  confirmed: "we have confirmed your order",
  packed: "your order is packed and iced, ready to leave the shop",
  out_for_delivery: "your order is out for delivery and will reach you shortly",
  delivered: "your order has been delivered. Thank you for shopping with us!",
};

function defaultMessage(order: OrderRow) {
  const ref = order.order_number ?? order.id.slice(0, 8);
  const line = STATUS_MESSAGE[order.status] ?? `your order status is now ${order.status.replace(/_/g, " ")}`;
  return `Hi ${order.customer_name}, ${line}. Order ${ref} · ${formatINR(Number(order.total))} — Fish N Fresh`;
}

function DeliveryTracking() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"all" | "confirmed" | "packed" | "out_for_delivery" | "delivered">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState("");
  const [driverName, setDriverName] = useState("");
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const roles = useQuery(myRolesQuery);
  const isAdmin = (roles.data ?? []).includes("admin");
  const refundFn = useServerFn(cancelAndRefundOrder);

  const refund = useMutation({
    mutationFn: async (vars: { orderId: string; reason: string; refund: boolean }) => {
      const res = await refundFn({
        data: {
          orderId: vars.orderId,
          reason: vars.reason,
          refund: vars.refund,
          environment: isPaymentsConfigured() ? getStripeEnvironment() : "sandbox",
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      setCancelReason("");
      toast.success(res.note);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-delivery-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const active = useMemo(
    () => (orders.data ?? []).filter((o) => o.status !== "cancelled"),
    [orders.data]
  );

  const filteredOrders = useMemo(() => {
    return active.filter((o) => {
      if (stageFilter !== "all" && o.status !== stageFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (o.order_number ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.customer_name ?? "").toLowerCase().includes(q) ||
        (o.customer_phone ?? "").includes(q) ||
        (o.customer_address ?? "").toLowerCase().includes(q)
      );
    });
  }, [active, stageFilter, searchQuery]);

  const selected = active.find((o) => o.id === selectedId) ?? filteredOrders[0] ?? active[0] ?? null;

  useEffect(() => {
    if (selected) {
      setEta(selected.eta_minutes ? String(selected.eta_minutes) : "");
      setDriverName(selected.driver_name ?? "");
      setNote(selected.delivery_note ?? "");
      setMessage("");
    }
  }, [selected?.id]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OrderRow> }) => {
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function sendWhatsApp(order: OrderRow) {
    const text = (message.trim() || defaultMessage(order)).slice(0, 900);
    const phone = order.customer_phone.replace(/\D/g, "");
    const to = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    update.mutate({ id: order.id, patch: { whatsapp_sent: true } as Partial<OrderRow> });
    setMessage("");
  }

  const applyPresetMessage = (type: "dispatched" | "arrived" | "packed" | "cold_chain") => {
    if (!selected) return;
    const ref = selected.order_number ?? selected.id.slice(0, 8);
    const pin = (selected as any).delivery_pin || (selected as any).otp_code || selected.id.slice(-4).toUpperCase();
    const dName = driverName || selected.driver_name || "Assigned Dispatch Executive";
    const etaMins = eta || selected.eta_minutes || "25–35";

    let text = "";
    if (type === "dispatched") {
      text = `🚀 Hi ${selected.customer_name}! Your fresh seafood order #${ref} is OUT FOR DELIVERY with rider ${dName}. Estimated arrival in ~${etaMins} mins.\n\n🔑 Your Doorstep Verification PIN: *${pin}*\nPlease share this PIN with the rider to collect your order.`;
    } else if (type === "arrived") {
      text = `📍 Hi ${selected.customer_name}! Our delivery executive (${dName}) has ARRIVED at your address with order #${ref}. Please provide PIN *${pin}* to receive your cold-packed seafood!`;
    } else if (type === "packed") {
      text = `🧊 Hi ${selected.customer_name}! Your order #${ref} is PACKED & ICED in food-grade insulated boxes at 0–4°C. Ready for departure from our central cold hub!`;
    } else if (type === "cold_chain") {
      text = `🐟 Hi ${selected.customer_name}! Order #${ref} is 100% chemical-free morning harbour catch packed in crushed sea-ice. Track live status anytime on Fish N Fresh!`;
    }

    setMessage(text);
  };

  const confirmedCount = active.filter((o) => o.status === "confirmed").length;
  const packedCount = active.filter((o) => o.status === "packed").length;
  const outCount = active.filter((o) => o.status === "out_for_delivery").length;
  const deliveredCount = active.filter((o) => o.status === "delivered").length;

  return (
    <AdminShell title="Delivery Tracking & Dispatch Center" allow={["admin", "staff", "driver"]}>
      <div className="space-y-4">
        {/* Top KPI Pipeline Header */}
        <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-background to-teal-500/10 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
                <Truck className="size-5 text-sky-600 dark:text-sky-400" />
                Live Delivery Dispatch &amp; Doorstep Verification
              </h1>
              <p className="text-xs text-muted-foreground">
                Dispatch orders, verify customer PINs, open Google Maps directions, and notify customers via WhatsApp.
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto gap-1">
              <Clock className="size-3 text-sky-500" /> Live Pipeline
            </Badge>
          </div>

          {/* Quick Pipeline Status Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={() => setStageFilter("all")}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                stageFilter === "all"
                  ? "border-sky-500 bg-sky-500/10 shadow-xs"
                  : "border-border/70 bg-background/60 hover:bg-muted/60"
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground">All Orders</p>
              <p className="text-base font-black text-foreground mt-0.5">{active.length}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("confirmed")}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                stageFilter === "confirmed"
                  ? "border-amber-500 bg-amber-500/10 shadow-xs"
                  : "border-border/70 bg-background/60 hover:bg-muted/60"
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground">To Pack / Prepping</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">{confirmedCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("packed")}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                stageFilter === "packed"
                  ? "border-blue-500 bg-blue-500/10 shadow-xs"
                  : "border-border/70 bg-background/60 hover:bg-muted/60"
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground">Ready &amp; Packed</p>
              <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">{packedCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("out_for_delivery")}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                stageFilter === "out_for_delivery"
                  ? "border-purple-500 bg-purple-500/10 shadow-xs"
                  : "border-border/70 bg-background/60 hover:bg-muted/60"
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground">Out on Road</p>
              <p className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">{outCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("delivered")}
              className={`p-2.5 rounded-2xl border text-left transition-all ${
                stageFilter === "delivered"
                  ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                  : "border-border/70 bg-background/60 hover:bg-muted/60"
              }`}
            >
              <p className="text-[10px] font-semibold text-muted-foreground">Delivered Today</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{deliveredCount}</p>
            </button>
          </div>
        </div>

        {/* Main 2-Column Dispatch View */}
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* Left Column: Order Selection List */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search order #, customer, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 rounded-xl text-xs"
              />
            </div>

            <div className="max-h-[75vh] overflow-y-auto space-y-2 pr-0.5">
              {filteredOrders.map((o) => {
                const isSel = selected?.id === o.id;
                const statusColor =
                  o.status === "delivered"
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                    : o.status === "out_for_delivery"
                    ? "text-purple-700 dark:text-purple-300 bg-purple-500/15 border-purple-500/30"
                    : o.status === "packed"
                    ? "text-blue-700 dark:text-blue-300 bg-blue-500/15 border-blue-500/30"
                    : "text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/30";

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(o.id);
                    }}
                    className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                      isSel
                        ? "border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-foreground truncate">
                        {o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                      </span>
                      <Badge className={`shrink-0 text-[10px] font-semibold border ${statusColor}`}>
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatINR(Number(o.total))}</span>
                      <span className="capitalize">{o.fulfillment_type || "delivery"}</span>
                    </div>

                    {o.customer_address && (
                      <p className="mt-1 text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{o.customer_address}</span>
                      </p>
                    )}

                    <div className="mt-1.5 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{o.delivery_slot || "35–45 Mins Express"}</span>
                      {o.driver_name && (
                        <span className="font-medium text-foreground">Rider: {o.driver_name}</span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-xs rounded-2xl border border-dashed">
                  No orders match this filter.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Dispatch & Control Hub */}
          {selected ? (
            <Card className="rounded-3xl border-border/80 shadow-xs overflow-hidden">
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Header Information & Action Quick-Bar */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-xl font-bold text-foreground">
                        Order #{selected.order_number ?? selected.id.slice(0, 8)}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs uppercase">
                        {selected.fulfillment_type || "Delivery"}
                      </Badge>
                    </div>

                    <p className="text-sm font-semibold text-foreground mt-1">
                      {selected.customer_name} · <span className="font-mono text-muted-foreground">{selected.customer_phone}</span>
                    </p>

                    <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                      <MapPin className="size-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{selected.customer_address ?? "Pickup at Store Terminal"}</span>
                    </p>

                    <p className="mt-1 text-xs font-semibold text-primary flex items-center gap-1">
                      <CalendarClock className="size-3.5" />
                      {selected.delivery_date
                        ? `${new Date(`${selected.delivery_date}T00:00:00`).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}${selected.delivery_slot ? ` · ${selected.delivery_slot}` : ""}`
                        : selected.delivery_slot ?? "Express 35-minute delivery"}
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="font-display text-xl font-black text-foreground">
                        {formatINR(Number(selected.total))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Payment: <strong className="capitalize text-foreground">{selected.payment_status}</strong> ({selected.payment_method || "COD"})
                      </p>
                    </div>

                    {/* Doorstep Verification PIN Box */}
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                      <KeyRound className="size-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">
                          Doorstep Delivery PIN
                        </p>
                        <p className="text-sm font-black font-mono tracking-widest text-amber-900 dark:text-amber-200">
                          {(selected as any).delivery_pin || (selected as any).otp_code || selected.id.slice(-4).toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1-Tap Speed Actions Bar */}
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-muted/30 border border-border/70">
                  <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold gap-1.5" asChild>
                    <a href={`tel:${selected.customer_phone}`}>
                      <Phone className="size-3.5 text-emerald-500" /> Call Customer
                    </a>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 text-xs font-semibold gap-1.5 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10"
                    onClick={() => sendWhatsApp(selected)}
                  >
                    <WhatsAppIcon className="size-3.5" /> WhatsApp Update
                  </Button>

                  {selected.customer_address && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 text-xs font-semibold gap-1.5 text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
                      asChild
                    >
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.customer_address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation className="size-3.5 text-sky-500" /> Maps Directions
                      </a>
                    </Button>
                  )}

                  {selected.status !== "delivered" && (
                    <Button
                      size="sm"
                      className="rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 ml-auto"
                      onClick={() => update.mutate({ id: selected.id, patch: { status: "delivered" } })}
                    >
                      <Check className="size-3.5" /> Mark Delivered
                    </Button>
                  )}
                </div>

                {/* Stepper Status Progress */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Pipeline Progression
                  </p>
                  <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    {FLOW.map((step, stepIdx) => {
                      const idx = FLOW.indexOf(selected.status as (typeof FLOW)[number]);
                      const isPast = idx >= 0 && stepIdx <= idx;
                      const isCurrent = selected.status === step;

                      return (
                        <li
                          key={step}
                          className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 transition-all ${
                            isCurrent
                              ? "border-primary bg-primary/10 shadow-2xs"
                              : isPast
                              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                              : "border-border/60 bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-muted-foreground">Step {stepIdx + 1}</span>
                            {isPast && <Check className="size-3 text-emerald-500" />}
                          </div>

                          <span className="text-xs font-bold capitalize text-foreground">
                            {step.replace(/_/g, " ")}
                          </span>

                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-7 text-[11px] mt-1"
                              onClick={() => update.mutate({ id: selected.id, patch: { status: step } })}
                            >
                              Move Here
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Rider Assignment & ETA Settings */}
                <div className="rounded-2xl border border-border p-3.5 sm:p-4 space-y-3 bg-card">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="size-4 text-sky-500" /> Dispatcher Controls &amp; ETA
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Assigned Rider / Driver</label>
                      <Input
                        className="mt-1 h-9 rounded-xl text-xs"
                        placeholder="Rider name (e.g. Ramesh K)"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">ETA (Minutes)</label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          className="h-9 rounded-xl text-xs w-24"
                          inputMode="numeric"
                          placeholder="25"
                          value={eta}
                          onChange={(e) => setEta(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        />
                        <button
                          type="button"
                          onClick={() => setEta("20")}
                          className="px-2 py-1 rounded-lg border text-[10px] font-bold hover:bg-muted"
                        >
                          20m
                        </button>
                        <button
                          type="button"
                          onClick={() => setEta("35")}
                          className="px-2 py-1 rounded-lg border text-[10px] font-bold hover:bg-muted"
                        >
                          35m
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Delivery / Route Note</label>
                      <Input
                        className="mt-1 h-9 rounded-xl text-xs"
                        placeholder="Gate code, landmark..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      className="rounded-xl h-8 text-xs font-bold"
                      onClick={() => {
                        update.mutate({
                          id: selected.id,
                          patch: {
                            driver_name: driverName || null,
                            eta_minutes: eta ? Number(eta) : null,
                            delivery_note: note || null,
                          } as Partial<OrderRow>,
                        });
                      }}
                    >
                      Save Dispatch Details
                    </Button>
                  </div>
                </div>

                {/* WhatsApp Customer Notifications & Presets */}
                <div className="rounded-2xl border border-border p-3.5 sm:p-4 space-y-3 bg-muted/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp Customer Dispatch Desk
                    </p>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-semibold">Quick Presets:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] rounded-lg px-2"
                        onClick={() => applyPresetMessage("dispatched")}
                      >
                        🚀 Out for Delivery
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] rounded-lg px-2"
                        onClick={() => applyPresetMessage("arrived")}
                      >
                        📍 Arrived at Gate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] rounded-lg px-2"
                        onClick={() => applyPresetMessage("packed")}
                      >
                        🧊 Packed on Ice
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    rows={3}
                    value={message}
                    placeholder={defaultMessage(selected)}
                    onChange={(e) => setMessage(e.target.value)}
                    className="text-xs rounded-xl"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      Opens WhatsApp Web / App with formatted message and verification PIN.
                    </p>
                    <Button
                      size="sm"
                      className="rounded-xl h-8 text-xs font-bold bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-1.5"
                      onClick={() => sendWhatsApp(selected)}
                    >
                      <WhatsAppIcon className="size-3.5" /> Send to Customer
                    </Button>
                  </div>
                </div>

                {/* Admin Cancel & Refund */}
                {isAdmin && (
                  <div className="rounded-2xl border border-destructive/30 p-3.5 space-y-2.5 bg-destructive/5">
                    <p className="text-xs font-bold text-destructive">Order Cancellation &amp; Refund Desk</p>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.payment_status === "paid"
                        ? "Order has paid transaction. Initiating refund sends funds back to source account."
                        : "Order was placed as COD / unpaid. Cancelling voids the delivery safely."}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Reason for cancellation..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="h-8 rounded-xl text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 text-xs"
                        disabled={refund.isPending}
                        onClick={() => refund.mutate({ orderId: selected.id, reason: cancelReason, refund: false })}
                      >
                        Cancel Delivery
                      </Button>
                      {selected.payment_status === "paid" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-xl h-8 text-xs font-bold"
                          disabled={refund.isPending}
                          onClick={() => refund.mutate({ orderId: selected.id, reason: cancelReason, refund: true })}
                        >
                          {refund.isPending ? "Refunding..." : "Cancel & Refund"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center text-muted-foreground rounded-3xl border border-dashed">
              <Truck className="size-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="font-bold text-sm">Select an Order to Dispatch</p>
              <p className="text-xs">Choose any order from the left list to view route, PIN, and dispatch tools.</p>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
