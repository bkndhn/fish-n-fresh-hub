import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatIST } from "@/lib/format";
import {
  FileText,
  Calculator,
  UtensilsCrossed,
  Receipt,
  Download,
  Users,
  TrendingUp,
  Table,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import type { CartItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/gst-reports")({
  head: () => ({
    meta: [
      { title: "GST & Dine-In Sales Analytics | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Tax reports, GSTR-1, GSTR-3B summaries, and dine-in restaurant table sales analytics.",
      },
    ],
  }),
  component: GstReportsAdmin,
});

function GstReportsAdmin() {
  const [activeTab, setActiveTab] = useState<"gst" | "dine_in">("gst");
  const [range, setRange] = useState<"today" | "this_month" | "last_month" | "this_quarter">("this_month");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "gst_and_dine_in_reports", range],
    queryFn: async () => {
      let start = new Date();
      start.setHours(0, 0, 0, 0);
      let end = new Date();
      end.setHours(23, 59, 59, 999);

      if (range === "this_month") {
        start.setDate(1);
      } else if (range === "last_month") {
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        end.setDate(0);
      } else if (range === "this_quarter") {
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3);
        start.setDate(1);
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, items, status, customer_name, fulfillment_type, table_number, order_number, customer_address, notes")
        .neq("status", "cancelled")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate GST summaries
  const { gstSummary, hsnSummary, totalTaxCollected, totalTaxableValue } = useMemo(() => {
    const gstMap: Record<number, { taxable: number; taxAmount: number }> = {};
    const hsnMap: Record<string, { qty: number; taxable: number; taxAmount: number }> = {};
    let totalTaxCollected = 0;
    let totalTaxableValue = 0;

    orders.forEach((order) => {
      const items = (order.items as CartItem[]) || [];
      items.forEach((item) => {
        const g = item.gst_percentage || 0;
        const hsn = item.hsn_code || "UNKNOWN";
        const lineTotal = Number(item.price) * Number(item.qty);

        // Reverse inclusive tax calculation
        const taxable = lineTotal / (1 + g / 100);
        const taxAmount = lineTotal - taxable;

        totalTaxableValue += taxable;
        totalTaxCollected += taxAmount;

        // GST % Map
        if (!gstMap[g]) gstMap[g] = { taxable: 0, taxAmount: 0 };
        gstMap[g].taxable += taxable;
        gstMap[g].taxAmount += taxAmount;

        // HSN Map
        if (!hsnMap[hsn]) hsnMap[hsn] = { qty: 0, taxable: 0, taxAmount: 0 };
        hsnMap[hsn].qty += Number(item.qty);
        hsnMap[hsn].taxable += taxable;
        hsnMap[hsn].taxAmount += taxAmount;
      });
    });

    return {
      gstSummary: Object.entries(gstMap)
        .map(([rate, data]) => ({ rate: Number(rate), ...data }))
        .sort((a, b) => a.rate - b.rate),
      hsnSummary: Object.entries(hsnMap)
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.taxable - a.taxable),
      totalTaxCollected,
      totalTaxableValue,
    };
  }, [orders]);

  // Calculate Dine-In & Table Sales Analytics
  const {
    dineInOrders,
    totalDineInRevenue,
    dineInOrderCount,
    averageTableValue,
    topTables,
    topDishes,
  } = useMemo(() => {
    const extractTableLabel = (ord: any): string => {
      if (ord.table_number) {
        const t = String(ord.table_number).trim();
        return t.toLowerCase().startsWith("table") ? t : `Table ${t}`;
      }
      const textToSearch = `${ord.customer_address || ""} ${ord.notes || ""}`;
      const match = textToSearch.match(/Table\s*#?([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        return `Table ${match[1]}`;
      }
      return "Dine-In";
    };

    const isDineIn = (ord: any): boolean => {
      return (
        ord.fulfillment_type === "dine_in" ||
        ord.fulfillment_type === "table" ||
        Boolean(ord.table_number) ||
        String(ord.customer_address || "").includes("Table #") ||
        String(ord.notes || "").includes("Table #") ||
        String(ord.order_number || "").startsWith("DINE-")
      );
    };

    const filtered = orders.filter(isDineIn);
    const totalDineInRevenue = filtered.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const dineInOrderCount = filtered.length;
    const averageTableValue = dineInOrderCount > 0 ? totalDineInRevenue / dineInOrderCount : 0;

    // Aggregate by Table
    const tableMap = new Map<string, { label: string; revenue: number; orderCount: number }>();
    filtered.forEach((o) => {
      const label = extractTableLabel(o);
      const existing = tableMap.get(label) || { label, revenue: 0, orderCount: 0 };
      existing.revenue += Number(o.total || 0);
      existing.orderCount += 1;
      tableMap.set(label, existing);
    });

    const topTables = Array.from(tableMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Aggregate by Dish
    const dishMap = new Map<string, { name: string; portions: number; revenue: number }>();
    filtered.forEach((o) => {
      const items = (o.items as any[]) || [];
      items.forEach((item) => {
        const cleanName = String(item.name || "Dish").replace(/\[(MILD|MEDIUM|SPICY|EXTRA_HOT)\]/gi, "").trim();
        const existing = dishMap.get(cleanName) || { name: cleanName, portions: 0, revenue: 0 };
        const qty = Number(item.qty || 1);
        const price = Number(item.price || 0);
        existing.portions += qty;
        existing.revenue += qty * price;
        dishMap.set(cleanName, existing);
      });
    });

    const topDishes = Array.from(dishMap.values()).sort((a, b) => b.portions - a.portions);

    return {
      dineInOrders: filtered,
      totalDineInRevenue,
      dineInOrderCount,
      averageTableValue,
      topTables,
      topDishes,
    };
  }, [orders]);

  // Export Dine-In Orders CSV
  const handleExportDineInCsv = () => {
    if (dineInOrders.length === 0) {
      toast.error("No dine-in orders to export for this period");
      return;
    }

    const headers = ["Order Number", "Table", "Customer Name", "Items Count", "Total (INR)", "Status", "Date IST"];
    const rows = dineInOrders.map((o) => {
      const items = (o.items as any[]) || [];
      const table = o.table_number || "Dine-In";
      return [
        `"${o.order_number || o.id}"`,
        `"${table}"`,
        `"${o.customer_name || "Guest"}"`,
        items.length,
        Number(o.total || 0).toFixed(2),
        `"${o.status}"`,
        `"${formatIST(o.created_at)}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dine-in-sales-report-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported Dine-In CSV successfully!");
  };

  // Export GST CSV
  const handleExportGstCsv = () => {
    if (gstSummary.length === 0) {
      toast.error("No GST data to export for this period");
      return;
    }

    const headers = ["GST Rate %", "Taxable Value (INR)", "Total Tax (INR)", "CGST (INR)", "SGST (INR)"];
    const rows = gstSummary.map((r) => [
      `${r.rate}%`,
      r.taxable.toFixed(2),
      r.taxAmount.toFixed(2),
      (r.taxAmount / 2).toFixed(2),
      (r.taxAmount / 2).toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gst-gstr3b-report-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported GSTR-3B CSV successfully!");
  };

  return (
    <AdminShell title="Sales & Tax Analytics">
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTab === "gst" ? "GST & Tax Reports" : "Dine-In & Table Sales Analytics"}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {activeTab === "gst"
                ? "GSTR-1, GSTR-3B, and HSN-wise summaries for tax filing (inclusive of GST)."
                : "Real-time revenue, order counts, Average Table Value (ATV), and table breakdown."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-44 rounded-xl bg-card text-xs h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-2xl w-fit text-xs font-bold">
          <button
            onClick={() => setActiveTab("gst")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "gst"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="size-3.5 text-indigo-500" />
            <span>📊 GST &amp; Tax Summary</span>
          </button>

          <button
            onClick={() => setActiveTab("dine_in")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "dine_in"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UtensilsCrossed className="size-3.5 text-emerald-500" />
            <span>🍽️ Dine-In &amp; Table Sales ({dineInOrderCount})</span>
          </button>
        </div>

        {/* ─── TAB 1: GST & TAX SUMMARY ─── */}
        {activeTab === "gst" && (
          <div className="space-y-6">
            {/* Top level KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="shadow-xs border-indigo-100 dark:border-indigo-900/30 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Total Taxable Value</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{formatINR(totalTaxableValue)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Total GST Collected</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{formatINR(totalTaxCollected)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-sky-100 dark:border-sky-900/30 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Receipt className="h-4 w-4 text-sky-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Orders Count</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{orders.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GST Rate Wise Summary (GSTR-3B) */}
            <Card className="shadow-xs border-border/70 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
                <CardTitle className="text-base font-bold">Rate Wise Summary (GSTR-3B)</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportGstCsv}
                  className="rounded-xl h-8 text-xs font-semibold gap-1.5"
                >
                  <Download className="size-3.5" />
                  <span>Export CSV</span>
                </Button>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {isLoading ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
                ) : gstSummary.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 overflow-hidden mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">GST Rate</th>
                          <th className="px-4 py-3 text-right font-semibold">Taxable Value</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Tax Amount</th>
                          <th className="px-4 py-3 text-right font-semibold text-emerald-600">CGST (50%)</th>
                          <th className="px-4 py-3 text-right font-semibold text-sky-600">SGST (50%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {gstSummary.map((row) => (
                          <tr key={row.rate} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-semibold text-foreground">{row.rate}%</td>
                            <td className="px-4 py-3 text-right font-mono">{formatINR(row.taxable)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(row.taxAmount)}</td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatINR(row.taxAmount / 2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-sky-600">{formatINR(row.taxAmount / 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No tax data available for the selected period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* HSN Code Wise Summary (GSTR-1) */}
            <Card className="shadow-xs border-border/70 rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
                <CardTitle className="text-base font-bold">HSN Summary (GSTR-1)</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {isLoading ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
                ) : hsnSummary.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 overflow-hidden mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">HSN Code</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Quantity</th>
                          <th className="px-4 py-3 text-right font-semibold">Taxable Value</th>
                          <th className="px-4 py-3 text-right font-semibold">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {hsnSummary.map((row) => (
                          <tr key={row.code} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-semibold text-foreground">{row.code || "N/A"}</td>
                            <td className="px-4 py-3 text-right font-mono">{row.qty.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatINR(row.taxable)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(row.taxAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No HSN data available for the selected period.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── TAB 2: DINE-IN & TABLE SALES ANALYTICS ─── */}
        {activeTab === "dine_in" && (
          <div className="space-y-6">
            {/* Dine-In Top KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-xs border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Total Dine-In Revenue</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{formatINR(totalDineInRevenue)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">From all dine-in table tickets</p>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-primary/20 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Dine-In Orders</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{dineInOrderCount}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Total dining tickets processed</p>
                </CardContent>
              </Card>

              <Card className="shadow-xs border-amber-100 dark:border-amber-900/30 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Average Table Value (ATV)</h3>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-extrabold text-foreground">{formatINR(averageTableValue)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Average spend per table order</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Tables by Revenue & Top Dishes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tables Breakdown */}
              <Card className="shadow-xs border-border/70 rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Table className="size-4 text-primary" />
                    <span>Top Tables by Revenue</span>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportDineInCsv}
                    className="rounded-xl h-8 text-xs font-semibold gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Export CSV</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  {topTables.length > 0 ? (
                    <div className="rounded-2xl border border-border/50 overflow-hidden mt-2">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Table</th>
                            <th className="px-4 py-3 text-center font-semibold">Orders</th>
                            <th className="px-4 py-3 text-right font-semibold">Avg / Order</th>
                            <th className="px-4 py-3 text-right font-semibold">Total Sales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {topTables.map((t, idx) => (
                            <tr key={t.label} className="hover:bg-muted/20">
                              <td className="px-4 py-3 font-bold text-foreground flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
                                <span>{t.label}</span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono">{t.orderCount}</td>
                              <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                {formatINR(t.orderCount > 0 ? t.revenue / t.orderCount : 0)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                                {formatINR(t.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No dine-in orders recorded in this period.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Dine-In Dishes */}
              <Card className="shadow-xs border-border/70 rounded-3xl overflow-hidden">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ChefHat className="size-4 text-primary" />
                    <span>Top Dine-In Dishes Sold</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  {topDishes.length > 0 ? (
                    <div className="rounded-2xl border border-border/50 overflow-hidden mt-2">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Dish</th>
                            <th className="px-4 py-3 text-center font-semibold">Portions Sold</th>
                            <th className="px-4 py-3 text-right font-semibold">Total Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {topDishes.slice(0, 10).map((d, idx) => (
                            <tr key={d.name} className="hover:bg-muted/20">
                              <td className="px-4 py-3 font-semibold text-foreground truncate max-w-[180px]">
                                <span className="text-[10px] text-muted-foreground font-mono mr-1.5">#{idx + 1}</span>
                                {d.name}
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">
                                {d.portions}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                                {formatINR(d.revenue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No dish order data available in this period.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
