import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  IndianRupee,
  Package,
  ReceiptText,
  Users,
  Store,
  Truck,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Clock,
  ArrowUpRight,
  Plus,
  Repeat,
  ShoppingBag,
  Zap,
  Flame,
  CheckCircle2,
  Anchor,
  Compass,
  Calendar,
  Layers,
  ArrowRight,
  Eye,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminBranch } from "@/lib/branchContext";
import { adminCustomersQuery, adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { settingsQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { getStoreStatus } from "@/lib/storeSchedule";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Command Center | Fish N Fresh Admin" },
      { name: "description", content: "Live omnichannel sales, orders, and stock command center for Fish N Fresh Hub." },
    ],
  }),
  component: Dashboard,
});

function getLocalDateString(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

function Dashboard() {
  const { selectedBranchId, selectedBranch, isConsolidated } = useAdminBranch();
  const orders = useQuery(adminOrdersQuery(selectedBranchId));
  const products = useQuery(adminProductsQuery(selectedBranchId));
  const customers = useQuery(adminCustomersQuery(selectedBranchId));
  const { data: settings } = useQuery(settingsQuery);

  const [timeframe, setTimeframe] = useState<"today" | "all">("today");

  const allOrders = orders.data ?? [];
  const allProducts = products.data ?? [];
  const allCustomers = customers.data ?? [];

  const storeStatus = settings ? getStoreStatus(settings) : null;

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const todayOrders = useMemo(() => {
    return allOrders.filter((o) => getLocalDateString(o.created_at) === todayStr);
  }, [allOrders, todayStr]);

  const activeOrders = timeframe === "today" ? todayOrders : allOrders;

  // Financial calculations
  const nonCancelled = activeOrders.filter((o) => o.status !== "cancelled");
  const grossRevenue = nonCancelled.reduce((s, o) => s + Number(o.total || 0), 0);
  const orderCount = activeOrders.length;
  const aov = orderCount > 0 ? Math.round(grossRevenue / (nonCancelled.length || 1)) : 0;

  // POS vs Online breakdown
  const posOrders = activeOrders.filter((o) => (o as any).source === "pos" || (o.notes || "").toLowerCase().includes("pos"));
  const onlineOrders = activeOrders.filter((o) => (o as any).source !== "pos" && !(o.notes || "").toLowerCase().includes("pos"));
  const posRevenue = posOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
  const onlineRevenue = onlineOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);

  // Fulfillment pipeline counts
  const pendingConfirmation = allOrders.filter((o) => o.status === "pending").length;
  const inPacking = allOrders.filter((o) => ["confirmed", "preparing"].includes(o.status)).length;
  const outForDelivery = allOrders.filter((o) => o.status === "out_for_delivery").length;
  const deliveredToday = todayOrders.filter((o) => o.status === "delivered").length;

  // Inventory analytics
  const lowStock = allProducts.filter((p) => (p.stock ?? 0) <= (p.low_stock_threshold ?? 5));
  const outOfStock = allProducts.filter((p) => (p.stock ?? 0) <= 0 || p.is_available === false);

  // Top Products calculation from line items
  const topProducts = useMemo(() => {
    const productStats: Record<string, { name: string; count: number; revenue: number; unit: string }> = {};
    for (const order of activeOrders) {
      if (order.status === "cancelled") continue;
      const items = Array.isArray((order as any).items) ? (order as any).items : [];
      for (const item of items) {
        const key = item.name || item.product_id || "Unknown";
        if (!productStats[key]) {
          productStats[key] = {
            name: item.name || "Seafood Item",
            count: 0,
            revenue: 0,
            unit: item.unit || "kg",
          };
        }
        productStats[key].count += Number(item.qty || 1);
        productStats[key].revenue += Number(item.price || 0) * Number(item.qty || 1);
      }
    }
    return Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [activeOrders]);

  return (
    <AdminShell 
      title="Store Operations & Command Center" 
      allow={["admin", "manager", "staff"]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-muted p-0.5 border border-border/70">
            <Button
              size="sm"
              variant={timeframe === "today" ? "default" : "ghost"}
              className="h-7.5 rounded-lg text-xs font-semibold px-3"
              onClick={() => setTimeframe("today")}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={timeframe === "all" ? "default" : "ghost"}
              className="h-7.5 rounded-lg text-xs font-semibold px-3"
              onClick={() => setTimeframe("all")}
            >
              All-Time
            </Button>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8.5 rounded-xl font-bold gap-1.5 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-2xs"
            title="Open live customer storefront in new tab to test shopping experience"
          >
            <Link to="/" target="_blank" rel="noopener noreferrer">
              <Eye className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>Customer Storefront</span>
              <ExternalLink className="size-3 opacity-60 ml-0.5" />
            </Link>
          </Button>
          <Link to="/admin/pos">
            <Button size="sm" className="h-8.5 rounded-xl font-bold gap-1.5 bg-primary text-primary-foreground shadow-2xs">
              <Store className="size-4" /> POS Counter
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Active Branch Operational Scope Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card/70 px-4 py-2.5 text-xs shadow-2xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">Active Operational Scope:</span>
            <span className="font-bold text-foreground">
              {isConsolidated ? "All Branches (Consolidated Rollup)" : selectedBranch?.name}
            </span>
            {!isConsolidated && selectedBranch?.code && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400 py-0 px-1.5 font-bold">
                {selectedBranch.code}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isConsolidated
              ? "Aggregating revenue, orders, and inventory across all operational store hubs."
              : `Filtered specifically to ${selectedBranch?.name} (${selectedBranch?.address || "Local Hub"}).`}
          </div>
        </div>

        {/* Quick Customer Storefront Tester Banner */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-sky-500/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Eye className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Customer Portal & Experience Tester</h3>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">1-Click Live Test</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit the complete customer journey — real-time catalog, cart stepper, UPI checkout, and live driver tracking.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              asChild
              size="sm"
              className="h-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              <Link to="/" target="_blank" rel="noopener noreferrer">
                <span>View Customer Storefront</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Operating Status HUD Banner */}
        {storeStatus && (
          <div 
            className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
              storeStatus.isOpen 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                : storeStatus.canAcceptOrder
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`size-8 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                storeStatus.isOpen ? "bg-emerald-600" : storeStatus.canAcceptOrder ? "bg-amber-600" : "bg-destructive"
              }`}>
                <Clock className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight flex items-center gap-2">
                  <span>{storeStatus.statusTitle}</span>
                  <span className="rounded-full bg-background/80 px-2 py-0.2 text-[10px] font-mono font-bold text-foreground border border-border/60">
                    {storeStatus.isOpen ? "Online & Walk-In Active" : storeStatus.canAcceptOrder ? "Pre-Orders Only" : "Orders Paused"}
                  </span>
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">{storeStatus.statusDescription}</p>
              </div>
            </div>
            <Link to="/admin/schedule">
              <Button size="sm" variant="outline" className="rounded-xl h-7.5 text-xs font-bold self-start sm:self-auto border-current">
                Manage Hours &amp; Lunch
              </Button>
            </Link>
          </div>
        )}

        {/* Top Operational KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="rounded-2xl border-border/80 shadow-2xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Gross Revenue</span>
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <IndianRupee className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{formatINR(grossRevenue)}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="text-emerald-600 font-semibold">POS: {formatINR(posRevenue)}</span>
                <span>•</span>
                <span className="text-sky-600 font-semibold">Web: {formatINR(onlineRevenue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-2xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Total Orders</span>
                <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <ReceiptText className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{orderCount}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Avg Order Value: <span className="font-bold text-foreground font-mono">{formatINR(aov)}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-2xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Dispatch &amp; Packing</span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Package className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{inPacking + outForDelivery}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {inPacking} in kitchen • {outForDelivery} on road
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-2xs bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Active Customers</span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Users className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{allCustomers.length}</p>
              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Omnichannel customer base
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live Order Fulfillment Pipeline Strip */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" /> Live Order Pipeline (Instant Action)
            </h2>
            <Link to="/admin/orders" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              <span>View All Orders</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Link 
              to="/admin/orders"
              className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Pending Review</span>
              <p className="text-xl font-black text-amber-900 dark:text-amber-200 mt-1">{pendingConfirmation}</p>
              <span className="text-[10px] text-muted-foreground">Awaiting store accept</span>
            </Link>

            <Link 
              to="/admin/orders"
              className="p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-xs font-semibold text-sky-800 dark:text-sky-300">In Packing / Cleaning</span>
              <p className="text-xl font-black text-sky-900 dark:text-sky-200 mt-1">{inPacking}</p>
              <span className="text-[10px] text-muted-foreground">Ice packing &amp; weighing</span>
            </Link>

            <Link 
              to="/admin/orders"
              className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Out for Delivery</span>
              <p className="text-xl font-black text-indigo-900 dark:text-indigo-200 mt-1">{outForDelivery}</p>
              <span className="text-[10px] text-muted-foreground">Drivers on route</span>
            </Link>

            <Link 
              to="/admin/orders"
              className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Delivered Today</span>
              <p className="text-xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{deliveredToday}</p>
              <span className="text-[10px] text-muted-foreground">Fulfilled successfully</span>
            </Link>
          </div>
        </div>

        {/* Quick Operations Launchpad */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Link
            to="/admin/pos"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Store className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">POS Billing</span>
            <span className="text-[10px] text-muted-foreground">Fast in-store checkout</span>
          </Link>

          <Link
            to="/admin/purchases"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">Inward Catch</span>
            <span className="text-[10px] text-muted-foreground">Supplier purchases &amp; lots</span>
          </Link>

          <Link
            to="/admin/broadcasts"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Anchor className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">Catch Alerts</span>
            <span className="text-[10px] text-muted-foreground">Morning boat landing</span>
          </Link>

          <Link
            to="/admin/driver"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Truck className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">Driver Fleet</span>
            <span className="text-[10px] text-muted-foreground">Live dispatch &amp; cash</span>
          </Link>

          <Link
            to="/admin/reports"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">Analytics</span>
            <span className="text-[10px] text-muted-foreground">Margins, sales &amp; repeats</span>
          </Link>

          <Link
            to="/admin/products"
            className="group flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/60 hover:shadow-xs transition-all"
          >
            <span className="size-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus className="size-5" />
            </span>
            <span className="text-xs font-bold mt-2 text-foreground">Add Product</span>
            <span className="text-[10px] text-muted-foreground">Catalog &amp; pricing</span>
          </Link>
        </div>

        {/* 2-Column Split: Top Selling SKUs & Low Stock Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Velocity SKUs */}
          <Card className="rounded-2xl border-border/80 shadow-2xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Flame className="size-4 text-orange-500" /> Top Selling Seafood SKUs ({timeframe === "today" ? "Today" : "All Time"})
                </CardTitle>
                <CardDescription className="text-[11px]">Ranked by revenue contribution</CardDescription>
              </div>
              <Link to="/admin/reports">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                  Full Report
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-5 rounded-md bg-orange-500/10 text-orange-600 font-mono font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Volume: {Math.round(p.count * 100) / 100} {p.unit}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-foreground shrink-0">{formatINR(p.revenue)}</span>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No sales recorded for this timeframe yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Depletion Warning */}
          <Card className="rounded-2xl border-border/80 shadow-2xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 text-amber-500" /> Inventory Depletion Radar ({lowStock.length})
                </CardTitle>
                <CardDescription className="text-[11px]">Products below threshold or sold out</CardDescription>
              </div>
              <Link to="/admin/purchases">
                <Button variant="outline" size="sm" className="h-7 text-xs font-bold border-amber-500/30 text-amber-700 dark:text-amber-300">
                  Inward Catch
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {lowStock.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Unit: {p.unit || "kg"} · Reorder point: {p.low_stock_threshold ?? 5}
                    </p>
                  </div>
                  <Badge variant={(p.stock ?? 0) <= 0 ? "destructive" : "secondary"} className="text-[10px] font-mono shrink-0">
                    {(p.stock ?? 0) <= 0 ? "Sold Out" : `${p.stock} left`}
                  </Badge>
                </div>
              ))}
              {lowStock.length === 0 && (
                <div className="py-6 text-center text-xs text-emerald-600 flex items-center justify-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" /> All dock inventory items well stocked!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Feed */}
        <Card className="rounded-2xl border-border/80 shadow-2xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Recent Customer &amp; Counter Orders</CardTitle>
              <CardDescription className="text-[11px]">Latest omnichannel transactions</CardDescription>
            </div>
            <Link to="/admin/orders">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary font-semibold">
                View All &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2">
            {allOrders.slice(0, 6).map((o) => {
              const isPos = (o as any).source === "pos" || (o.notes || "").toLowerCase().includes("pos");
              return (
                <Link
                  key={o.id}
                  to="/admin/orders"
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground truncate">{o.customer_name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {o.order_number ?? o.id.slice(0, 8)}
                      </Badge>
                      {isPos ? (
                        <span className="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.2">
                          POS Counter
                        </span>
                      ) : (
                        <span className="rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-1.5 py-0.2">
                          Online Web
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {o.payment_method.toUpperCase()} • {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-bold text-foreground">{formatINR(Number(o.total))}</p>
                    <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              );
            })}
            {allOrders.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">No orders recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
