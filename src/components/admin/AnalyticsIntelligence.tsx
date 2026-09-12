import React, { useState, useMemo } from "react";
import {
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Fish,
  ShoppingBag,
  Flame,
  Layers,
  ArrowRight,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatINR, formatIST, formatStockDisplay } from "@/lib/format";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import type { OrderRow } from "@/lib/admin";
import type { Product } from "@/lib/types";

interface AnalyticsIntelligenceProps {
  allOrders: OrderRow[];
  currentOrders: OrderRow[];
  products: Product[];
  range: string;
  startDate: string;
  endDate: string;
}

function getHourIST(isoString: string): number {
  try {
    const d = new Date(isoString);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + istOffset);
    return istDate.getUTCHours();
  } catch {
    return 10;
  }
}

function formatHourLabel(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}${period}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AnalyticsIntelligence({
  allOrders,
  currentOrders,
  products,
  range,
  startDate,
  endDate,
}: AnalyticsIntelligenceProps) {
  // Peak Chart Metric: Sales Revenue vs Order Count
  const [hourlyMetric, setHourlyMetric] = useState<"revenue" | "orders">("revenue");

  // Comparison Tab Range State
  const [compareMode, setCompareMode] = useState<"auto" | "custom">("auto");
  const [customCompareStart, setCustomCompareStart] = useState<string>(() => {
    return new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  });
  const [customCompareEnd, setCustomCompareEnd] = useState<string>(() => {
    return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  });

  // Current paid orders
  const currentPaid = useMemo(
    () => currentOrders.filter((o) => o.status !== "cancelled"),
    [currentOrders]
  );
  const currentRevenue = useMemo(
    () => currentPaid.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [currentPaid]
  );
  const currentAov = currentPaid.length > 0 ? Math.round(currentRevenue / currentPaid.length) : 0;

  // 1. Hourly Sales Revenue & Volume Breakdown
  const hourlyStats = useMemo(() => {
    const stats: Record<number, { hour: number; label: string; count: number; revenue: number }> = {};
    for (let h = 6; h <= 22; h++) {
      stats[h] = { hour: h, label: formatHourLabel(h), count: 0, revenue: 0 };
    }

    for (const o of currentPaid) {
      const h = getHourIST(o.created_at);
      if (h >= 6 && h <= 22) {
        const slot = stats[h];
        if (slot) {
          slot.count += 1;
          slot.revenue += Number(o.total || 0);
        }
      }
    }

    const list = Object.values(stats);
    const maxOrders = Math.max(1, ...list.map((l) => l.count));
    const maxRevenue = Math.max(1, ...list.map((l) => l.revenue));
    const peakOrderSlot = [...list].sort((a, b) => b.count - a.count)[0];
    const peakRevenueSlot = [...list].sort((a, b) => b.revenue - a.revenue)[0];

    return { list, maxOrders, maxRevenue, peakOrderSlot, peakRevenueSlot };
  }, [currentPaid]);

  // 2. Day-of-Week Sales Volume & Revenue
  const dayOfWeekStats = useMemo(() => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((dayIdx) => ({
      dayIdx,
      name: DAY_NAMES[dayIdx],
      short: DAY_SHORT[dayIdx],
      count: 0,
      revenue: 0,
    }));

    for (const o of currentPaid) {
      try {
        const d = new Date(o.created_at);
        const dayIdx = d.getDay();
        const dSlot = days[dayIdx];
        if (dSlot) {
          dSlot.count += 1;
          dSlot.revenue += Number(o.total || 0);
        }
      } catch {}
    }

    const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenue));
    const peakDay = [...days].sort((a, b) => b.revenue - a.revenue)[0];

    return { days, maxDayRevenue, peakDay };
  }, [currentPaid]);

  // 3. Automated Previous Period Determination
  const previousOrders = useMemo(() => {
    if (compareMode === "custom") {
      return allOrders.filter((o) => {
        const d = o.created_at.slice(0, 10);
        return d >= customCompareStart && d <= customCompareEnd;
      });
    }

    // Auto previous period based on current range
    const now = Date.now();
    const dayMs = 86400000;

    if (range === "today") {
      const yesterdayIso = new Date(now - 1 * dayMs).toISOString().slice(0, 10);
      return allOrders.filter((o) => o.created_at.slice(0, 10) === yesterdayIso);
    }

    if (range === "7") {
      const startCutoff = now - 14 * dayMs;
      const endCutoff = now - 7 * dayMs;
      return allOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= startCutoff && t < endCutoff;
      });
    }

    if (range === "30") {
      const startCutoff = now - 60 * dayMs;
      const endCutoff = now - 30 * dayMs;
      return allOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= startCutoff && t < endCutoff;
      });
    }

    if (range === "90") {
      const startCutoff = now - 180 * dayMs;
      const endCutoff = now - 90 * dayMs;
      return allOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= startCutoff && t < endCutoff;
      });
    }

    if (range === "custom" && startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      const diff = Math.max(dayMs, e - s);
      const priorEnd = s - 1000;
      const priorStart = priorEnd - diff;
      return allOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= priorStart && t <= priorEnd;
      });
    }

    // Fallback: previous half of all orders
    const half = Math.floor(allOrders.length / 2);
    return allOrders.slice(half);
  }, [allOrders, compareMode, customCompareStart, customCompareEnd, range, startDate, endDate]);

  const previousPaid = useMemo(
    () => previousOrders.filter((o) => o.status !== "cancelled"),
    [previousOrders]
  );
  const previousRevenue = useMemo(
    () => previousPaid.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [previousPaid]
  );
  const previousAov = previousPaid.length > 0 ? Math.round(previousRevenue / previousPaid.length) : 0;

  // Metric Growth Deltas
  const revenueGrowthPct = previousRevenue > 0
    ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10
    : currentRevenue > 0
    ? 100
    : 0;

  const ordersGrowthPct = previousPaid.length > 0
    ? Math.round(((currentPaid.length - previousPaid.length) / previousPaid.length) * 1000) / 10
    : currentPaid.length > 0
    ? 100
    : 0;

  const aovGrowthPct = previousAov > 0
    ? Math.round(((currentAov - previousAov) / previousAov) * 1000) / 10
    : currentAov > 0
    ? 100
    : 0;

  // Top Selling Items Comparison
  const itemComparison = useMemo(() => {
    const currentMap = new Map<string, { name: string; qty: number; value: number }>();
    const prevMap = new Map<string, { name: string; qty: number; value: number }>();

    for (const o of currentPaid) {
      for (const it of o.items ?? []) {
        const key = it.name.toLowerCase().trim();
        const cur = currentMap.get(key) ?? { name: it.name, qty: 0, value: 0 };
        currentMap.set(key, {
          name: it.name,
          qty: cur.qty + Number(it.qty || 0),
          value: cur.value + Number(it.qty || 0) * Number(it.price || 0),
        });
      }
    }

    for (const o of previousPaid) {
      for (const it of o.items ?? []) {
        const key = it.name.toLowerCase().trim();
        const cur = prevMap.get(key) ?? { name: it.name, qty: 0, value: 0 };
        prevMap.set(key, {
          name: it.name,
          qty: cur.qty + Number(it.qty || 0),
          value: cur.value + Number(it.qty || 0) * Number(it.price || 0),
        });
      }
    }

    const merged = Array.from(currentMap.entries()).map(([key, curr]) => {
      const prev = prevMap.get(key);
      const prevQty = prev?.qty ?? 0;
      const prevVal = prev?.value ?? 0;

      let growthPct = 0;
      let status: "new" | "up" | "down" | "flat" = "flat";

      if (prevQty === 0) {
        status = "new";
        growthPct = 100;
      } else {
        growthPct = Math.round(((curr.qty - prevQty) / prevQty) * 100);
        if (growthPct > 0) status = "up";
        else if (growthPct < 0) status = "down";
        else status = "flat";
      }

      return {
        name: curr.name,
        currentQty: curr.qty,
        currentRevenue: curr.value,
        prevQty,
        prevRevenue: prevVal,
        growthPct,
        status,
      };
    });

    return merged.sort((a, b) => b.currentRevenue - a.currentRevenue).slice(0, 10);
  }, [currentPaid, previousPaid]);

  // 4. Smart Harbour Purchasing Recommendations
  const [purchaseFilter, setPurchaseFilter] = useState<"all" | "restock" | "critical">("all");

  const purchaseRecommendations = useMemo(() => {
    // Days in current observation window
    let daysCount = 30;
    if (range === "today") daysCount = 1;
    else if (range === "7") daysCount = 7;
    else if (range === "30") daysCount = 30;
    else if (range === "90") daysCount = 90;
    else if (range === "custom" && startDate && endDate) {
      daysCount = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
    }

    // Sales volume map
    const salesVolume = new Map<string, number>();
    for (const o of currentPaid) {
      for (const it of o.items ?? []) {
        const key = (it.product_id || it.name || "").toLowerCase().trim();
        salesVolume.set(key, (salesVolume.get(key) || 0) + Number(it.qty || 0));
      }
    }

    const items = products.map((p) => {
      const byId = p.id ? salesVolume.get(p.id.toLowerCase().trim()) : undefined;
      const byName = p.name ? salesVolume.get(p.name.toLowerCase().trim()) : undefined;
      const soldQty = byId || byName || 0;

      const dailyBurn = Math.round((soldQty / daysCount) * 10) / 10;
      const stock = Number(p.stock || 0);
      const unit = p.unit || "kg";
      const costPrice = Number(p.cost_price) || Math.round(Number(p.price || 0) * 0.68);
      const lowThreshold = p.low_stock_threshold ?? 5;

      // Runway in days
      const daysRemaining = dailyBurn > 0 ? Math.round((stock / dailyBurn) * 10) / 10 : stock > 0 ? 99 : 0;

      // Recommended Inward Qty (Target: 3 days of buffer stock + 25% peak safety margin)
      const targetStock = Math.ceil(dailyBurn * 3 * 1.25);
      const recommendedProcure = Math.max(0, targetStock - stock);
      const estimatedCost = Math.round(recommendedProcure * costPrice);

      let urgency: "critical" | "high" | "optimal" | "overstocked" = "optimal";
      let reason = "";

      if (stock === 0 && dailyBurn > 0) {
        urgency = "critical";
        reason = `Stock depleted! Daily burn is ${dailyBurn} ${unit}/day. Procure ${recommendedProcure} ${unit} immediately at harbour dawn catch.`;
      } else if (daysRemaining <= 0.8 && dailyBurn > 0) {
        urgency = "critical";
        reason = `Stockout risk today! Only ${stock} ${unit} remaining (${daysRemaining} days runway). Inward ${recommendedProcure} ${unit} tomorrow morning.`;
      } else if (stock <= lowThreshold || (daysRemaining <= 2.0 && dailyBurn > 0)) {
        urgency = "high";
        reason = `Near safety threshold. Order velocity requires ${recommendedProcure} ${unit} replenishment for weekend demand buffer.`;
      } else if (daysRemaining > 6.0 && stock > 15) {
        urgency = "overstocked";
        reason = `Stocked adequately (${daysRemaining} days of stock). Pause harbour purchasing to avoid cold storage shrinkage.`;
      } else {
        urgency = "optimal";
        reason = `Healthy turnover. Maintain normal procurement schedule.`;
      }

      return {
        id: p.id,
        name: p.name,
        category: p.category || "Seafood",
        stock,
        unit,
        dailyBurn,
        daysRemaining,
        recommendedProcure,
        costPrice,
        estimatedCost,
        urgency,
        reason,
        isActive: p.is_available ?? true,
      };
    });

    // Sort by critical urgency first, then recommended procure qty
    const urgencyWeight = { critical: 0, high: 1, optimal: 2, overstocked: 3 };
    return items.sort(
      (a, b) =>
        urgencyWeight[a.urgency] - urgencyWeight[b.urgency] || b.recommendedProcure - a.recommendedProcure
    );
  }, [products, currentPaid, range, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    if (purchaseFilter === "critical") return purchaseRecommendations.filter((p) => p.urgency === "critical");
    if (purchaseFilter === "restock")
      return purchaseRecommendations.filter((p) => p.urgency === "critical" || p.urgency === "high");
    return purchaseRecommendations;
  }, [purchaseRecommendations, purchaseFilter]);

  // Export options for Smart Procurement Sheet
  const procurementExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Product / Fish Variety", type: "string" },
      { key: "category", label: "Category", type: "string" },
      {
        key: "stock",
        label: "Current Stock",
        type: "string",
        format: (v, r) => `${v} ${r.unit}`,
      },
      {
        key: "dailyBurn",
        label: "Avg Daily Sales",
        type: "string",
        format: (v, r) => `${v} ${r.unit}/day`,
      },
      {
        key: "daysRemaining",
        label: "Runway (Days)",
        type: "number",
      },
      {
        key: "recommendedProcure",
        label: "Recommended Harbour Inward",
        type: "string",
        format: (v, r) => `${v} ${r.unit}`,
      },
      {
        key: "costPrice",
        label: "Est. Cost/Unit (₹)",
        type: "currency",
        format: (v) => formatINR(Number(v || 0)),
      },
      {
        key: "estimatedCost",
        label: "Total Budget (₹)",
        type: "currency",
        format: (v) => formatINR(Number(v || 0)),
      },
      {
        key: "urgency",
        label: "Restock Priority",
        type: "string",
        format: (v) => v.toUpperCase(),
      },
      { key: "reason", label: "Operational Recommendation", type: "string" },
    ];

    return {
      filename: `fishnfresh-procurement-sheet-${new Date().toISOString().slice(0, 10)}`,
      title: "Harbour Catch Morning Procurement & Restocking Order Sheet",
      subtitle: `Generated on ${new Date().toLocaleDateString("en-IN")} | Observation Window: ${range.toUpperCase()} | ${filteredPurchases.length} items`,
      columns,
      data: filteredPurchases,
      orientation: "landscape",
    };
  }, [filteredPurchases, range]);

  return (
    <div className="space-y-6 mt-6">
      {/* 1. PEAK TIME & PEAK SALES INTELLIGENCE SECTION */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-amber-500" />
              Peak Time & Peak Sales Intelligence
            </h3>
            <p className="text-xs text-muted-foreground">
              Identify hourly rush hours, peak revenue influx, and coastal weekend sales velocity.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/60 p-1 rounded-xl border border-border/70">
            <button
              type="button"
              onClick={() => setHourlyMetric("revenue")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                hourlyMetric === "revenue"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sales Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setHourlyMetric("orders")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                hourlyMetric === "orders"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Order Count
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Hourly Distribution Chart */}
          <Card className="lg:col-span-2 border-border/70 shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {hourlyMetric === "revenue" ? "Hourly Sales Influx (IST)" : "Hourly Order Rush (IST)"}
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground">Operating window (6:00 AM to 10:00 PM)</span>
                </div>
                {hourlyStats.peakRevenueSlot && hourlyStats.peakRevenueSlot.revenue > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                    Peak Hour: {hourlyStats.peakRevenueSlot.label} ({formatINR(hourlyStats.peakRevenueSlot.revenue)})
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-5">
              <div className="flex h-44 items-end gap-1 sm:gap-1.5 pt-4">
                {hourlyStats.list.map((h) => {
                  const val = hourlyMetric === "revenue" ? h.revenue : h.count;
                  const max = hourlyMetric === "revenue" ? hourlyStats.maxRevenue : hourlyStats.maxOrders;
                  const heightPct = Math.max(6, (val / max) * 100);
                  const isPeak =
                    hourlyMetric === "revenue"
                      ? hourlyStats.peakRevenueSlot?.hour === h.hour && h.revenue > 0
                      : hourlyStats.peakOrderSlot?.hour === h.hour && h.count > 0;

                  return (
                    <div
                      key={h.hour}
                      className="group relative flex flex-1 flex-col items-center gap-1"
                      title={`${h.label}: ${formatINR(h.revenue)} (${h.count} orders)`}
                    >
                      <div className="relative w-full">
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            isPeak
                              ? "bg-amber-500 shadow-sm"
                              : "bg-primary/40 group-hover:bg-primary/80"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span
                        className={`text-[8px] sm:text-[9px] font-mono ${
                          isPeak ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {h.hour % 2 === 0 ? h.label : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Peak Hour Insights Banner */}
              <div className="mt-3.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Flame className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Staff Scheduling & Catch Prep Recommendation: </span>
                  Peak operational rush consistently concentrates between{" "}
                  <span className="font-bold underline">
                    {hourlyStats.peakRevenueSlot?.label || "10 AM"} and{" "}
                    {formatHourLabel((hourlyStats.peakRevenueSlot?.hour || 10) + 1)}
                  </span>
                  . Have weighing counters, fish cutters, and ice boxes calibrated 30 minutes prior to prevent dispatch bottlenecks.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day of Week Peak Sales Chart */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Peak Day of Week</CardTitle>
                  <span className="text-[11px] text-muted-foreground">Coastal dock demand by weekday</span>
                </div>
                {dayOfWeekStats.peakDay && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                    Peak: {dayOfWeekStats.peakDay.short}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-5 space-y-2.5">
              {dayOfWeekStats.days.map((d) => {
                const isPeak = dayOfWeekStats.peakDay?.dayIdx === d.dayIdx && d.revenue > 0;
                const widthPct = Math.max(8, (d.revenue / dayOfWeekStats.maxDayRevenue) * 100);

                return (
                  <div key={d.dayIdx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold ${isPeak ? "text-primary" : "text-foreground"}`}>
                        {d.name} {isPeak && "🔥"}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatINR(d.revenue)} ({d.count} orders)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPeak ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. DATE RANGE COMPARISON INTELLIGENCE TOOL */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="size-4 text-emerald-600" />
                Date Comparison & Growth Intelligence
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Compare current period performance against prior period with top-selling items growth.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border/80 text-xs">
                <button
                  type="button"
                  onClick={() => setCompareMode("auto")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    compareMode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  Auto Prior Period
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode("custom")}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    compareMode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  Custom Compare
                </button>
              </div>

              {compareMode === "custom" && (
                <div className="flex items-center gap-1.5 text-xs bg-muted/50 p-1.5 rounded-xl border border-border/80">
                  <span className="text-muted-foreground">Prior:</span>
                  <Input
                    type="date"
                    value={customCompareStart}
                    onChange={(e) => setCustomCompareStart(e.target.value)}
                    className="h-7 w-28 text-[11px] rounded-lg"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customCompareEnd}
                    onChange={(e) => setCustomCompareEnd(e.target.value)}
                    className="h-7 w-28 text-[11px] rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Comparison Delta KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Revenue Delta */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Net Sales Revenue</span>
                {revenueGrowthPct >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                    <ArrowUpRight className="size-3.5" /> +{revenueGrowthPct}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                    <ArrowDownRight className="size-3.5" /> {revenueGrowthPct}%
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xl font-bold text-foreground">{formatINR(currentRevenue)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Prior Period:</span>
                <span className="font-mono font-medium">{formatINR(previousRevenue)}</span>
              </div>
            </div>

            {/* Orders Delta */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Total Orders Count</span>
                {ordersGrowthPct >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                    <ArrowUpRight className="size-3.5" /> +{ordersGrowthPct}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                    <ArrowDownRight className="size-3.5" /> {ordersGrowthPct}%
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xl font-bold text-foreground">{currentPaid.length} orders</div>
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Prior Period:</span>
                <span className="font-mono font-medium">{previousPaid.length} orders</span>
              </div>
            </div>

            {/* Average Order Value (AOV) Delta */}
            <div className="p-3.5 rounded-2xl border border-border/80 bg-card">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Avg Order Value (AOV)</span>
                {aovGrowthPct >= 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                    <ArrowUpRight className="size-3.5" /> +{aovGrowthPct}%
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                    <ArrowDownRight className="size-3.5" /> {aovGrowthPct}%
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xl font-bold text-foreground">{formatINR(currentAov)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Prior Period:</span>
                <span className="font-mono font-medium">{formatINR(previousAov)}</span>
              </div>
            </div>
          </div>

          {/* Top-Selling Items Comparison Table */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Fish className="size-3.5 text-primary" />
              Top Selling Fish & Meat SKUs: Period Comparison
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-border/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/70">
                  <tr>
                    <th className="py-2.5 px-3">Fish / Product SKU</th>
                    <th className="py-2.5 px-3 text-right">Current Qty</th>
                    <th className="py-2.5 px-3 text-right">Current Sales (₹)</th>
                    <th className="py-2.5 px-3 text-right">Prior Qty</th>
                    <th className="py-2.5 px-3 text-right">Prior Sales (₹)</th>
                    <th className="py-2.5 px-3 text-center">Trend & Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {itemComparison.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                        <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{item.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {item.currentQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                        {formatINR(item.currentRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {item.prevQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {formatINR(item.prevRevenue)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.status === "new" && (
                          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-400/30 text-[10px]">
                            ★ NEW SKU
                          </Badge>
                        )}
                        {item.status === "up" && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 text-[10px]">
                            +{item.growthPct}% ↗
                          </Badge>
                        )}
                        {item.status === "down" && (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/30 text-[10px]">
                            {item.growthPct}% ↘
                          </Badge>
                        )}
                        {item.status === "flat" && (
                          <span className="text-muted-foreground font-mono text-[11px]">0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {itemComparison.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No sales data found for items in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. SMART HARBOUR PURCHASING & INWARD RECOMMENDATIONS */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <PackagePlus className="size-4 text-cyan-600" />
                Smart Harbour Catch Purchasing Recommendations
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Algorithmic replenishment advice based on daily sales burn rate, runway days, and dock fresh safety buffers.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <ExportDropdown
                options={procurementExportOptions}
                buttonLabel="Download Procurement Sheet"
                variant="default"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={purchaseFilter === "all" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs"
              onClick={() => setPurchaseFilter("all")}
            >
              All Products ({purchaseRecommendations.length})
            </Button>
            <Button
              size="sm"
              variant={purchaseFilter === "restock" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs border-amber-300 text-amber-700 dark:text-amber-300"
              onClick={() => setPurchaseFilter("restock")}
            >
              ⚠️ Restock Needed (
              {
                purchaseRecommendations.filter((p) => p.urgency === "critical" || p.urgency === "high")
                  .length
              }
              )
            </Button>
            <Button
              size="sm"
              variant={purchaseFilter === "critical" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs border-rose-300 text-rose-700 dark:text-rose-300"
              onClick={() => setPurchaseFilter("critical")}
            >
              🚨 Critical Stockout (
              {purchaseRecommendations.filter((p) => p.urgency === "critical").length})
            </Button>
          </div>

          {/* Purchasing Recommendations Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border/70">
                <tr>
                  <th className="py-2.5 px-3">Fish / Meat Variety</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Daily Burn</th>
                  <th className="py-2.5 px-3 text-center">Runway</th>
                  <th className="py-2.5 px-3 text-right">Recommended Harbour Inward</th>
                  <th className="py-2.5 px-3 text-right">Est. Cost (₹)</th>
                  <th className="py-2.5 px-3">Procurement Reason &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredPurchases.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      p.urgency === "critical"
                        ? "bg-rose-50/40 dark:bg-rose-950/15"
                        : p.urgency === "high"
                        ? "bg-amber-50/30 dark:bg-amber-950/10"
                        : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-foreground">
                      <div className="flex flex-col">
                        <span>{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.category}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {p.stock} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {p.dailyBurn} {p.unit}/day
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          p.daysRemaining <= 0.8
                            ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : p.daysRemaining <= 2.0
                            ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-green-400 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        }`}
                      >
                        {p.daysRemaining > 30 ? "30+ days" : `${p.daysRemaining} days`}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-cyan-700 dark:text-cyan-400">
                      {p.recommendedProcure > 0 ? (
                        <span className="bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                          +{p.recommendedProcure} {p.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0 {p.unit}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {p.estimatedCost > 0 ? formatINR(p.estimatedCost) : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-muted-foreground leading-relaxed max-w-xs">
                      {p.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
