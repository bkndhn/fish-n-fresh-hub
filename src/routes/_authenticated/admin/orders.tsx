import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Printer,
  MessageCircle,
  Phone,
  Search,
  Calendar,
  RefreshCw,
  ExternalLink,
  MapPin,
  CheckSquare,
  Square,
  Truck,
  UserCheck,
  CheckCircle2,
  PackageCheck,
  Clock,
  Compass,
  Route as RouteIcon,
  KeyRound,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, ORDER_STATUSES, type OrderRow } from "@/lib/admin";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { DeliveryPinVerificationModal } from "@/components/DeliveryPinVerificationModal";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { settingsQuery } from "@/lib/queries";
import { formatINR, formatIST } from "@/lib/format";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders | Fish N Fresh Admin" },
      { name: "description", content: "Track, update and fulfil every Fish N Fresh seafood order in one place." },
      { property: "og:title", content: "Orders | Fish N Fresh Admin" },
      { property: "og:description", content: "Track, update and fulfil every Fish N Fresh seafood order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersAdmin,
});

function getLocalDateString(isoStr: string) {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function OrdersAdmin() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const { data: settings } = useQuery(settingsQuery);

  const todayStr = getLocalDateString(new Date().toISOString());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "this_week" | "this_month" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);
  const [routeModalOrder, setRouteModalOrder] = useState<OrderRow | null>(null);
  const [pinModalOrder, setPinModalOrder] = useState<OrderRow | null>(null);

  // Bulk Actions State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [openBulkDriver, setOpenBulkDriver] = useState(false);
  const [bulkDriverName, setBulkDriverName] = useState("Murugan (Express Delivery)");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate.toISOString());

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const allOrders = orders.data ?? [];

  // Filter rows
  const rows = allOrders.filter((o) => {
    // 1. Status Filter
    if (statusFilter !== "all" && o.status !== statusFilter) return false;

    // 2. Date Filter
    if (dateFilter === "today") {
      if (getLocalDateString(o.created_at) !== todayStr) return false;
    } else if (dateFilter === "yesterday") {
      if (getLocalDateString(o.created_at) !== yesterdayStr) return false;
    } else if (dateFilter === "this_week") {
      if (new Date(o.created_at) < sevenDaysAgo) return false;
    } else if (dateFilter === "this_month") {
      if (new Date(o.created_at) < startOfMonth) return false;
    } else if (dateFilter === "custom") {
      if (customDate && getLocalDateString(o.created_at) !== customDate) return false;
    }

    // 3. Search text
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (o.order_number ?? "").toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term) ||
      o.customer_phone.includes(term)
    );
  });

  // Calculate quick stats
  const todayCount = allOrders.filter((o) => getLocalDateString(o.created_at) === todayStr).length;

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === rows.length && rows.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(rows.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedOrderIds.length === 0) return;
    if (status === "delivered") {
      toast.error(
        "Anti-Theft Protection: Every delivery must be verified with the customer's individual 4-digit Delivery PIN. Please verify orders individually."
      );
      return;
    }
    setBulkProcessing(true);
    try {
      const patch: any = { status };
      const { error } = await supabase
        .from("orders")
        .update(patch)
        .in("id", selectedOrderIds);
      if (error) throw error;
      toast.success(`${selectedOrderIds.length} orders updated to ${status.replace(/_/g, " ")}`);
      setSelectedOrderIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkAssignDriver = async () => {
    if (selectedOrderIds.length === 0 || !bulkDriverName) return;
    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ driver_name: bulkDriverName, status: "out_for_delivery" })
        .in("id", selectedOrderIds);
      if (error) throw error;
      toast.success(`${selectedOrderIds.length} orders assigned to ${bulkDriverName}`);
      setSelectedOrderIds([]);
      setOpenBulkDriver(false);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <AdminShell title="Orders" allow={["admin", "staff"]}>
      {/* Date Filter Bar - Today as default */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Calendar className="size-3.5 text-primary" /> Period:
          </span>
          <Button
            size="sm"
            variant={dateFilter === "today" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs"
            onClick={() => setDateFilter("today")}
          >
            Today ({todayCount})
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "yesterday" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs"
            onClick={() => setDateFilter("yesterday")}
          >
            Yesterday
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "this_week" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs"
            onClick={() => setDateFilter("this_week")}
          >
            This Week
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "this_month" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs"
            onClick={() => setDateFilter("this_month")}
          >
            This Month
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "all" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs"
            onClick={() => setDateFilter("all")}
          >
            All Time ({allOrders.length})
          </Button>
        </div>

        {/* Custom date input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom Date:</span>
          <Input
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setDateFilter("custom");
            }}
            className={`h-7 w-36 rounded-lg text-xs ${dateFilter === "custom" ? "border-primary font-semibold ring-1 ring-primary" : ""}`}
          />
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, customer or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className="rounded-full text-xs"
            onClick={() => setStatusFilter("all")}
          >
            All Statuses ({rows.length})
          </Button>
          {ORDER_STATUSES.map((s) => {
            const count = allOrders.filter((o) => {
              if (dateFilter === "today" && getLocalDateString(o.created_at) !== todayStr) return false;
              if (dateFilter === "yesterday" && getLocalDateString(o.created_at) !== yesterdayStr) return false;
              if (dateFilter === "this_week" && new Date(o.created_at) < sevenDaysAgo) return false;
              if (dateFilter === "this_month" && new Date(o.created_at) < startOfMonth) return false;
              if (dateFilter === "custom" && customDate && getLocalDateString(o.created_at) !== customDate) return false;
              return o.status === s;
            }).length;

            return (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                className="rounded-full text-xs capitalize whitespace-nowrap"
                onClick={() => setStatusFilter(s)}
              >
                {s.replace(/_/g, " ")} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Sticky Bulk Action Toolbar for Orders */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 hover:bg-muted"
          >
            {selectedOrderIds.length === rows.length && rows.length > 0 ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
            <span>
              {selectedOrderIds.length > 0
                ? `${selectedOrderIds.length} of ${rows.length} selected`
                : "Select All"}
            </span>
          </Button>

          {selectedOrderIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedOrderIds([])}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {selectedOrderIds.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleBulkStatus("confirmed")}
            >
              <CheckCircle2 className="size-3.5" /> Confirm ({selectedOrderIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              onClick={() => handleBulkStatus("packed")}
            >
              <PackageCheck className="size-3.5" /> Pack
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
              onClick={() => setOpenBulkDriver(true)}
            >
              <Truck className="size-3.5" /> Assign Driver
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-green-700 dark:text-green-300 border-green-500/30 hover:bg-green-500/10"
              onClick={() => handleBulkStatus("delivered")}
            >
              <CheckCircle2 className="size-3.5" /> Mark Delivered
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((o) => {
          const isCOD = o.payment_method === "cod";
          const isDelivered = o.status === "delivered";
          const isCancelled = o.status === "cancelled";
          const isSelected = selectedOrderIds.includes(o.id);

          return (
            <Card
              key={o.id}
              className={`overflow-hidden transition ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/[0.02] shadow-sm"
                  : "border-border/80 shadow-xs hover:shadow-md"
              }`}
            >
              <CardContent className="p-3.5 sm:p-5 flex flex-col gap-3">
                {/* Header: Order Number & Customer Name + Status Pill */}
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectOne(o.id)}
                      className="text-muted-foreground hover:text-primary transition shrink-0 p-0.5"
                      title={isSelected ? "Deselect order" : "Select order for bulk action"}
                    >
                      {isSelected ? (
                        <CheckSquare className="size-5 text-primary" />
                      ) : (
                        <Square className="size-5 text-muted-foreground/60" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm sm:text-base text-foreground">
                          #{o.order_number ?? o.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          · {o.customer_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{formatIST(o.created_at)}</p>
                    </div>
                  </div>

                  <Badge
                    variant={isDelivered ? "default" : isCancelled ? "destructive" : "secondary"}
                    className={`capitalize text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      o.status === "out_for_delivery"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                        : o.status === "preparing"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        : ""
                    }`}
                  >
                    {o.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Customer Contact & Channel Bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-foreground">{o.customer_phone}</span>

                  <a
                    href={`tel:${o.customer_phone}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition"
                  >
                    <Phone className="size-3" /> Call
                  </a>

                  <a
                    href={getWhatsAppUrl(
                      o.customer_phone,
                      `Hi ${o.customer_name}, regarding your Fish N Fresh seafood order #${o.order_number ?? o.id.slice(0, 8)}...`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-700 dark:text-green-400 hover:bg-green-500/20 transition"
                  >
                    <WhatsAppIcon className="size-3.5" /> WhatsApp
                  </a>

                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="capitalize text-muted-foreground text-xs font-medium">{o.fulfillment_type}</span>
                </div>

                {/* Address with Google Maps turn-by-turn link & View Route */}
                {o.customer_address && (
                  <div className="rounded-xl bg-muted/40 p-2 text-xs flex flex-wrap items-center justify-between gap-2 border border-border/50">
                    <p className="text-foreground line-clamp-2 min-w-0 flex-1">
                      <span className="font-bold">📍 Address:</span> {o.customer_address}
                      {o.location_lat && o.location_lng && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                          ✓ Exact Pin
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRouteModalOrder(o)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold hover:bg-primary/20 transition"
                      >
                        <RouteIcon className="size-3" /> Route
                      </button>
                      <a
                        href={getGoogleMapsDirUrl(o.location_lat, o.location_lng, o.customer_address, settings?.shop_lat, settings?.shop_lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white px-2 py-0.5 text-[11px] font-bold hover:bg-blue-700 transition shadow-2xs"
                      >
                        <Compass className="size-3" /> Nav
                      </a>
                    </div>
                  </div>
                )}

                {/* Delivery Slot */}
                {o.delivery_slot && (
                  <p className="text-xs text-primary font-semibold flex items-center gap-1">
                    ⏰ Slot: {o.delivery_date ? `${o.delivery_date} · ` : ""}{o.delivery_slot}
                  </p>
                )}

                {/* Ordered Items List */}
                <div className="rounded-xl bg-muted/30 p-2.5 text-xs space-y-1 border border-border/40">
                  <p className="font-bold text-foreground">Items Ordered:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {o.items.map((i, idx) => (
                      <li key={idx} className="flex items-center justify-between">
                        <span className="text-foreground font-medium">{i.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-foreground">× {i.qty} {i.unit || "kg"}</span>
                          {(i as any).cut_preference && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary font-bold">
                              {(i as any).cut_preference}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment & COD Alert Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    {isCOD ? (
                      <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                        ⚠️ Collect Cash: {formatINR(Number(o.total))}
                      </span>
                    ) : (
                      <span className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        ✅ Paid Online ({o.payment_method.toUpperCase()})
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-extrabold font-display text-lg text-foreground">{formatINR(Number(o.total))}</p>
                  </div>
                </div>

                {/* Bottom Action Row: Print Bill + Status Selector */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8.5 text-xs font-semibold shrink-0"
                    onClick={() => setPrintOrder(o)}
                  >
                    <Printer className="mr-1.5 size-3.5" /> Bill
                  </Button>

                  <div className="flex-1">
                    <Select
                      value={o.status}
                      onValueChange={(status) => {
                        if (status === "delivered") {
                          setPinModalOrder(o);
                        } else {
                          update.mutate({ id: o.id, status });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-8.5 text-xs rounded-xl font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs capitalize">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fast Delivery PIN Verification Action */}
                  {o.status !== "delivered" && o.status !== "cancelled" && (
                    <Button
                      size="sm"
                      className="rounded-xl h-8.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 gap-1 shadow-xs"
                      onClick={() => setPinModalOrder(o)}
                      title="Verify customer 4-digit Delivery PIN to mark delivered"
                    >
                      <KeyRound className="size-3" /> Deliver
                    </Button>
                  )}
                </div>

                {o.notes && (
                  <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Note:</strong> {o.notes}
                  </p>
                )}

                {o.complaint && (
                  <div className="rounded-xl bg-destructive/10 p-2.5 text-xs border border-destructive/20">
                    <p className="font-bold text-destructive">Customer Complaint:</p>
                    <p className="text-destructive/90 mt-0.5">{o.complaint}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              No orders found for {dateFilter === "today" ? "today" : dateFilter === "yesterday" ? "yesterday" : dateFilter === "custom" ? customDate : "the selected period"}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || statusFilter !== "all" ? "Try clearing the search or status filter." : "New orders placed by customers will show up here in real time."}
            </p>
            {dateFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-xl"
                onClick={() => {
                  setDateFilter("all");
                  setStatusFilter("all");
                  setSearch("");
                }}
              >
                View All Time Orders ({allOrders.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Printable Thermal Receipt Modal */}
      <Dialog open={Boolean(printOrder)} onOpenChange={(open) => !open && setPrintOrder(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Packing Slip / Receipt</span>
              <Button size="sm" onClick={() => window.print()} className="rounded-xl">
                <Printer className="mr-1.5 size-4" /> Print Now
              </Button>
            </DialogTitle>
          </DialogHeader>

          {printOrder && (
            <div id="thermal-receipt" className="border rounded-xl p-4 bg-white text-black font-mono text-xs space-y-3">
              <div className="text-center border-b pb-2">
                <h2 className="font-bold text-sm uppercase">{(settings as any)?.firm_name || "Fish N Fresh Seafood Hub"}</h2>
                {settings?.store_address && <p className="text-[10px] text-gray-600">{settings.store_address}</p>}
                {settings?.support_phone && <p className="text-[10px] text-gray-600">Ph: {settings.support_phone}</p>}
                {settings?.fssai_number && <p className="text-[10px] text-gray-600">FSSAI: {settings.fssai_number}</p>}
              </div>

              <div className="flex justify-between border-b pb-2">
                <div>
                  <p><strong>Order:</strong> #{printOrder.order_number ?? printOrder.id.slice(0, 8)}</p>
                  <p><strong>Date:</strong> {formatIST(printOrder.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="uppercase"><strong>{printOrder.payment_method}</strong></p>
                  <p className="capitalize">{printOrder.fulfillment_type}</p>
                </div>
              </div>

              <div className="border-b pb-2">
                <p><strong>Customer:</strong> {printOrder.customer_name}</p>
                <p><strong>Phone:</strong> {printOrder.customer_phone}</p>
                {printOrder.customer_address && <p><strong>Address:</strong> {printOrder.customer_address}</p>}
                {printOrder.delivery_slot && <p><strong>Slot:</strong> {printOrder.delivery_slot}</p>}
              </div>

              <div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-1">Item / Cut</th>
                      <th className="pb-1 text-center">Qty</th>
                      <th className="pb-1 text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printOrder.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-1">
                          <p className="font-bold">{it.name}</p>
                          {(it as any).cut_preference && (
                            <p className="text-[10px] text-gray-500">Cut: {(it as any).cut_preference}</p>
                          )}
                        </td>
                        <td className="py-1 text-center">{it.qty} {it.unit || "kg"}</td>
                        <td className="py-1 text-right font-bold">{formatINR(it.price * it.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-2 space-y-1 text-right">
                <p>Subtotal: {formatINR(printOrder.subtotal)}</p>
                {Number(printOrder.discount ?? 0) > 0 && <p className="text-green-700">Discount: -{formatINR(Number(printOrder.discount))}</p>}
                <p>Delivery: {Number(printOrder.delivery_fee) === 0 ? "FREE" : formatINR(Number(printOrder.delivery_fee))}</p>
                <p className="font-bold text-sm border-t pt-1">TOTAL: {formatINR(Number(printOrder.total))}</p>
              </div>

              {printOrder.notes && (
                <div className="border-t pt-2 text-[11px]">
                  <strong>Special Instructions:</strong> {printOrder.notes}
                </div>
              )}

              <div className="text-center border-t pt-2 text-[10px] text-gray-500">
                <p>Thank you for ordering fresh catch from Fish N Fresh!</p>
                <p>Daily Fresh · Lab Tested · Hygienically Cleaned</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Driver Dialog */}
      <Dialog open={openBulkDriver} onOpenChange={setOpenBulkDriver}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Truck className="size-5 text-primary" /> Assign Driver to {selectedOrderIds.length} Orders
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Select Active Delivery Partner</Label>
              <select
                value={bulkDriverName}
                onChange={(e) => setBulkDriverName(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs"
              >
                <option value="Murugan (Express Delivery)">Murugan (Express Delivery)</option>
                <option value="Rajesh K (South Route)">Rajesh K (South Route)</option>
                <option value="Venkatesh S (Central)">Venkatesh S (Central)</option>
                <option value="Auto Smart Workload Balancing">Auto Smart Workload Balancing</option>
              </select>
            </div>

            <div className="rounded-xl border p-3 bg-muted/30 text-xs text-muted-foreground">
              Selected orders will be advanced to <strong>Out for Delivery</strong> and linked directly under this driver's route manifest.
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setOpenBulkDriver(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl font-bold"
                disabled={bulkProcessing}
                onClick={handleBulkAssignDriver}
              >
                {bulkProcessing ? "Assigning..." : `Assign to ${selectedOrderIds.length} Orders`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Route & Turn-by-Turn Navigation Modal */}
      {routeModalOrder && (
        <DeliveryRouteModal
          open={!!routeModalOrder}
          onOpenChange={(open) => !open && setRouteModalOrder(null)}
          orderNumber={routeModalOrder.order_number ?? routeModalOrder.id.slice(0, 8)}
          customerName={routeModalOrder.customer_name}
          customerPhone={routeModalOrder.customer_phone}
          customerAddress={routeModalOrder.customer_address}
          destLat={routeModalOrder.location_lat}
          destLng={routeModalOrder.location_lng}
          storeLat={settings?.shop_lat}
          storeLng={settings?.shop_lng}
          storeAddress={settings?.store_address || "Fish N Fresh Seafood Hub"}
          driverName={routeModalOrder.driver_name}
        />
      )}

      {/* Secret Delivery PIN Verification Modal with Admin Bypass */}
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
    </AdminShell>
  );
}
