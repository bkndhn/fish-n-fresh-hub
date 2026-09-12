import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Building,
  Store,
  Layers,
  Sparkles,
  Edit2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  PieChart,
  Percent,
  RefreshCw,
} from "lucide-react";
import { useAdminBranch } from "@/lib/branchContext";
import { adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  calculatePnlStatement,
  calculateProductPnl,
  exportProductPnlToCsv,
  EXPENSE_CATEGORIES,
  getExpenseCategoryMeta,
} from "@/lib/pnl";
import type { Product, Expense, ProductPnlItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
] as const;

type DatePresetKey = (typeof DATE_PRESETS)[number]["key"];

export function AdminPnlReport() {
  const qc = useQueryClient();
  const { selectedBranchId, selectedBranch, isConsolidated, branches } = useAdminBranch();

  // Date filters
  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [datePreset, setDatePreset] = useState<DatePresetKey>("30d");
  const [customStart, setCustomStart] = useState(thirtyDaysAgoIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  // Product table filters
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState<"all" | "high_profit" | "healthy" | "slim" | "loss_making">("all");

  // Quick Buying Cost Edit Modal state
  const [editingCostProduct, setEditingCostProduct] = useState<Product | null>(null);
  const [newCostPrice, setNewCostPrice] = useState("");

  // Determine actual start/end date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (datePreset === "today") {
      return { startDate: today, endDate: today };
    }
    if (datePreset === "yesterday") {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      return { startDate: y, endDate: y };
    }
    if (datePreset === "7d") {
      const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return { startDate: start, endDate: today };
    }
    if (datePreset === "30d") {
      const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      return { startDate: start, endDate: today };
    }
    if (datePreset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { startDate: start, endDate: today };
    }
    if (datePreset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { startDate: start, endDate: end };
    }
    if (datePreset === "custom") {
      return { startDate: customStart, endDate: customEnd };
    }
    // all
    return { startDate: "2020-01-01", endDate: today };
  }, [datePreset, customStart, customEnd, todayIso]);

  // 1. Orders Query
  const ordersQuery = useQuery(adminOrdersQuery(selectedBranchId));
  const allOrders = ordersQuery.data ?? [];

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      if (o.status === "cancelled") return false;
      const orderDate = (o.created_at || "").slice(0, 10);
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });
  }, [allOrders, startDate, endDate]);

  // 2. Products Query
  const productsQuery = useQuery(adminProductsQuery(selectedBranchId));
  const products = productsQuery.data ?? [];

  // 3. Expenses Query
  const expensesQuery = useQuery({
    queryKey: ["admin", "pnl-expenses", selectedBranchId, startDate, endDate],
    queryFn: async (): Promise<Expense[]> => {
      let q = supabase
        .from("expenses" as any)
        .select("*, branches(name)")
        .order("expense_date", { ascending: false });

      if (selectedBranchId !== "all") {
        q = q.eq("branch_id", selectedBranchId);
      }
      if (startDate) {
        q = q.gte("expense_date", startDate);
      }
      if (endDate) {
        q = q.lte("expense_date", endDate);
      }

      const { data, error } = await q;
      if (error) {
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        branch_id: row.branch_id,
        branch_name: row.branches?.name || "Branch",
        category: row.category,
        title: row.title,
        amount: Number(row.amount || 0),
        expense_date: row.expense_date,
        payment_method: row.payment_method || "cash",
        vendor_name: row.vendor_name,
        notes: row.notes,
        created_at: row.created_at,
      }));
    },
  });
  const expenses = expensesQuery.data ?? [];

  // 4. Waste entries Query
  const wasteQuery = useQuery({
    queryKey: ["admin", "pnl-waste", selectedBranchId, startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("waste_entries" as any)
        .select("*");

      if (selectedBranchId !== "all") {
        q = q.eq("branch_id", selectedBranchId);
      }
      if (startDate) {
        q = q.gte("date", startDate);
      }
      if (endDate) {
        q = q.lte("date", endDate);
      }

      const { data, error } = await q;
      if (error) return [];
      return data || [];
    },
  });
  const wasteEntries = wasteQuery.data ?? [];

  // Calculate Overall P&L Statement
  const pnlSummary = useMemo(() => {
    return calculatePnlStatement(filteredOrders, products, expenses, wasteEntries);
  }, [filteredOrders, products, expenses, wasteEntries]);

  // Calculate Product-by-Product Economics
  const productPnlItems = useMemo(() => {
    return calculateProductPnl(filteredOrders, products, wasteEntries);
  }, [filteredOrders, products, wasteEntries]);

  // Filtered product items for table
  const filteredProductItems = useMemo(() => {
    return productPnlItems.filter((it) => {
      if (tierFilter !== "all" && it.tier !== tierFilter) return false;
      if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const matchName = it.name.toLowerCase().includes(q);
        const matchCat = it.category.toLowerCase().includes(q);
        const matchBrand = (it.brand || "").toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchBrand) return false;
      }
      return true;
    });
  }, [productPnlItems, tierFilter, categoryFilter, productSearch]);

  // Unique categories in catalog
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set);
  }, [products]);

  // Multi-Branch Comparative matrix (Consolidated View only)
  const branchBreakdown = useMemo(() => {
    if (!isConsolidated || branches.length <= 1) return [];

    return branches.map((branch) => {
      const branchOrders = filteredOrders.filter((o: any) => o.branch_id === branch.id);
      const branchExpenses = expenses.filter((e) => e.branch_id === branch.id);
      const branchWaste = wasteEntries.filter((w: any) => w.branch_id === branch.id);

      const branchPnl = calculatePnlStatement(branchOrders, products, branchExpenses, branchWaste);

      return {
        branch,
        summary: branchPnl,
      };
    });
  }, [isConsolidated, branches, filteredOrders, expenses, wasteEntries, products]);

  // Mutation to update cost_price quickly
  const updateCostMutation = useMutation({
    mutationFn: async () => {
      if (!editingCostProduct) return;
      const val = parseFloat(newCostPrice);
      if (isNaN(val) || val < 0) throw new Error("Please enter a valid cost price");

      const { error } = await supabase
        .from("products")
        .update({ cost_price: val } as any)
        .eq("id", editingCostProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Buying cost updated for "${editingCostProduct?.name}"`);
      setEditingCostProduct(null);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update buying cost");
    },
  });

  const handleExportProductPnl = () => {
    const branchName = selectedBranch ? selectedBranch.name : "All Branches (Consolidated)";
    const csv = exportProductPnlToCsv(filteredProductItems, branchName);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `product_pnl_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Product P&L exported to CSV");
  };

  return (
    <div className="space-y-4">
      {/* Scope Banner: Client & Branch Isolation */}
      <div className="rounded-2xl bg-card border border-border/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Building className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-foreground">
                {isConsolidated ? "Consolidated Store P&L (All Branches)" : (selectedBranch?.name ?? "Branch P&L")}
              </h2>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1">
                <ShieldCheck className="size-3" /> Branch-Isolated Zero Leakage
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isConsolidated
                ? "Full tenant-wide profit & loss aggregation across all retail branch counters and delivery zones."
                : `Filtered exclusively for branch "${selectedBranch?.name || 'Local'}". Cross-branch transactions strictly segregated.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/expenses">
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs font-bold gap-1.5">
              <ExternalLink className="size-3.5" /> Manage Expenses
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleExportProductPnl}
            disabled={filteredProductItems.length === 0}
            className="rounded-xl h-8 text-xs font-bold gap-1.5"
          >
            <Download className="size-3.5" /> Export Product P&L
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={datePreset === p.key ? "default" : "outline"}
              onClick={() => setDatePreset(p.key)}
              className="rounded-xl h-7.5 px-2.5 text-xs font-semibold"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {datePreset === "custom" && (
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border border-border/60">
            <Calendar className="size-3.5 text-muted-foreground ml-1" />
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-7 text-xs w-32 rounded-lg bg-background"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-7 text-xs w-32 rounded-lg bg-background"
            />
          </div>
        )}
      </div>

      {/* Executive Financial Statement (P&L Card) */}
      <Card className="rounded-3xl border-border/90 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="size-5 text-primary" />
              <CardTitle className="text-base font-extrabold">
                Executive Income Statement (P&L)
              </CardTitle>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              Period: {startDate} to {endDate}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Top 3 Big KPI Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/80">
              <span className="text-xs font-bold text-muted-foreground">Net Sales Revenue</span>
              <div className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                {formatINR(pnlSummary.netSales)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                From {pnlSummary.orderCount} completed customer & POS orders
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Gross Profit (GP)</span>
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                  {pnlSummary.grossMarginPct}% Margin
                </Badge>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {formatINR(pnlSummary.grossProfit)}
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                After direct purchase COGS & trimming waste loss
              </p>
            </div>

            <div className={`p-4 rounded-2xl border ${
              pnlSummary.netProfit >= 0
                ? "bg-primary/10 border-primary/20"
                : "bg-rose-500/10 border-rose-500/20"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Net Operating Profit (EBITDA)</span>
                <Badge variant={pnlSummary.netProfit >= 0 ? "default" : "destructive"} className="text-[10px] font-bold">
                  {pnlSummary.netMarginPct}% Net
                </Badge>
              </div>
              <div className={`text-2xl sm:text-3xl font-black mt-1 ${
                pnlSummary.netProfit >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400"
              }`}>
                {formatINR(pnlSummary.netProfit)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Bottom-line profit after all branch operating expenses
              </p>
            </div>
          </div>

          {/* Detailed Financial Waterfall Table */}
          <div className="rounded-2xl border border-border/80 overflow-hidden divide-y divide-border/60 text-xs sm:text-sm">
            {/* Revenue Row */}
            <div className="p-3 bg-muted/20 flex items-center justify-between font-bold text-foreground">
              <span>(+) Gross Sales Revenue</span>
              <span>{formatINR(pnlSummary.grossSales)}</span>
            </div>

            {pnlSummary.discounts > 0 && (
              <div className="p-3 pl-6 flex items-center justify-between text-muted-foreground">
                <span>(-) Customer Discounts &amp; Vouchers</span>
                <span className="text-rose-600 dark:text-rose-400">-{formatINR(pnlSummary.discounts)}</span>
              </div>
            )}

            <div className="p-3 bg-muted/40 flex items-center justify-between font-extrabold text-foreground border-y border-border/80">
              <span>(=) Net Sales Revenue</span>
              <span className="text-base">{formatINR(pnlSummary.netSales)}</span>
            </div>

            {/* Production Costs */}
            <div className="p-3 pl-6 flex items-center justify-between text-muted-foreground">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">(-) Cost of Goods Sold (Buying / Purchase Cost)</p>
                <p className="text-[10px] text-muted-foreground">Direct supplier purchase cost of sold items</p>
              </div>
              <span className="font-bold text-rose-600 dark:text-rose-400">-{formatINR(pnlSummary.totalCogs)}</span>
            </div>

            {pnlSummary.totalWasteCost > 0 && (
              <div className="p-3 pl-6 flex items-center justify-between text-muted-foreground">
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">(-) Spoilage, Damage &amp; Trimming Loss</p>
                  <p className="text-[10px] text-muted-foreground">Recorded inventory write-offs absorbed as cost</p>
                </div>
                <span className="font-bold text-rose-600 dark:text-rose-400">-{formatINR(pnlSummary.totalWasteCost)}</span>
              </div>
            )}

            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 flex items-center justify-between font-black text-emerald-800 dark:text-emerald-300 border-y border-emerald-500/30">
              <div>
                <span>(=) Gross Profit (GP)</span>
                <span className="text-xs font-normal text-muted-foreground ml-2">({pnlSummary.grossMarginPct}% Gross Margin)</span>
              </div>
              <span className="text-base sm:text-lg">{formatINR(pnlSummary.grossProfit)}</span>
            </div>

            {/* Operating Expenses */}
            <div className="p-3 pl-6 flex items-center justify-between text-muted-foreground">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">(-) Operating Expenses (Store Overheads &amp; OPEX)</p>
                <p className="text-[10px] text-muted-foreground">Rent, wages, electricity, packaging, logistics, ice</p>
              </div>
              <span className="font-bold text-rose-600 dark:text-rose-400">-{formatINR(pnlSummary.totalExpenses)}</span>
            </div>

            {/* Bottom Line */}
            <div className={`p-4 flex items-center justify-between font-black text-base sm:text-lg border-t-2 ${
              pnlSummary.netProfit >= 0
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400"
            }`}>
              <div className="space-y-0.5">
                <div>(=) Net Operating Profit (EBITDA)</div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Net Margin: {pnlSummary.netMarginPct}% of Net Sales
                </div>
              </div>
              <span>{formatINR(pnlSummary.netProfit)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Expenses Category Distribution */}
      <Card className="rounded-2xl border-border/80 shadow-2xs">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Layers className="size-4 text-primary" /> Operating Expense Breakdown by Category
            </CardTitle>
            <Link to="/admin/expenses">
              <span className="text-xs text-primary hover:underline font-bold flex items-center gap-1">
                View Ledger <ArrowUpRight className="size-3" />
              </span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {EXPENSE_CATEGORIES.map((cat) => {
              const amount = pnlSummary.expensesByCategory[cat.id] || 0;
              const share = pnlSummary.totalExpenses > 0 ? Math.round((amount / pnlSummary.totalExpenses) * 100) : 0;
              return (
                <div key={cat.id} className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{cat.emoji}</span>
                    <span className="font-bold text-muted-foreground text-[11px]">{share}%</span>
                  </div>
                  <div className="text-xs font-bold text-foreground truncate" title={cat.label}>
                    {cat.label}
                  </div>
                  <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                    {formatINR(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Multi-Branch Performance Matrix */}
      {isConsolidated && branchBreakdown.length > 1 && (
        <Card className="rounded-2xl border-border/80 shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-extrabold flex items-center gap-2">
              <Store className="size-4 text-primary" /> Multi-Branch Comparative Profitability
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-3 font-bold">Branch Name</th>
                  <th className="py-2 px-3 font-bold text-right">Net Sales</th>
                  <th className="py-2 px-3 font-bold text-right">COGS</th>
                  <th className="py-2 px-3 font-bold text-right">Waste Loss</th>
                  <th className="py-2 px-3 font-bold text-right">Gross Profit</th>
                  <th className="py-2 px-3 font-bold text-right">Expenses</th>
                  <th className="py-2 px-3 font-bold text-right">Net Profit</th>
                  <th className="py-2 px-3 font-bold text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {branchBreakdown.map(({ branch, summary }) => (
                  <tr key={branch.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-bold text-foreground">
                      {branch.name}
                      <span className="block text-[10px] text-muted-foreground font-normal">{branch.address}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatINR(summary.netSales)}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatINR(summary.totalCogs)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">{formatINR(summary.totalWasteCost)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(summary.grossProfit)}
                      <span className="block text-[10px] font-normal">({summary.grossMarginPct}%)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{formatINR(summary.totalExpenses)}</td>
                    <td className={`py-2.5 px-3 text-right font-extrabold ${
                      summary.netProfit >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {formatINR(summary.netProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <Badge variant={summary.netProfit >= 0 ? "outline" : "destructive"} className="text-[10px]">
                        {summary.netMarginPct}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Product-Level P&L Breakdown Table */}
      <Card className="rounded-2xl border-border/80 shadow-2xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Percent className="size-4 text-primary" /> Product-by-Product Profitability &amp; Margins
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buying cost, sales revenue, direct COGS, spoilage loss absorption, and profit share by SKU.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportProductPnl}
                className="rounded-xl h-8 text-xs font-bold gap-1.5"
              >
                <Download className="size-3.5" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Search, Category & Tier Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search SKU name, category, brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs rounded-xl"
                />
              </div>

              <select
                className="h-8.5 rounded-xl border border-input bg-background px-3 text-xs"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Profitability Tier Buttons */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                size="sm"
                variant={tierFilter === "all" ? "default" : "outline"}
                onClick={() => setTierFilter("all")}
                className="rounded-xl h-7 px-2.5 text-[11px] font-semibold"
              >
                All SKUs ({productPnlItems.length})
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "high_profit" ? "default" : "outline"}
                onClick={() => setTierFilter("high_profit")}
                className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
              >
                🔥 High Margin (&gt;40%)
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "healthy" ? "default" : "outline"}
                onClick={() => setTierFilter("healthy")}
                className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
              >
                ⚖️ Healthy (20-40%)
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "slim" ? "default" : "outline"}
                onClick={() => setTierFilter("slim")}
                className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
              >
                ⚠️ Slim (0-20%)
              </Button>
              <Button
                size="sm"
                variant={tierFilter === "loss_making" ? "default" : "outline"}
                onClick={() => setTierFilter("loss_making")}
                className="rounded-xl h-7 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
              >
                ❄️ Loss Making
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                <th className="py-2.5 px-3">Product SKU</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Buying Cost</th>
                <th className="py-2.5 px-3 text-right">Selling Price</th>
                <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                <th className="py-2.5 px-3 text-right">COGS</th>
                <th className="py-2.5 px-3 text-right">Gross Profit</th>
                <th className="py-2.5 px-3 text-right">Margin %</th>
                <th className="py-2.5 px-3 text-right">Profit Share</th>
                <th className="py-2.5 px-3 text-center">Tier</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProductItems.map((it) => (
                <tr key={it.id} className="hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-extrabold text-foreground">
                    <div className="truncate max-w-[180px]" title={it.name}>
                      {it.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                      <span>{it.category}</span>
                      {it.brand && <span>• {it.brand}</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    {it.unitsSold} <span className="text-[10px] text-muted-foreground font-normal">{it.unit}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                    {formatINR(it.costPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-foreground font-medium">
                    {formatINR(it.sellingPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground">
                    {formatINR(it.revenue)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {formatINR(it.cogs)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-black ${
                    it.grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {formatINR(it.grossProfit)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    <span className={`px-1.5 py-0.5 rounded ${
                      it.marginPct >= 40
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : it.marginPct >= 20
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : it.marginPct >= 0
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}>
                      {it.marginPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground font-semibold">
                    {it.profitSharePct}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold capitalize ${
                        it.tier === "high_profit"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : it.tier === "healthy"
                          ? "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                          : it.tier === "slim"
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                      }`}
                    >
                      {it.tier.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 rounded-lg hover:bg-muted"
                      title="Quick edit buying cost price"
                      onClick={() => {
                        const original = products.find((p) => p.id === it.id);
                        if (original) {
                          setEditingCostProduct(original);
                          setNewCostPrice(String(original.cost_price ?? it.costPrice));
                        }
                      }}
                    >
                      <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}

              {filteredProductItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground">
                    No products matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Quick Buying Cost Edit Dialog */}
      <Dialog open={Boolean(editingCostProduct)} onOpenChange={(open) => !open && setEditingCostProduct(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              Update Buying Cost Price
            </DialogTitle>
          </DialogHeader>

          {editingCostProduct && (
            <div className="space-y-3.5 pt-2">
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="font-extrabold text-sm text-foreground">{editingCostProduct.name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Current Selling Rate: <strong>{formatINR(Number(editingCostProduct.price))}</strong></span>
                  <span>Unit: <strong>{editingCostProduct.unit}</strong></span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quick-cost-input" className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  New Purchase / Buying Cost (₹) *
                </Label>
                <Input
                  id="quick-cost-input"
                  type="number"
                  placeholder="e.g. 320"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                  className="h-9 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400"
                />
              </div>

              {Number(newCostPrice) > 0 && Number(editingCostProduct.price) > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>
                    New Gross Margin: <strong>{Math.round(((Number(editingCostProduct.price) - Number(newCostPrice)) / Number(editingCostProduct.price)) * 100)}%</strong>
                  </span>
                  <span>
                    Unit Profit: <strong>{formatINR(Number(editingCostProduct.price) - Number(newCostPrice))}</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCostProduct(null)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateCostMutation.mutate()}
                  disabled={updateCostMutation.isPending || !newCostPrice}
                  className="rounded-xl text-xs font-bold"
                >
                  {updateCostMutation.isPending ? "Saving..." : "Save Cost Price"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
