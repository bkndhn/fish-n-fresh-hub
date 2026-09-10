import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Truck,
  Phone,
  MessageCircle,
  Navigation,
  CheckCircle2,
  Zap,
  Award,
  DollarSign,
  Wallet,
  Clock,
  Search,
  Check,
  ExternalLink,
  Users,
  Compass,
  Route as RouteIcon,
  AlertTriangle,
  Printer,
  Download,
  Receipt,
  FileText,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, type OrderRow } from "@/lib/admin";
import { listDrivers, type DriverOption } from "@/lib/staff.functions";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { DeliveryPinVerificationModal } from "@/components/DeliveryPinVerificationModal";
import { DriverCashSettlementModal } from "@/components/admin/DriverCashSettlementModal";
import { SettlementReceiptModal } from "@/components/admin/SettlementReceiptModal";
import { PrinterSettingsModal } from "@/components/admin/PrinterSettingsModal";
import { optimizeMultiOrderRoute } from "@/lib/routingOptimizer";
import type { DriverCashSettlement } from "@/lib/types";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { settingsQuery } from "@/lib/queries";
import { getVerticalConfig } from "@/lib/verticals";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/driver")({
  head: () => ({
    meta: [
      { title: "Driver Dispatch & Performance | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Smart driver assignment, live delivery partner dispatch, turn-by-turn navigation, and cash collection analytics.",
      },
      { property: "og:title", content: "Driver Dispatch & Performance | Fish N Fresh Admin" },
      { property: "og:description", content: "Auto-assign orders, dispatch drivers on WhatsApp, and track driver cash collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverDispatchPage,
});

export function DriverDispatchPage() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const driversQuery = useQuery({
    queryKey: ["admin", "drivers"],
    queryFn: () => listDrivers() as Promise<DriverOption[]>,
  });
  const drivers = driversQuery.data ?? [];
  const { data: settings } = useQuery(settingsQuery);

  const [activeTab, setActiveTab] = useState<"dispatch" | "analytics" | "settlements">("dispatch");
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [routeModalOrder, setRouteModalOrder] = useState<OrderRow | null>(null);
  const [pinModalOrder, setPinModalOrder] = useState<OrderRow | null>(null);
  const [settlingDriver, setSettlingDriver] = useState<{
    name: string;
    phone?: string | undefined;
    driverId?: string | undefined;
    unsettledOrders: OrderRow[];
  } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<DriverCashSettlement | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  const settlementsQuery = useQuery({
    queryKey: ["driver_cash_settlements"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("driver_cash_settlements")
        .select("*")
        .order("settled_at", { ascending: false });
      if (error) {
        console.warn("Could not query driver_cash_settlements:", error);
        return [];
      }
      return (data || []) as DriverCashSettlement[];
    },
  });
  const settlements = settlementsQuery.data ?? [];

  useEffect(() => {
    const channel = supabase
      .channel("admin-driver-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_cash_settlements" }, () => {
        qc.invalidateQueries({ queryKey: ["driver_cash_settlements"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const settlementExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "settlement_number", label: "Voucher #", type: "string" },
      { key: "settled_at", label: "Date & Time (IST)", type: "date", format: (v) => formatIST(v) },
      { key: "driver_name", label: "Driver Name", type: "string" },
      { key: "driver_phone", label: "Driver Phone", type: "string" },
      { key: "orders_count", label: "Orders Settled", type: "number" },
      { key: "amount_collected", label: "Gross COD (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "amount_settled", label: "Handed Over (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "balance_remaining", label: "Balance (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "payment_mode", label: "Payment Mode", type: "string" },
      { key: "settled_by_name", label: "Collector", type: "string" },
      { key: "notes", label: "Notes", type: "string" },
    ];
    return {
      filename: `driver-cash-settlements-${new Date().toISOString().slice(0, 10)}`,
      title: "Driver Cash & COD Settlements Register",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | ${settlements.length} settlement vouchers`,
      columns,
      data: settlements,
      orientation: "landscape",
    };
  }, [settlements]);

  const updateOrder = useMutation({
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

  const allOrders = orders.data ?? [];

  // Active delivery orders (not pickup, not delivered, not cancelled)
  const activeDeliveries = useMemo(() => {
    return allOrders.filter(
      (o) => o.fulfillment_type !== "pickup" && !["delivered", "cancelled"].includes(o.status)
    );
  }, [allOrders]);

  // Unassigned orders eligible for auto-assignment
  const unassignedOrders = useMemo(() => {
    return activeDeliveries.filter((o) => !o.driver_name && !o.driver_id);
  }, [activeDeliveries]);

  // Filtered deliveries list based on search and driver filter
  const displayedDeliveries = useMemo(() => {
    return activeDeliveries.filter((o) => {
      if (selectedDriverFilter !== "all") {
        if (selectedDriverFilter === "__unassigned__") {
          if (o.driver_name || o.driver_id) return false;
        } else if (o.driver_name !== selectedDriverFilter && o.driver_id !== selectedDriverFilter) {
          return false;
        }
      }
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.includes(term) ||
        (o.customer_address && o.customer_address.toLowerCase().includes(term)) ||
        (o.order_number && o.order_number.toLowerCase().includes(term)) ||
        (o.driver_name && o.driver_name.toLowerCase().includes(term))
      );
    });
  }, [activeDeliveries, selectedDriverFilter, search]);

  // Multi-Stop Route Clustering for selected driver
  const driverOrdersForRoute = useMemo(() => {
    if (selectedDriverFilter === "all" || selectedDriverFilter === "__unassigned__") {
      return [];
    }
    return displayedDeliveries.filter(
      (o) => o.driver_name === selectedDriverFilter || o.driver_id === selectedDriverFilter
    );
  }, [displayedDeliveries, selectedDriverFilter]);

  const multiStopRoute = useMemo(() => {
    if (driverOrdersForRoute.length < 2) return null;
    return optimizeMultiOrderRoute(
      settings?.shop_lat ? Number(settings.shop_lat) : null,
      settings?.shop_lng ? Number(settings.shop_lng) : null,
      driverOrdersForRoute
    );
  }, [driverOrdersForRoute, settings?.shop_lat, settings?.shop_lng]);

  // Auto-Assign Algorithm: Distribute unassigned orders fairly across active drivers
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      if (drivers.length === 0) throw new Error("No active drivers found. Please add driver accounts first in Team.");
      if (unassignedOrders.length === 0) throw new Error("No unassigned orders to assign.");

      // Calculate current active count per driver
      const driverLoadMap = new Map<string, { driver: DriverOption; load: number }>();
      for (const d of drivers) {
        const currentLoad = activeDeliveries.filter(
          (o) => o.driver_name === d.name || o.driver_id === d.id
        ).length;
        driverLoadMap.set(d.id, { driver: d, load: currentLoad });
      }

      let assignedCount = 0;
      for (const order of unassignedOrders) {
        // Pick driver with lowest current load
        const sortedDrivers = [...driverLoadMap.values()].sort((a, b) => a.load - b.load);
        const target = sortedDrivers[0];
        if (!target) break;

        const { error } = await supabase.from("orders").update({
          driver_id: target.driver.id,
          driver_name: target.driver.name || target.driver.email,
        }).eq("id", order.id);

        if (error) throw error;
        target.load++;
        assignedCount++;
      }

      return assignedCount;
    },
    onSuccess: (count) => {
      toast.success(`Smart Auto-Assign: ${count} orders assigned fairly across ${drivers.length} drivers!`);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Driver Performance & COD Cash Analytics Aggregator
  const driverAnalytics = useMemo(() => {
    type DriverStat = {
      name: string;
      phone: string;
      driverId?: string | undefined;
      activeRuns: number;
      completedRuns: number;
      codPending: number;
      codSettled: number;
      codTotal: number;
      unsettledOrders: OrderRow[];
      prepaidDelivered: number;
      onTimeCount: number;
      totalMins: number;
    };
    const stats = new Map<string, DriverStat>();

    // Seed known drivers
    for (const d of drivers) {
      stats.set(d.name || d.id, {
        name: d.name || d.email,
        phone: d.phone || "",
        driverId: d.id || undefined,
        activeRuns: 0,
        completedRuns: 0,
        codPending: 0,
        codSettled: 0,
        codTotal: 0,
        unsettledOrders: [] as OrderRow[],
        prepaidDelivered: 0,
        onTimeCount: 0,
        totalMins: 0,
      });
    }

    for (const o of allOrders) {
      if (!o.driver_name) continue;
      const cur: DriverStat = stats.get(o.driver_name) || {
        name: o.driver_name,
        phone: "",
        driverId: o.driver_id || undefined,
        activeRuns: 0,
        completedRuns: 0,
        codPending: 0,
        codSettled: 0,
        codTotal: 0,
        unsettledOrders: [] as OrderRow[],
        prepaidDelivered: 0,
        onTimeCount: 0,
        totalMins: 0,
      };

      if (o.status === "delivered") {
        cur.completedRuns++;
        const orderTotal = Number(o.total || 0);
        const isBankDirect = Boolean(
          (o as any).paid_to_bank_directly ||
          (o as any).actual_payment_method === "upi_qr"
        );

        if (isBankDirect) {
          cur.codTotal += orderTotal;
          // Direct bank UPI - driver has zero physical cash liability for this order
        } else if (o.payment_method === "cod" || (o as any).actual_payment_method === "cash") {
          cur.codTotal += orderTotal;
          if (o.cod_settled) {
            cur.codSettled += orderTotal;
          } else {
            cur.codPending += orderTotal;
            cur.unsettledOrders.push(o);
          }
        } else {
          cur.prepaidDelivered += orderTotal;
        }

        const createdTime = new Date(o.created_at).getTime();
        const deliveredTime = (o as any).delivered_at
          ? new Date((o as any).delivered_at).getTime()
          : null;
        const durationMinutes = deliveredTime
          ? Math.max(5, Math.round((deliveredTime - createdTime) / 60000))
          : (o.eta_minutes || 40);

        cur.totalMins += durationMinutes;
        const targetSla = o.eta_minutes ? o.eta_minutes + 10 : 60;
        if (durationMinutes <= targetSla) {
          cur.onTimeCount++;
        }
      } else if (!["delivered", "cancelled"].includes(o.status)) {
        cur.activeRuns++;
      }

      stats.set(o.driver_name, cur);
    }

    return [...stats.values()].map((s) => ({
      ...s,
      onTimeRate: s.completedRuns > 0 ? Math.round((s.onTimeCount / s.completedRuns) * 100) : 100,
      avgSpeed: s.completedRuns > 0 ? Math.round(s.totalMins / s.completedRuns) : 38,
    }));
  }, [drivers, allOrders]);

  const totalFleetCodPending = useMemo(() => {
    return driverAnalytics.reduce((sum, d) => sum + d.codPending, 0);
  }, [driverAnalytics]);

  const totalFleetCodSettled = useMemo(() => {
    return driverAnalytics.reduce((sum, d) => sum + d.codSettled, 0);
  }, [driverAnalytics]);

  function sendDriverWhatsApp(order: OrderRow) {
    const driver = drivers.find((d) => d.name === order.driver_name || d.id === order.driver_id);
    const driverPhone = driver?.phone || "";

    const itemsSummary = (order.items ?? [])
      .map((it) => `${it.name} (${it.qty} ${it.unit || "kg"})`)
      .join(", ");

    const ref = order.order_number ?? order.id.slice(0, 8);
    const navLink = order.location_lat && order.location_lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${order.location_lat},${order.location_lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address ?? "")}`;

    const text = `Hi ${order.driver_name || "Partner"}, new delivery assigned!\n\nOrder #${ref}\nCustomer: ${order.customer_name} (${order.customer_phone})\nAddress: ${order.customer_address ?? "See Map"}\nItems: ${itemsSummary}\n\nPayment: ${order.payment_method?.toUpperCase()} · Total: ${formatINR(Number(order.total))}\n${order.payment_method === "cod" ? "⚠️ COLLECT CASH FROM CUSTOMER" : "🟢 PAID ONLINE - DO NOT COLLECT CASH"}\n\nStart Navigation: ${navLink}`;

    const waUrl = getWhatsAppUrl(driverPhone || "919999999999", text);
    window.open(waUrl, "_blank", "noopener");
  }

  return (
    <AdminShell title="Driver Dispatch & Fleet Management" allow={["admin", "driver", "staff"]}>
      {/* Tab Controls & Auto-Assign Header */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 w-full min-w-0 max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 w-full min-w-0">
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar pb-0.5">
            <TabsList className="h-9 rounded-xl p-1 bg-muted/60 flex-nowrap">
              <TabsTrigger value="dispatch" className="rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Truck className="size-3.5" /> Live Dispatch ({activeDeliveries.length})
              </TabsTrigger>
              <TabsTrigger value="analytics" className="rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Award className="size-3.5 text-amber-500" /> Driver Performance
              </TabsTrigger>
              <TabsTrigger value="settlements" className="rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Receipt className="size-3.5 text-emerald-500" /> Cash Handover & Reports
                {totalFleetCodPending > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white font-bold px-1.5 py-0.2 text-[10px]">
                    {formatINR(totalFleetCodPending)}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80 shadow-2xs"
              onClick={() => setPrinterModalOpen(true)}
            >
              <Printer className="size-3.5 text-primary" />
              <span>Thermal Printer (BT / USB)</span>
            </Button>

            {/* Smart Auto-Assign Button */}
            <Button
              size="sm"
              className="rounded-xl h-8.5 text-xs font-semibold bg-primary text-primary-foreground shadow-xs"
              disabled={autoAssignMutation.isPending || unassignedOrders.length === 0}
              onClick={() => autoAssignMutation.mutate()}
            >
              <Zap className="mr-1.5 size-3.5 text-amber-300 animate-pulse" />
              {autoAssignMutation.isPending
                ? "Auto-Assigning..."
                : `Smart Auto-Assign (${unassignedOrders.length} Unassigned)`}
            </Button>
          </div>
        </div>

        {/* Tab 1: Live Dispatch Screen */}
        <TabsContent value="dispatch" className="space-y-4 m-0">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1 min-w-44">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, address, or driver..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-xl h-8.5 text-xs"
                />
              </div>

              <Select value={selectedDriverFilter} onValueChange={setSelectedDriverFilter}>
                <SelectTrigger className="w-44 rounded-xl h-8.5 text-xs">
                  <SelectValue placeholder="Filter by Driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fleet Drivers</SelectItem>
                  <SelectItem value="__unassigned__">⚠️ Unassigned Only ({unassignedOrders.length})</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.name || d.id}>
                      {d.name || d.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{displayedDeliveries.length}</span> active runs
            </div>
          </div>

          {/* Multi-Stop Optimized Route Banner */}
          {multiStopRoute && (
            <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
                  <RouteIcon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      Optimized Multi-Stop Delivery Sequence
                    </p>
                    <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                      {multiStopRoute.waypoints.length} Drops · {multiStopRoute.totalDistanceKm.toFixed(1)} km
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sequenced by Nearest-Neighbor TSP algorithm to minimize delivery transit time and fuel cost.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="rounded-xl h-9 text-xs font-bold gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
                asChild
              >
                <a href={multiStopRoute.googleMapsMultiStopUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-3.5" />
                  <span>Launch Google Maps Route ({multiStopRoute.waypoints.length} Stops)</span>
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            </div>
          )}

          {/* Grid Layout: Map & Dispatch Cards */}
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            {/* OpenStreetMap Area Map */}
            <Card className="overflow-hidden border-border/70 shadow-xs order-2 lg:order-1">
              <CardHeader className="p-3 bg-muted/30 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" /> Delivery Area Overview
                  </p>
                  <span className="text-[10px] text-muted-foreground">Live GPS Coverage</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <iframe
                  title="Delivery area map"
                  className="h-[520px] w-full border-0"
                  loading="lazy"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=80.12%2C12.85%2C80.35%2C13.20&layer=mapnik"
                />
              </CardContent>
            </Card>

            {/* Active Delivery Cards */}
            <div className="space-y-3 order-1 lg:order-2">
              {displayedDeliveries.map((o) => {
                const navUrl = getGoogleMapsDirUrl(
                  o.location_lat,
                  o.location_lng,
                  o.customer_address,
                  settings?.shop_lat,
                  settings?.shop_lng
                );

                const isCod = o.payment_method === "cod" && o.payment_status !== "paid";

                return (
                  <Card key={o.id} className="border-border/70 shadow-xs hover:border-primary/40 transition">
                    <CardContent className="space-y-3 pt-5 pb-5">
                      {/* Top Header: Order No, Customer, Status */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-base text-foreground">
                              #{o.order_number ?? o.id.slice(0, 8)}
                            </span>
                            <Badge variant="secondary" className="capitalize text-[11px]">
                              {o.status.replace(/_/g, " ")}
                            </Badge>
                            {isCod ? (
                              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                                Cash on Delivery
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold">
                                Paid Online
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground mt-1">
                            {o.customer_name} · <span className="text-muted-foreground">{o.customer_phone}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {o.customer_address ?? "No delivery address specified"}
                            {o.location_lat && o.location_lng && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20 ml-2">
                                ✓ Exact Pin
                              </span>
                            )}
                          </p>
                          {o.delivery_slot && (
                            <p className="text-[11px] text-primary font-medium mt-0.5">Slot: {o.delivery_slot}</p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-display font-bold text-base text-foreground">{formatINR(Number(o.total))}</p>
                          <p className="text-[11px] text-muted-foreground">{formatIST(o.created_at)}</p>
                        </div>
                      </div>

                      {/* Items checklist */}
                      <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 text-xs text-muted-foreground flex flex-wrap gap-2">
                        <span className="font-semibold text-foreground">Cuts Checklist:</span>
                        {(o.items ?? []).map((it, idx) => (
                          <span key={idx} className="rounded bg-card border border-border/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                            {it.name} ({it.qty} {it.unit || "kg"})
                          </span>
                        ))}
                      </div>

                      {/* Payment Collection Warning Box */}
                      {isCod ? (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                            <span>
                              <strong>COLLECT CASH AT DOORSTEP:</strong> Ask customer for exact cash amount of{" "}
                              <strong>{formatINR(Number(o.total))}</strong>.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <Check className="size-4 shrink-0 text-emerald-600" />
                          <span>
                            <strong>PREPAID ORDER:</strong> Payment received via {o.payment_method?.toUpperCase()}. Do not ask customer for money.
                          </span>
                        </div>
                      )}

                      {/* Driver Assignment & Actions */}
                      {/* Driver Assignment & Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {/* Driver Selector */}
                          <div className="flex-1 min-w-40 sm:w-48">
                            {drivers.length > 0 ? (
                              <Select
                                value={drivers.find((d) => d.name === o.driver_name)?.id ?? ""}
                                onValueChange={(id) => {
                                  const driver = drivers.find((d) => d.id === id);
                                  if (driver) {
                                    updateOrder.mutate({
                                      id: o.id,
                                      patch: { driver_id: driver.id, driver_name: driver.name },
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8.5 rounded-xl text-xs font-semibold">
                                  <SelectValue placeholder="Assign Driver" />
                                </SelectTrigger>
                                <SelectContent>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name || d.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                placeholder="Assign driver name..."
                                defaultValue={o.driver_name ?? ""}
                                className="h-8.5 rounded-xl text-xs"
                                onBlur={(e) => {
                                  const driver_name = e.target.value.trim();
                                  if (driver_name && driver_name !== o.driver_name) {
                                    updateOrder.mutate({ id: o.id, patch: { driver_name } });
                                  }
                                }}
                              />
                            )}
                          </div>

                          {/* WhatsApp Driver Dispatch Link */}
                          {o.driver_name && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-8.5 text-xs font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 shrink-0"
                              title="Notify assigned driver on WhatsApp"
                              onClick={() => sendDriverWhatsApp(o)}
                            >
                              <WhatsAppIcon className="size-3.5 mr-1" /> WhatsApp
                            </Button>
                          )}
                        </div>

                        {/* Navigation & Delivery Actions */}
                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                          {/* Customer Call */}
                          <Button size="sm" variant="outline" className="rounded-xl h-8.5 text-xs font-semibold px-2" asChild>
                            <a href={`tel:${o.customer_phone}`} className="flex items-center justify-center">
                              <Phone className="size-3 mr-1 text-primary" /> Call
                            </a>
                          </Button>

                          {/* Interactive Route Modal */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8.5 text-xs font-semibold px-2 border-primary/25 hover:bg-primary/5 text-primary"
                            onClick={() => setRouteModalOrder(o)}
                            title="Preview store-to-doorstep route on interactive map"
                          >
                            <RouteIcon className="size-3 mr-1 text-primary" /> Route
                          </Button>

                          {/* Turn-by-Turn GPS Navigation */}
                          <Button size="sm" variant="outline" className="rounded-xl h-8.5 text-xs font-semibold px-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10" asChild>
                            <a href={navUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center">
                              <Compass className="size-3 mr-1 text-blue-500" /> Nav
                            </a>
                          </Button>

                          {/* Dispatch Trigger or Deliver Button */}
                          {o.status !== "out_for_delivery" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl h-8.5 text-xs font-bold text-blue-600 border-blue-500/30 hover:bg-blue-500/10 px-2"
                              onClick={() => updateOrder.mutate({ id: o.id, patch: { status: "out_for_delivery" } })}
                            >
                              <Truck className="size-3 mr-1" /> Start
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className={`rounded-xl h-8.5 text-xs font-bold px-2.5 ${
                                isCod ? "bg-amber-600 hover:bg-amber-500 text-white shadow-xs" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                              }`}
                              onClick={() => setPinModalOrder(o)}
                              title="Verify customer one-time delivery PIN to mark delivered"
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              {isCod ? "Collect & Verify PIN" : "🔑 Verify PIN"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {displayedDeliveries.length === 0 && (
                <Card className="border-border/60">
                  <CardContent className="py-16 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-2" />
                    <p className="font-semibold text-foreground">All Deliveries Dispatched & Fulfilled!</p>
                    <p className="text-xs mt-1">No pending orders awaiting delivery runs at this moment.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Driver Performance & Cash Reconciliation */}
        <TabsContent value="analytics" className="space-y-4 m-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={`border-border/60 shadow-xs ${totalFleetCodPending > 0 ? "border-amber-500/40 bg-amber-500/[0.04]" : ""}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Pending COD with Drivers</p>
                  <Wallet className="size-4 text-amber-500" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(totalFleetCodPending)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Cash in transit to remit to admin</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs bg-emerald-500/[0.03]">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total Handed Over to Admin</p>
                  <DollarSign className="size-4 text-emerald-500" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(totalFleetCodSettled)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Settled & verified at counter</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Completed Delivery Runs</p>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold">
                  {driverAnalytics.reduce((s, d) => s + d.completedRuns, 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Delivered doorsteps</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Active In-Flight Runs</p>
                  <Truck className="size-4 text-blue-500" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {driverAnalytics.reduce((s, d) => s + d.activeRuns, 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">On bikes & scooters right now</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Fleet Performance Table */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3 pt-5 border-b border-border/50">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="size-4 text-amber-500" /> Fleet Driver Efficiency & Cash In Hand
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Reconciliation summary for cash collection, turnaround speed, and delivery reliability
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile Driver Performance Cards */}
              <div className="divide-y divide-border/50 sm:hidden">
                {driverAnalytics.map((d) => (
                  <div key={d.name} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-foreground">{d.name}</p>
                        {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {d.activeRuns > 0 ? "On Run" : "Ready"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-2.5 text-xs border border-border/50">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">COD Pending</p>
                        <p className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                          {formatINR(d.codPending)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">COD Settled</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatINR(d.codSettled)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Completed</p>
                        <p className="font-bold text-foreground text-sm">
                          {d.completedRuns} orders
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">On-Time SLA</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {d.onTimeRate}% ({d.avgSpeed}m)
                        </p>
                      </div>
                    </div>

                    {d.codPending > 0 ? (
                      <Button
                        size="sm"
                        className="w-full rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        onClick={() =>
                          setSettlingDriver({
                            name: d.name,
                            phone: d.phone,
                            driverId: d.driverId,
                            unsettledOrders: d.unsettledOrders,
                          })
                        }
                      >
                        <Wallet className="mr-1.5 size-3.5" /> Collect & Settle Cash ({formatINR(d.codPending)})
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground py-1 bg-muted/30 rounded-xl">
                        <CheckCircle2 className="size-3.5 text-emerald-500" /> Cash Settled & Reconciled
                      </div>
                    )}
                  </div>
                ))}
                {driverAnalytics.length === 0 && (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    No fleet drivers registered. Add drivers under Team & Roles.
                  </p>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-semibold">Driver Partner</th>
                      <th className="p-3.5 font-semibold">Active Runs</th>
                      <th className="p-3.5 font-semibold">Completed Runs</th>
                      <th className="p-3.5 font-semibold">Pending COD in Hand</th>
                      <th className="p-3.5 font-semibold">Settled Handover</th>
                      <th className="p-3.5 font-semibold">On-Time SLA</th>
                      <th className="p-3.5 font-semibold">Status</th>
                      <th className="p-3.5 font-semibold text-right">Settlement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {driverAnalytics.map((d) => (
                      <tr key={d.name} className="hover:bg-muted/30 transition">
                        <td className="p-3.5">
                          <p className="font-semibold text-foreground text-sm">{d.name}</p>
                          {d.phone && <p className="text-muted-foreground text-[11px]">{d.phone}</p>}
                        </td>
                        <td className="p-3.5">
                          <span className={`font-semibold ${d.activeRuns > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {d.activeRuns} active
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-foreground">{d.completedRuns} orders</td>
                        <td className="p-3.5">
                          <span className="font-bold text-amber-600 dark:text-amber-400 font-display text-sm">
                            {formatINR(d.codPending)}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-emerald-600 dark:text-emerald-400 font-display">
                          {formatINR(d.codSettled)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              d.onTimeRate >= 90
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : d.onTimeRate >= 75
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {d.onTimeRate}% ({d.avgSpeed}m)
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {d.activeRuns > 0 ? "On Delivery" : "Ready"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          {d.codPending > 0 ? (
                            <Button
                              size="sm"
                              className="rounded-xl h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              onClick={() =>
                                setSettlingDriver({
                                  name: d.name,
                                  phone: d.phone,
                                  driverId: d.driverId,
                                  unsettledOrders: d.unsettledOrders,
                                })
                              }
                            >
                              <Wallet className="mr-1 size-3" /> Settle Cash
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="size-3" /> Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {driverAnalytics.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
                          No fleet drivers registered. Add drivers under Team & Roles.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Cash Handover & Audit Reports */}
        <TabsContent value="settlements" className="space-y-4 m-0">
          {/* Top Audit KPI Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/60 shadow-xs bg-emerald-500/[0.03]">
              <CardContent className="pt-4 pb-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total Cash Settled</p>
                  <DollarSign className="size-4 text-emerald-500" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(settlements.reduce((s, x) => s + Number(x.amount_settled || 0), 0))}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Handed over & deposited</p>
              </CardContent>
            </Card>

            <Card className={`border-border/60 shadow-xs ${totalFleetCodPending > 0 ? "border-amber-500/40 bg-amber-500/[0.04]" : ""}`}>
              <CardContent className="pt-4 pb-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Pending on Road</p>
                  <Wallet className="size-4 text-amber-500" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(totalFleetCodPending)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Physical cash with drivers</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-4 pb-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Reconciled Orders</p>
                  <CheckCircle2 className="size-4 text-primary" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {settlements.reduce((s, x) => s + Number(x.orders_count || 0), 0)} orders
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Delivered & verified</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-4 pb-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Settlement Slips</p>
                  <Receipt className="size-4 text-purple-500" />
                </div>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {settlements.length} vouchers
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Audit vouchers generated</p>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Receipt className="size-4 text-primary" /> Settlement Audit Ledger
              </h3>
              <p className="text-xs text-muted-foreground">
                Historical record of physical cash collected from delivery drivers and handed over to admin
              </p>
            </div>

            <ExportDropdown options={settlementExportOptions} buttonLabel="Export Settlements" />
          </div>

          {/* Settlements Table & Mobile List */}
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {/* Mobile View */}
              <div className="divide-y divide-border/50 sm:hidden">
                {settlements.map((s) => (
                  <div key={s.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-primary">
                          #{s.settlement_number}
                        </span>
                        <p className="text-xs text-muted-foreground">{formatIST(s.settled_at)}</p>
                      </div>
                      <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-display">
                        {formatINR(Number(s.amount_settled))}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-2xl border border-border/50">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Driver</p>
                        <p className="font-semibold text-foreground">{s.driver_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Orders Settled</p>
                        <p className="font-semibold text-foreground">{s.orders_count} orders</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Handed Over To</p>
                        <p className="font-semibold text-foreground">{s.settled_by_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Payment Mode</p>
                        <span className="capitalize font-semibold text-foreground">
                          {s.payment_mode?.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {s.notes && (
                      <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-xl italic">
                        Note: {s.notes}
                      </p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl h-8 text-xs font-semibold gap-1.5"
                      onClick={() => setViewingReceipt(s)}
                    >
                      <Printer className="size-3.5" /> View / Print Voucher Slip
                    </Button>
                  </div>
                ))}
                {settlements.length === 0 && (
                  <div className="p-8 text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">No Settlements Recorded Yet</p>
                    <p className="text-xs text-muted-foreground">
                      When drivers return to the store with COD cash, click "Settle Cash" under Driver Performance to record the handover.
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="p-3.5 font-semibold">Voucher #</th>
                      <th className="p-3.5 font-semibold">Settled Date & Time</th>
                      <th className="p-3.5 font-semibold">Driver Partner</th>
                      <th className="p-3.5 font-semibold">Orders</th>
                      <th className="p-3.5 font-semibold">Gross Collected</th>
                      <th className="p-3.5 font-semibold">Cash Handed Over</th>
                      <th className="p-3.5 font-semibold">Admin Collector</th>
                      <th className="p-3.5 font-semibold">Mode</th>
                      <th className="p-3.5 font-semibold">Notes</th>
                      <th className="p-3.5 font-semibold text-right">Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3.5 font-mono font-bold text-primary">
                          #{s.settlement_number}
                        </td>
                        <td className="p-3.5 text-muted-foreground">{formatIST(s.settled_at)}</td>
                        <td className="p-3.5">
                          <p className="font-semibold text-foreground">{s.driver_name}</p>
                          {s.driver_phone && (
                            <p className="text-[11px] text-muted-foreground">{s.driver_phone}</p>
                          )}
                        </td>
                        <td className="p-3.5 font-medium">{s.orders_count} orders</td>
                        <td className="p-3.5 text-muted-foreground">
                          {formatINR(Number(s.amount_collected))}
                        </td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 font-display">
                            {formatINR(Number(s.amount_settled))}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-foreground">{s.settled_by_name}</td>
                        <td className="p-3.5">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
                            {s.payment_mode?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground max-w-40 truncate">
                          {s.notes || "—"}
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-7 px-2.5 text-xs font-semibold gap-1"
                            onClick={() => setViewingReceipt(s)}
                          >
                            <Printer className="size-3" /> Slip
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {settlements.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          No settlements recorded yet. Settle cash from drivers in the "Driver Performance" tab.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Driver COD Cash Settlement Modal */}
      {settlingDriver && (
        <DriverCashSettlementModal
          open={!!settlingDriver}
          onOpenChange={(open) => {
            if (!open) setSettlingDriver(null);
          }}
          driverName={settlingDriver.name}
          driverPhone={settlingDriver.phone}
          driverId={settlingDriver.driverId}
          unsettledOrders={settlingDriver.unsettledOrders}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin", "orders"] });
            qc.invalidateQueries({ queryKey: ["driver_cash_settlements"] });
          }}
        />
      )}

      {/* Settlement Voucher Receipt Modal */}
      <SettlementReceiptModal
        settlement={viewingReceipt}
        open={!!viewingReceipt}
        onOpenChange={(open) => {
          if (!open) setViewingReceipt(null);
        }}
      />

      {/* Route & Navigation Modal */}
      <DeliveryRouteModal
        open={!!routeModalOrder}
        onOpenChange={(open) => {
          if (!open) setRouteModalOrder(null);
        }}
        orderId={routeModalOrder?.id}
        orderNumber={routeModalOrder?.order_number}
        customerName={routeModalOrder?.customer_name}
        customerPhone={routeModalOrder?.customer_phone}
        customerAddress={routeModalOrder?.customer_address}
        destinationLat={routeModalOrder?.location_lat ?? null}
        destinationLng={routeModalOrder?.location_lng ?? null}
        storeAddress={settings?.store_address ?? "Fish & Fresh Store"}
        storeLat={settings?.shop_lat ?? null}
        storeLng={settings?.shop_lng ?? null}
        verticalEmoji={getVerticalConfig(settings?.business_vertical).emoji}
      />

      {/* Delivery PIN Verification Modal with Admin Override */}
      {pinModalOrder && (
        <DeliveryPinVerificationModal
          open={!!pinModalOrder}
          onOpenChange={(open) => !open && setPinModalOrder(null)}
          orderId={pinModalOrder.id}
          orderNumber={pinModalOrder.order_number}
          customerName={pinModalOrder.customer_name}
          customerPhone={pinModalOrder.customer_phone}
          fulfillmentType={pinModalOrder.fulfillment_type}
          isCod={pinModalOrder.payment_method === "cod" && pinModalOrder.payment_status !== "paid"}
          totalAmount={Number(pinModalOrder.total)}
          isAdmin={true}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin", "orders"] });
          }}
        />
      )}

      {/* Bluetooth & USB ESC/POS Printer Settings Modal */}
      <PrinterSettingsModal
        open={printerModalOpen}
        onOpenChange={setPrinterModalOpen}
      />
    </AdminShell>
  );
}
export default DriverDispatchPage;

