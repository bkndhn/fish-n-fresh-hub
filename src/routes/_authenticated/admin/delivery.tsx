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
  MapPin,
  Navigation,
  Clock,
  KeyRound,
  Search,
  Calendar,
  Award,
  Users,
  Store,
  ShieldCheck,
  TrendingUp,
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
import { DeliveryPinVerificationModal } from "@/components/DeliveryPinVerificationModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

function getOrderTimingMetrics(order: OrderRow) {
  if (!order.created_at) return null;
  const placed = new Date(order.created_at).getTime();
  const ended = order.delivered_at ? new Date(order.delivered_at).getTime() : Date.now();
  const elapsedMins = Math.max(1, Math.round((ended - placed) / (1000 * 60)));
  return {
    placedAt: new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
    elapsedMins,
    isDelivered: order.status === "delivered",
  };
}

function DeliveryTracking() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"all" | "confirmed" | "packed" | "out_for_delivery" | "delivered">("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "last7" | "all">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState("");
  const [driverName, setDriverName] = useState("");
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [verifyPinOpen, setVerifyPinOpen] = useState(false);
  const [driverReportOpen, setDriverReportOpen] = useState(false);

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
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayMidnight = todayMidnight - 86400000;
    const sevenDaysAgo = todayMidnight - 7 * 86400000;

    return active
      .filter((o) => {
        if (stageFilter !== "all" && o.status !== stageFilter) return false;

        if (dateFilter !== "all") {
          const createdTime = new Date(o.created_at).getTime();
          if (dateFilter === "today" && createdTime < todayMidnight) return false;
          if (dateFilter === "yesterday" && (createdTime < yesterdayMidnight || createdTime >= todayMidnight)) return false;
          if (dateFilter === "last7" && createdTime < sevenDaysAgo) return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (o.order_number ?? "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_phone ?? "").includes(q) ||
          (o.customer_address ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [active, stageFilter, dateFilter, searchQuery]);

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
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
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
    const dName = driverName || selected.driver_name || "Assigned Dispatch Executive";
    const etaMins = eta || selected.eta_minutes || "25–35";

    let text = "";
    if (type === "dispatched") {
      text = `🚀 Hi ${selected.customer_name}! Your fresh seafood order #${ref} is OUT FOR DELIVERY with rider ${dName}. Estimated arrival in ~${etaMins} mins.\n\n🔒 For safe and verified delivery, please keep your 4-digit Doorstep PIN ready from your order tracking screen to provide to the rider.`;
    } else if (type === "arrived") {
      text = `📍 Hi ${selected.customer_name}! Our delivery executive (${dName}) has ARRIVED at your address with order #${ref}. Please provide your 4-digit Doorstep PIN from your tracking screen to collect your cold-packed seafood!`;
    } else if (type === "packed") {
      text = `🧊 Hi ${selected.customer_name}! Your order #${ref} is PACKED & ICED in food-grade insulated boxes at 0–4°C. Ready for departure from our central cold hub!`;
    } else if (type === "cold_chain") {
      text = `🐟 Hi ${selected.customer_name}! Order #${ref} is 100% chemical-free morning harbour catch packed in crushed sea-ice. Track live status anytime on Fish N Fresh!`;
    }

    setMessage(text);
  };

  // Driver performance calculations
  const driverPerformanceList = useMemo(() => {
    const driversMap: Record<
      string,
      {
        name: string;
        assigned: number;
        delivered: number;
        totalElapsedMins: number;
        completedCount: number;
      }
    > = {};

    for (const o of active) {
      const dName = o.driver_name?.trim() || "Unassigned / Self";
      if (!driversMap[dName]) {
        driversMap[dName] = {
          name: dName,
          assigned: 0,
          delivered: 0,
          totalElapsedMins: 0,
          completedCount: 0,
        };
      }
      driversMap[dName].assigned += 1;
      if (o.status === "delivered") {
        driversMap[dName].delivered += 1;
        const timing = getOrderTimingMetrics(o);
        if (timing) {
          driversMap[dName].totalElapsedMins += timing.elapsedMins;
          driversMap[dName].completedCount += 1;
        }
      }
    }

    return Object.values(driversMap).sort((a, b) => b.delivered - a.delivered);
  }, [active]);

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
                Dispatch orders, verify customer PINs without leaks, monitor order-to-doorstep timings, and view driver reports.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDriverReportOpen(true)}
                className="h-8 rounded-xl text-xs font-semibold gap-1.5 border-sky-500/30 bg-background/80 hover:bg-sky-500/10"
              >
                <Users className="size-3.5 text-sky-600" /> Who Delivered Reports
              </Button>
              <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto gap-1">
                <Clock className="size-3 text-sky-500" /> Live Pipeline
              </Badge>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3.5" /> Date:
            </span>
            {(
              [
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "last7", label: "Last 7 Days" },
                { key: "all", label: "All Time" },
              ] as const
            ).map((df) => (
              <button
                key={df.key}
                type="button"
                onClick={() => setDateFilter(df.key)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  dateFilter === df.key
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-background/60 border border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          {/* Quick Pipeline Status Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-border/50">
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
              <p className="text-[10px] font-semibold text-muted-foreground">Delivered</p>
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
                const timing = getOrderTimingMetrics(o);

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedId(o.id)}
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

                    {timing && (
                      <div className="mt-1.5 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="size-3 text-sky-500" />
                          {timing.placedAt}
                          {timing.deliveredAt ? ` → ${timing.deliveredAt}` : ""}
                        </span>
                        <span className={`font-semibold ${timing.isDelivered ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {timing.isDelivered ? `Delivered: ${timing.elapsedMins}m` : `Elapsed: ${timing.elapsedMins}m`}
                        </span>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
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
                  No orders match this date or status filter.
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

                    {/* Elapsed Turnaround timing badge */}
                    {(() => {
                      const timing = getOrderTimingMetrics(selected);
                      if (!timing) return null;
                      return (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-medium text-sky-700 dark:text-sky-300">
                          <Clock className="size-3 text-sky-600" />
                          <span>Placed: {timing.placedAt}</span>
                          {timing.deliveredAt && <span>· Delivered: {timing.deliveredAt}</span>}
                          <span className="font-bold">({timing.isDelivered ? `Total: ${timing.elapsedMins} mins` : `Elapsed: ${timing.elapsedMins} mins`})</span>
                        </div>
                      );
                    })()}
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

                    {/* Anti-Theft Doorstep PIN Security Lock */}
                    {selected.fulfillment_type === "pos" ? (
                      <div className="p-2.5 rounded-2xl bg-muted/60 border border-border flex items-center gap-2">
                        <Store className="size-4 text-primary" />
                        <div>
                          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                            In-Store POS Counter
                          </p>
                          <p className="text-xs font-semibold text-foreground">
                            No Doorstep PIN Required
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div>
                            <p className="text-[9px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">
                              Anti-Theft Protection
                            </p>
                            <p className="text-xs font-mono font-bold text-foreground">
                              🔒 PIN Secured (Customer Only)
                            </p>
                          </div>
                        </div>
                        {selected.status !== "delivered" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-1 shadow-xs"
                            onClick={() => setVerifyPinOpen(true)}
                          >
                            <KeyRound className="size-3.5" /> Enter PIN
                          </Button>
                        )}
                      </div>
                    )}
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
                    selected.fulfillment_type === "pos" ? (
                      <Button
                        size="sm"
                        className="rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 ml-auto"
                        onClick={() => update.mutate({ id: selected.id, patch: { status: "delivered" } })}
                      >
                        <Check className="size-3.5" /> Mark Counter Handover Done
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-xl h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1 ml-auto"
                        onClick={() => setVerifyPinOpen(true)}
                      >
                        <KeyRound className="size-3.5" /> Verify PIN &amp; Deliver
                      </Button>
                    )
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
                              onClick={() => {
                                if (step === "delivered" && selected.fulfillment_type !== "pos") {
                                  setVerifyPinOpen(true);
                                } else {
                                  update.mutate({ id: selected.id, patch: { status: step } });
                                }
                              }}
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
                      Opens WhatsApp Web / App with message for customer. PIN remains private with customer.
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
              <p className="text-xs">Choose any order from the left list to view route, timing, and dispatch tools.</p>
            </div>
          )}
        </div>
      </div>

      {/* Doorstep PIN Verification Modal */}
      {selected && (
        <DeliveryPinVerificationModal
          open={verifyPinOpen}
          onOpenChange={setVerifyPinOpen}
          orderId={selected.id}
          orderNumber={selected.order_number}
          customerName={selected.customer_name}
          customerPhone={selected.customer_phone}
          fulfillmentType={selected.fulfillment_type}
          isCod={selected.payment_method === "cod" || selected.payment_status !== "paid"}
          totalAmount={Number(selected.total)}
          isAdmin={isAdmin}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin", "orders"] });
            toast.success(`Order #${selected.order_number ?? selected.id.slice(0, 8)} verified and marked delivered!`);
          }}
        />
      )}

      {/* Driver Performance Report Dialog */}
      <Dialog open={driverReportOpen} onOpenChange={setDriverReportOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              <Users className="size-5 text-sky-600" />
              Who Delivered — Driver Performance Report
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Complete metrics on order assignments, completed deliveries, and average turnaround timings.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center">
                <p className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">Total Active Riders</p>
                <p className="text-xl font-black text-sky-900 dark:text-sky-100">{driverPerformanceList.length}</p>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Total Completed</p>
                <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{deliveredCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                <p className="text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300">On The Road</p>
                <p className="text-xl font-black text-purple-900 dark:text-purple-100">{outCount}</p>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-2xl border border-border">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="p-3">Rider / Executive</th>
                    <th className="p-3 text-center">Assigned</th>
                    <th className="p-3 text-center">Completed</th>
                    <th className="p-3 text-center">Avg Time</th>
                    <th className="p-3 text-right">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {driverPerformanceList.map((d) => {
                    const avgMins = d.completedCount > 0 ? Math.round(d.totalElapsedMins / d.completedCount) : 0;
                    const completionRate = d.assigned > 0 ? Math.round((d.delivered / d.assigned) * 100) : 0;

                    return (
                      <tr key={d.name} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-semibold text-foreground flex items-center gap-1.5">
                          <Award className="size-3.5 text-amber-500 shrink-0" />
                          <span>{d.name}</span>
                        </td>
                        <td className="p-3 text-center font-mono">{d.assigned}</td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {d.delivered}
                        </td>
                        <td className="p-3 text-center font-mono text-muted-foreground">
                          {avgMins > 0 ? `${avgMins} mins` : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] ${
                              completionRate >= 80
                                ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                                : "border-amber-500 text-amber-600 bg-amber-500/10"
                            }`}
                          >
                            {completionRate}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {driverPerformanceList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No driver delivery data available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

