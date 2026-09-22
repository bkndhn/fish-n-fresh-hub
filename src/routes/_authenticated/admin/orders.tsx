import { createFileRoute } from "@tanstack/react-router";
import type { CartItem } from "@/lib/types";
import type { Database } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
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
  Wallet,
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
  Download,
  Receipt,
  FileText,
  Scale,
  Repeat,
  Copy,
  Share2,
} from "lucide-react";
import { generateDueSubscriptionOrders } from "@/lib/subscriptions.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminBranch } from "@/lib/branchContext";
import { adminOrdersQuery, ORDER_STATUSES, type OrderRow } from "@/lib/admin";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { DeliveryPinVerificationModal } from "@/components/DeliveryPinVerificationModal";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { settingsQuery } from "@/lib/queries";
import { formatINR, formatIST, formatInvoiceDateTime } from "@/lib/format";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { restoreOrderStock } from "@/lib/inventorySync";
import { updateOrderStatusWithEmail, updateOrderWeightAndPrice } from "@/lib/orders.functions";
import { updateCourierDetails } from "@/lib/tracking.functions";
import { updateReturnStatus, processRefundToWallet } from "@/lib/returns.functions";
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
import type { SiteSettings } from '@/lib/types';
import { extractScopeBadge } from "@/lib/shippingScope";

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

function getLocalDateString(isoStr: string): string {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function OrdersAdmin() {
  const qc = useQueryClient();
  const { selectedBranchId, selectedBranch, isConsolidated } = useAdminBranch();
  const orders = useQuery(adminOrdersQuery(selectedBranchId));
  const { data: settings } = useQuery(settingsQuery);

  const todayStr = getLocalDateString(new Date().toISOString());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "this_week" | "this_month" | "all" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);
  const [routeModalOrder, setRouteModalOrder] = useState<OrderRow | null>(null);
  const [pinModalOrder, setPinModalOrder] = useState<OrderRow | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRow | null>(null);
  const [shippingModalOrder, setShippingModalOrder] = useState<OrderRow | null>(null);
  const [weightModalOrder, setWeightModalOrder] = useState<OrderRow | null>(null);
  const [weightForm, setWeightForm] = useState({ weight: "", price: "" });
  const [shippingForm, setShippingForm] = useState({ partner: "", awb: "", url: "" });
  const [shippedOrderData, setShippedOrderData] = useState<{ order: OrderRow; partner: string; awb: string; url: string } | null>(null);

  // Subscriptions & MRR Pipeline State
  const { data: adminSubscriptions = [], refetch: refetchAdminSubs } = useQuery({
    queryKey: ["admin", "all-subscriptions", selectedBranchId],
    queryFn: async () => {
      let q = supabase
        .from("customer_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (selectedBranchId && selectedBranchId !== "all") {
        q = q.eq("branch_id", selectedBranchId);
      }
      const { data, error } = await q;
      if (error) return [];
      return data || [];
    },
  });
  const [subTabOpen, setSubTabOpen] = useState(false);
  const [generatingSubs, setGeneratingSubs] = useState(false);

  // Bulk Actions State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [openBulkDriver, setOpenBulkDriver] = useState(false);
  const [bulkDriverName, setBulkDriverName] = useState("Murugan (Express Delivery)");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Helper to strip automated tracking URLs and display only customer notes
  const cleanOrderNotes = (rawNotes: string | null | undefined): string | null => {
    if (!rawNotes) return null;
    let text = rawNotes;
    if (text.includes("Order via WhatsApp Deep Link")) {
      const match = text.match(/\|\s*Notes?:\s*(.+)$/i);
      if (match && match[1]?.trim()) {
        text = match[1].trim();
      } else {
        return null;
      }
    }
    text = text.replace(/\|\s*Nav:\s*https?:\/\/\S+/gi, "").trim();
    return text || null;
  };

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Database["public"]["Tables"]["orders"]["Update"] = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "delivered") {
        patch.delivered_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      // 2. If cancelled, restore stock
      if (status === "cancelled") {
        try {
          await restoreOrderStock(id);
        } catch (e) {
          console.warn("[OrdersAdmin] Stock restoral notice:", e);
        }
      }

      // 3. Trigger email notification in background (non-blocking)
      try {
        await updateOrderStatusWithEmail({ data: { orderId: id, status } });
      } catch (err) {
        console.warn("[OrdersAdmin] Email trigger notice:", err);
      }
    },
    onSuccess: () => {
      toast.success("Order status updated!");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveWeightAndPrice = useMutation({
    mutationFn: async () => {
      if (!weightModalOrder) return;
      await updateOrderWeightAndPrice({
        orderId: weightModalOrder.id,
        total: Number(weightForm.price),
        weight: Number(weightForm.weight),
      });
    },
    onSuccess: () => {
      toast.success("Weight and final price updated successfully!");
      setWeightModalOrder(null);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveShippingDetails = useMutation({
    mutationFn: async () => {
      if (!shippingModalOrder) return;
      await updateCourierDetails(
        shippingModalOrder.id,
        shippingForm.partner,
        shippingForm.awb,
        shippingForm.url
      );
    },
    onSuccess: () => {
      toast.success("Shipment confirmed! Share tracking with customer below.");
      // Keep modal open to show the share panel
      setShippedOrderData({
        order: shippingModalOrder!,
        partner: shippingForm.partner,
        awb: shippingForm.awb,
        url: shippingForm.url,
      });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleReturnAction = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "returned" }) => {
      await updateReturnStatus(id, status);
    },
    onSuccess: () => {
      toast.success("Return status updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleRefund = useMutation({
    mutationFn: async ({ id, customerId, amount }: { id: string; customerId: string; amount: number }) => {
      await processRefundToWallet(id, customerId, amount);
    },
    onSuccess: () => {
      toast.success("Refund processed to customer wallet");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyUpiPayment = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          upi_paid: true,
          status: "confirmed",
        })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("UPI payment verified & marked as PAID!");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to verify UPI payment");
    }
  };

  const markOrderPaid = async (orderId: string, method?: string) => {
    try {
      const isUpi = method === "upi";
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          ...(isUpi ? { upi_paid: true } : {}),
        })
        .eq("id", orderId);
      if (error) throw error;
      toast.success(`Payment marked as PAID!`);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to mark payment as paid");
    }
  };

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

  const ordersExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "order_number", label: "Order #", type: "string", format: (v, r) => v ?? r.id.slice(0, 8) },
      { key: "created_at", label: "Date & Time (IST)", type: "date", format: (v) => formatIST(v) },
      { key: "customer_name", label: "Customer Name", type: "string" },
      { key: "customer_phone", label: "Customer Phone", type: "string" },
      { key: "customer_address", label: "Delivery Address", type: "string" },
      { key: "status", label: "Order Status", type: "string" },
      { key: "fulfillment_type", label: "Fulfillment", type: "string" },
      { key: "payment_method", label: "Payment Method", type: "string" },
      { key: "total", label: "Order Total (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "driver_name", label: "Assigned Driver", type: "string" },
    ];
    return {
      filename: `fishnfresh-orders-${dateFilter}-${new Date().toISOString().slice(0, 10)}`,
      title: "Orders Register & Fulfillment Sheet",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | Period: ${dateFilter.toUpperCase()} | ${rows.length} orders`,
      columns,
      data: rows,
      orientation: "landscape",
    };
  }, [rows, dateFilter]);

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
      if (status === "cancelled") {
        for (const orderId of selectedOrderIds) {
          await restoreOrderStock(orderId);
        }
      }
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
    <AdminShell title="Orders" allow={["admin", "manager", "cashier", "support_staff", "staff"]}>
      {/* Date Filter Bar - Today as default */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3 w-full min-w-0">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x scroll-smooth no-scrollbar py-0.5 w-full sm:w-auto min-w-0">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1 shrink-0">
            <Calendar className="size-3.5 text-primary" /> Period:
          </span>
          <Button
            size="sm"
            variant={dateFilter === "today" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs shrink-0"
            onClick={() => setDateFilter("today")}
          >
            Today ({todayCount})
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "yesterday" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs shrink-0"
            onClick={() => setDateFilter("yesterday")}
          >
            Yesterday
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "this_week" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs shrink-0"
            onClick={() => setDateFilter("this_week")}
          >
            This Week
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "this_month" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs shrink-0"
            onClick={() => setDateFilter("this_month")}
          >
            This Month
          </Button>
          <Button
            size="sm"
            variant={dateFilter === "all" ? "default" : "ghost"}
            className="h-7 rounded-lg text-xs shrink-0"
            onClick={() => setDateFilter("all")}
          >
            All Time ({allOrders.length})
          </Button>
        </div>

        {/* Custom date input, Subscriptions Drawer Toggle & Export Dropdown */}
        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter("custom");
              }}
              className={`h-7 w-32 rounded-lg text-xs ${dateFilter === "custom" ? "border-primary font-semibold ring-1 ring-primary" : ""}`}
            />
          </div>

          <Button
            size="sm"
            variant={subTabOpen ? "default" : "outline"}
            className={`h-7.5 rounded-xl text-xs font-bold gap-1.5 shrink-0 transition-all ${
              subTabOpen
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            }`}
            onClick={() => setSubTabOpen((prev) => !prev)}
            title="Toggle Recurring Subscriptions & MRR Pipeline Drawer"
          >
            <Repeat className="size-3 text-emerald-600 dark:text-emerald-400" />
            <span>Subscriptions</span>
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-mono">
              {adminSubscriptions.filter((s: any) => s.status === "active").length}
            </span>
          </Button>

          <div className="shrink-0">
            <ExportDropdown options={ordersExportOptions} buttonLabel="Export Orders" />
          </div>
        </div>
      </div>

      {/* Recurring Subscriptions & MRR Pipeline Drawer */}
      {subTabOpen && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-card p-4 space-y-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Repeat className="size-4 text-emerald-600" /> Recurring Seafood Subscriptions &amp; MRR
                </h3>
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold px-2 py-0.2">
                  Active MRR: {formatINR(adminSubscriptions.filter((s: any) => s.status === "active").reduce((acc: number, s: any) => acc + (Number(s.total_price) * (s.frequency === "daily" ? 26 : s.frequency === "bi_weekly" ? 2 : 4)), 0))}/mo
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage scheduled weekly fish repeat deliveries and batch convert due subscriptions into today's packing pipeline.
              </p>
            </div>

            <Button
              size="sm"
              disabled={generatingSubs}
              className="h-8 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 self-start sm:self-auto"
              onClick={async () => {
                try {
                  setGeneratingSubs(true);
                  const res = await generateDueSubscriptionOrders();
                  toast.success(`Generated ${res.ordersGenerated} order(s) for today's packing pipeline!`);
                  qc.invalidateQueries({ queryKey: ["admin", "orders"] });
                  refetchAdminSubs();
                } catch (e: any) {
                  toast.error(e.message || "Failed to generate subscription orders");
                } finally {
                  setGeneratingSubs(false);
                }
              }}
            >
              <CheckCircle2 className="size-3.5" />
              {generatingSubs ? "Generating Orders..." : "Generate Today's Subscription Orders"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {adminSubscriptions.map((sub: any) => (
              <div key={sub.id} className="rounded-xl border border-border/70 p-2.5 bg-muted/20 text-xs space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-foreground truncate">{sub.customer_name}</span>
                  <Badge className="text-[10px] capitalize">{sub.status}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{sub.product_name}</span>
                  <span className="font-mono font-bold text-foreground">{formatINR(sub.total_price)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex justify-between pt-1 border-t border-border/40">
                  <span>Every {sub.day_of_week} ({sub.frequency})</span>
                  <span>Next: {formatIST(sub.next_delivery_date).slice(0, 11)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

        <div 
          className="flex items-center gap-1.5 overflow-x-auto min-w-0 max-w-full touch-pan-x scroll-smooth no-scrollbar pb-1"
          onWheel={(e) => {
            if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className="rounded-full text-xs shrink-0"
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
                className="rounded-full text-xs capitalize whitespace-nowrap shrink-0"
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
          const scopeBadge = extractScopeBadge(o.notes);

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

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {scopeBadge && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scopeBadge.badgeClass}`}>
                        {scopeBadge.label}
                      </Badge>
                    )}
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
                          {(i as CartItem).cut_preference && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary font-bold">
                              {(i as CartItem).cut_preference}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment & COD / WhatsApp / UPI Alert Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isCOD ? (
                      <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                        ⚠️ Collect Cash: {formatINR(Number(o.total))}
                      </span>
                    ) : o.payment_method === "whatsapp" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.payment_status === "paid" ? (
                          <span className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            ✅ Paid (WhatsApp Verified)
                          </span>
                        ) : (
                          <>
                            <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                              ⏳ WhatsApp Order: Collect {formatINR(Number(o.total))} (Unpaid)
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold rounded-lg text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                              onClick={() => markOrderPaid(o.id, "whatsapp")}
                            >
                              <CheckCircle2 className="size-3" /> Mark Paid
                            </Button>
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-semibold rounded-lg text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10 gap-1"
                            >
                              <a
                                href={getWhatsAppUrl(
                                  o.customer_phone,
                                  `Hi ${o.customer_name}, regarding your order #${o.order_number ?? o.id.slice(0, 8)} of ${formatINR(Number(o.total))}: Please confirm your payment mode (Cash on Delivery or UPI). UPI ID: ${settings?.upi_id || "our UPI"}. Thank you!`
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <WhatsAppIcon className="size-3" /> WhatsApp Customer
                              </a>
                            </Button>
                          </>
                        )}
                      </div>
                    ) : o.payment_method === "upi" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(o as unknown as Database["public"]["Tables"]["orders"]["Row"]).upi_paid || o.payment_status === "paid" ? (
                          <span className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            ✅ UPI Verified Paid {(o as unknown as Database["public"]["Tables"]["orders"]["Row"]).actual_payment_ref ? `(UTR: ${(o as unknown as Database["public"]["Tables"]["orders"]["Row"]).actual_payment_ref})` : ""}
                          </span>
                        ) : (
                          <>
                            <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                              ⏳ UPI Verification Pending {(o as unknown as Database["public"]["Tables"]["orders"]["Row"]).actual_payment_ref ? `(UTR: ${(o as unknown as Database["public"]["Tables"]["orders"]["Row"]).actual_payment_ref})` : ""}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold rounded-lg text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                              onClick={() => markOrderPaid(o.id, "upi")}
                            >
                              <CheckCircle2 className="size-3" /> Mark Verified
                            </Button>
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-semibold rounded-lg text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10 gap-1"
                            >
                              <a
                                href={getWhatsAppUrl(
                                  o.customer_phone,
                                  `Hi ${o.customer_name}, your order #${o.order_number ?? o.id.slice(0, 8)} of ${formatINR(Number(o.total))} is awaiting UPI payment. Please pay to UPI ID ${settings?.upi_id || "our UPI"} or tap: upi://pay?pa=${settings?.upi_id || ""}&pn=FishNFresh&am=${o.total}&cu=INR. Thank you!`
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <WhatsAppIcon className="size-3" /> Payment Reminder
                              </a>
                            </Button>
                          </>
                        )}
                      </div>
                    ) : o.payment_status === "paid" ? (
                      <span className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        ✅ Paid Online ({o.payment_method.toUpperCase()})
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-xl bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                          ⏳ Payment Pending ({o.payment_method.toUpperCase()}): Collect {formatINR(Number(o.total))}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-bold rounded-lg text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                          onClick={() => markOrderPaid(o.id, o.payment_method)}
                        >
                          <CheckCircle2 className="size-3" /> Mark Paid
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-extrabold font-display text-lg text-foreground">{formatINR(Number(o.total))}</p>
                  </div>
                </div>

                {/* Bottom Action Row: Print Bill + Tax Invoice + Status Selector (Mobile-responsive layout) */}
                <div className="pt-1.5 border-t border-border/50">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    {/* Bill & Invoice actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-initial rounded-xl h-8.5 text-xs font-semibold"
                        onClick={() => setPrintOrder(o)}
                      >
                        <Printer className="mr-1.5 size-3.5" /> Bill
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-initial rounded-xl h-8.5 text-xs font-semibold border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                        onClick={() => setInvoiceOrder(o)}
                      >
                        <FileText className="mr-1.5 size-3.5 text-sky-600" /> Invoice
                      </Button>

                      {o.status === "processing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-initial rounded-xl h-8.5 text-xs font-semibold border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          onClick={() => {
                            setWeightForm({ weight: o.pos_scale_weight_kg?.toString() || "", price: o.total?.toString() || "" });
                            setWeightModalOrder(o);
                          }}
                        >
                          <Scale className="mr-1.5 size-3.5 text-amber-600" /> Scale
                        </Button>
                      )}
                    </div>

                    {/* Status dropdown and Deliver button */}
                    <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                      <div className="flex-1 min-w-[130px]">
                        <Select
                          value={o.status}
                          onValueChange={(status) => {
                            if (status === "delivered") {
                              setPinModalOrder(o);
                            } else if (status === "shipped") {
                              setShippingForm({ partner: "", awb: "", url: "" });
                              setShippingModalOrder(o);
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
                          className="rounded-xl h-8.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 gap-1 shadow-xs px-3"
                          onClick={() => setPinModalOrder(o)}
                          title="Verify customer 4-digit Delivery PIN to mark delivered"
                        >
                          <KeyRound className="size-3" /> Deliver
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {cleanOrderNotes(o.notes) && (
                  <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Customer Note:</strong> {cleanOrderNotes(o.notes)}
                  </p>
                )}

                {o.complaint && (
                  <div className="rounded-xl bg-destructive/10 p-2.5 text-xs border border-destructive/20">
                    <p className="font-bold text-destructive">Customer Complaint:</p>
                    <p className="text-destructive/90 mt-0.5">{o.complaint}</p>
                  </div>
                )}

                {/* Returns Management Block */}
                {o.return_status && (
                  <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 p-3 text-xs border border-indigo-200 dark:border-indigo-800">
                    <div className="flex flex-wrap gap-4 justify-between items-start">
                      <div>
                        <p className="font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-1.5">
                          <RefreshCw className="size-3.5" />
                          Return Status: <span className="uppercase tracking-wider">{o.return_status}</span>
                        </p>
                        <p className="text-indigo-700 dark:text-indigo-300 mt-1">
                          <strong>Reason:</strong> {o.return_reason || "N/A"}
                        </p>
                        {o.return_requested_at && (
                          <p className="text-[10px] text-indigo-500 mt-0.5">
                            Requested at {formatIST(o.return_requested_at)}
                          </p>
                        )}
                        {o.refund_status === "processed" && (
                          <p className="font-bold text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Refunded ₹{o.refund_amount} to Wallet
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 shrink-0">
                        {o.return_status === "requested" && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleReturnAction.mutate({ id: o.id, status: "approved" })}
                              disabled={handleReturnAction.isPending}
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-[10px] border-rose-500 text-rose-700 hover:bg-rose-50"
                              onClick={() => handleReturnAction.mutate({ id: o.id, status: "rejected" })}
                              disabled={handleReturnAction.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {o.return_status === "approved" && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => handleReturnAction.mutate({ id: o.id, status: "returned" })}
                            disabled={handleReturnAction.isPending}
                          >
                            Mark Item as Returned
                          </Button>
                        )}
                        {(o.return_status === "returned" || o.return_status === "approved") && o.refund_status !== "processed" && (
                          <Button 
                            size="sm" 
                            variant="default"
                            className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => {
                              if (confirm(`Issue full refund of ₹${o.total} to customer wallet?`)) {
                                handleRefund.mutate({ id: o.id, customerId: o.user_id as string, amount: Number(o.total) });
                              }
                            }}
                            disabled={handleRefund.isPending || !o.user_id}
                          >
                            <Wallet className="size-3 mr-1" /> Refund to Wallet
                          </Button>
                        )}
                      </div>
                    </div>
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
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md rounded-2xl p-4 sm:p-6 max-h-[88vh] overflow-y-auto overflow-x-hidden">
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
                <h2 className="font-bold text-sm uppercase">{(settings as SiteSettings)?.firm_name || "Fish N Fresh Seafood Hub"}</h2>
                {settings?.store_address && <p className="text-[10px] text-gray-600">{settings.store_address}</p>}
                {settings?.support_phone && <p className="text-[10px] text-gray-600">Ph: {settings.support_phone}</p>}
                {settings?.fssai_number && <p className="text-[10px] text-gray-600">FSSAI: {settings.fssai_number}</p>}
              </div>

              <div className="flex justify-between border-b pb-2">
                <div>
                  <p><strong>Order:</strong> #{printOrder.order_number ?? printOrder.id.slice(0, 8)}</p>
                  <p><strong>Date &amp; Time:</strong> {formatInvoiceDateTime(printOrder.created_at)}</p>
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
                          {(it as CartItem).cut_preference && (
                            <p className="text-[10px] text-gray-500">Cut: {(it as CartItem).cut_preference}</p>
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
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md rounded-3xl p-4 sm:p-5 max-h-[88vh] overflow-y-auto overflow-x-hidden">
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
          isCod={pinModalOrder.payment_method === "cod" || pinModalOrder.payment_status !== "paid"}
          totalAmount={Number(pinModalOrder.total)}
          isAdmin={true}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin", "orders"] });
          }}
        />
      )}

      {/* Official GSTIN Tax Invoice Modal */}
      {invoiceOrder && (
        <TaxInvoiceModal
          isOpen={!!invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          order={invoiceOrder}
          settings={settings}
        />
      )}
      {/* Shipping / Courier Modal */}
      <Dialog
        open={!!shippingModalOrder}
        onOpenChange={(open) => {
          if (!open) {
            setShippingModalOrder(null);
            setShippedOrderData(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md rounded-3xl p-4 sm:p-6 max-h-[88vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              {shippedOrderData ? "Shipment Confirmed ✓" : "Mark as Shipped"}
            </DialogTitle>
          </DialogHeader>

          {/* ── PHASE 1: Form ── */}
          {!shippedOrderData && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courier Partner</label>
                <Input
                  placeholder="e.g. Delhivery, BlueDart, Shiprocket, DTDC"
                  value={shippingForm.partner}
                  onChange={(e) => setShippingForm({ ...shippingForm, partner: e.target.value })}
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AWB / Tracking Number</label>
                <Input
                  placeholder="e.g. 1234567890"
                  value={shippingForm.awb}
                  onChange={(e) => setShippingForm({ ...shippingForm, awb: e.target.value })}
                  className="h-9 rounded-xl text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tracking URL <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  placeholder="https://track.delhivery.com/..."
                  value={shippingForm.url}
                  onChange={(e) => setShippingForm({ ...shippingForm, url: e.target.value })}
                  className="h-9 rounded-xl text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Paste the direct tracking page URL. Customer can click to track live.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => { setShippingModalOrder(null); setShippedOrderData(null); }}
                  className="rounded-xl h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveShippingDetails.mutate()}
                  disabled={saveShippingDetails.isPending || !shippingForm.awb.trim()}
                  className="rounded-xl h-9 text-xs font-bold shadow-xs px-6"
                >
                  {saveShippingDetails.isPending ? "Saving..." : "Confirm Shipment →"}
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE 2: Share Panel after save ── */}
          {shippedOrderData && (
            <div className="space-y-4 py-2">
              {/* Summary badge */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="size-4" />
                  Order #{shippedOrderData.order.order_number ?? shippedOrderData.order.id.slice(0, 8)} is now Shipped
                </div>
                {shippedOrderData.partner && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Truck className="size-3" /> <strong>{shippedOrderData.partner}</strong>
                  </p>
                )}
                {shippedOrderData.awb && (
                  <p className="text-xs font-mono text-foreground">
                    AWB: <strong>{shippedOrderData.awb}</strong>
                  </p>
                )}
              </div>

              {/* Share options */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Share tracking with customer</p>

                {/* WhatsApp deep link */}
                {(() => {
                  const o = shippedOrderData.order;
                  const trackingLine = shippedOrderData.url
                    ? `\n🔗 Track here: ${shippedOrderData.url}`
                    : "";
                  const awbLine = shippedOrderData.awb
                    ? `\n📦 AWB: ${shippedOrderData.awb} (${shippedOrderData.partner || "Courier"})`
                    : "";
                  const msg = `Hi ${o.customer_name}! 🐟\n\nYour Fish N Fresh order #${o.order_number ?? o.id.slice(0, 8)} has been shipped!${awbLine}${trackingLine}\n\nExpected delivery in 1-3 days. Thank you for shopping with us! 🙏`;
                  const waUrl = getWhatsAppUrl(o.customer_phone, msg);

                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/8 hover:bg-green-500/15 px-4 py-3 transition-all group"
                    >
                      <WhatsAppIcon className="size-5 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-green-800 dark:text-green-300">WhatsApp Customer</p>
                        <p className="text-[11px] text-muted-foreground truncate">{o.customer_phone}</p>
                      </div>
                      <Share2 className="size-4 text-green-600 opacity-70 group-hover:opacity-100" />
                    </a>
                  );
                })()}

                {/* Copy tracking URL button */}
                {shippedOrderData.url && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 px-4 py-3 transition-all text-left"
                    onClick={() => {
                      navigator.clipboard.writeText(shippedOrderData.url).then(() => {
                        toast.success("Tracking URL copied!");
                      });
                    }}
                  >
                    <Copy className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Copy Tracking Link</p>
                      <p className="text-[11px] text-muted-foreground truncate">{shippedOrderData.url}</p>
                    </div>
                  </button>
                )}

                {/* Copy AWB */}
                {shippedOrderData.awb && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 px-4 py-3 transition-all text-left"
                    onClick={() => {
                      navigator.clipboard.writeText(shippedOrderData.awb).then(() => {
                        toast.success("AWB number copied!");
                      });
                    }}
                  >
                    <Copy className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Copy AWB Number</p>
                      <p className="text-[11px] font-mono text-muted-foreground">{shippedOrderData.awb}</p>
                    </div>
                  </button>
                )}
              </div>

              <Button
                className="w-full rounded-xl font-bold"
                onClick={() => { setShippingModalOrder(null); setShippedOrderData(null); }}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Weight & Price Adjustment Modal */}
      <Dialog open={!!weightModalOrder} onOpenChange={(open) => !open && setWeightModalOrder(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Scale className="size-5 text-amber-500" />
              Scale Verification
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Adjust the final weight and price for order #{weightModalOrder?.order_number ?? weightModalOrder?.id.slice(0, 8)}.
              This is usually done after packing fresh cuts.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Actual Scaled Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1.25"
                  value={weightForm.weight}
                  onChange={(e) => setWeightForm({ ...weightForm, weight: e.target.value })}
                  className="rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Final Bill Total (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 450"
                  value={weightForm.price}
                  onChange={(e) => setWeightForm({ ...weightForm, price: e.target.value })}
                  className="rounded-xl h-10 font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setWeightModalOrder(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => saveWeightAndPrice.mutate()}
                disabled={saveWeightAndPrice.isPending || !weightForm.price}
              >
                {saveWeightAndPrice.isPending ? "Saving..." : "Update Total"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
