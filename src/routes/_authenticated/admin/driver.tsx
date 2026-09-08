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
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, type OrderRow } from "@/lib/admin";
import { listDrivers, type DriverOption } from "@/lib/staff.functions";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { settingsQuery } from "@/lib/queries";
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

  const [activeTab, setActiveTab] = useState<"dispatch" | "analytics">("dispatch");
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [routeModalOrder, setRouteModalOrder] = useState<OrderRow | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-driver-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

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

  // Driver Performance Analytics Aggregator
  const driverAnalytics = useMemo(() => {
    const stats = new Map<
      string,
      {
        name: string;
        phone: string;
        activeRuns: number;
        completedRuns: number;
        codCollected: number;
        prepaidDelivered: number;
        onTimeCount: number;
        totalMins: number;
      }
    >();

    // Seed known drivers
    for (const d of drivers) {
      stats.set(d.name || d.id, {
        name: d.name || d.email,
        phone: d.phone || "",
        activeRuns: 0,
        completedRuns: 0,
        codCollected: 0,
        prepaidDelivered: 0,
        onTimeCount: 0,
        totalMins: 0,
      });
    }

    for (const o of allOrders) {
      if (!o.driver_name) continue;
      const cur = stats.get(o.driver_name) || {
        name: o.driver_name,
        phone: "",
        activeRuns: 0,
        completedRuns: 0,
        codCollected: 0,
        prepaidDelivered: 0,
        onTimeCount: 0,
        totalMins: 0,
      };

      if (o.status === "delivered") {
        cur.completedRuns++;
        if (o.payment_method === "cod" || o.payment_status === "paid") {
          if (o.payment_method === "cod") {
            cur.codCollected += Number(o.total || 0);
          } else {
            cur.prepaidDelivered += Number(o.total || 0);
          }
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <TabsList className="h-9 rounded-xl p-1 bg-muted/60">
            <TabsTrigger value="dispatch" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Truck className="size-3.5" /> Live Dispatch ({activeDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Award className="size-3.5 text-amber-500" /> Driver Performance & Cash
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
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
                              className={`rounded-xl h-8.5 text-xs font-bold px-2 ${
                                isCod ? "bg-amber-600 hover:bg-amber-500 text-white shadow-xs" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                              }`}
                              onClick={() => {
                                const promptText = isCod
                                  ? `Confirm cash collected of ${formatINR(Number(o.total))} and mark delivered?`
                                  : "Mark order as successfully delivered?";
                                if (confirm(promptText)) {
                                  updateOrder.mutate({
                                    id: o.id,
                                    patch: {
                                      status: "delivered",
                                      delivered_at: new Date().toISOString(),
                                      payment_status: "paid",
                                    },
                                  });
                                }
                              }}
                            >
                              <CheckCircle2 className="size-3 mr-1" />
                              {isCod ? "Collect" : "Delivered"}
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
            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Active Fleets</p>
                  <Users className="size-4 text-primary" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold">{driverAnalytics.length} Drivers</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Registered delivery staff</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-xs">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total COD Cash Collected</p>
                  <Wallet className="size-4 text-amber-500" />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(driverAnalytics.reduce((s, d) => s + d.codCollected, 0))}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Physical cash to remit at counter</p>
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
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">COD In Hand</p>
                        <p className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                          {formatINR(d.codCollected)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Completed</p>
                        <p className="font-bold text-foreground text-sm">
                          {d.completedRuns} orders
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Active Runs</p>
                        <p className="font-bold text-primary">
                          {d.activeRuns} in flight
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">On-Time SLA</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {d.onTimeRate}% ({d.avgSpeed}m)
                        </p>
                      </div>
                    </div>
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
                      <th className="p-3.5 font-semibold">COD Cash In Hand</th>
                      <th className="p-3.5 font-semibold">Prepaid Value</th>
                      <th className="p-3.5 font-semibold">On-Time SLA</th>
                      <th className="p-3.5 font-semibold">Avg Run Time</th>
                      <th className="p-3.5 font-semibold">Status</th>
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
                            {formatINR(d.codCollected)}
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{formatINR(d.prepaidDelivered)}</td>
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
                            {d.onTimeRate}%
                          </span>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{d.avgSpeed} mins</td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {d.activeRuns > 0 ? "On Delivery" : "Ready"}
                          </span>
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
      </Tabs>

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
      />
    </AdminShell>
  );
}
export default DriverDispatchPage;

