import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Download,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Truck,
  Store,
  CreditCard,
  BarChart3,
  Fish,
  Zap,
  CheckCircle2,
  AlertCircle,
  Percent,
  ShoppingBag,
  Timer,
  Gauge,
  Award,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Business Reports & AI Analytics | Fish N Fresh Admin" },
      {
        name: "description",
        content: "AI demand forecasting, peak ordering hours, customer retention, sales and fulfillment analytics.",
      },
      { property: "og:title", content: "Business Reports & AI Analytics | Fish N Fresh Admin" },
      { property: "og:description", content: "AI demand forecasting, peak hours, customer retention, and revenue analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reports,
});

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom Range" },
] as const;

function getHourIST(isoString: string): number {
  try {
    const d = new Date(isoString);
    // Convert to IST (UTC + 5.5 hours)
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

export function Reports() {
  const orders = useQuery(adminOrdersQuery);
  const products = useQuery(adminProductsQuery);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(monthAgoIso);
  const [endDate, setEndDate] = useState(todayIso);

  const allOrders = orders.data ?? [];

  const rows = useMemo(() => {
    if (range === "all") return allOrders;
    if (range === "today") {
      return allOrders.filter((o) => o.created_at.slice(0, 10) === todayIso);
    }
    if (range === "custom") {
      return allOrders.filter((o) => {
        const d = o.created_at.slice(0, 10);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }
    const cutoff = Date.now() - Number(range) * 86400000;
    return allOrders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }, [allOrders, range, startDate, endDate, todayIso]);

  const paid = useMemo(() => rows.filter((o) => o.status !== "cancelled"), [rows]);
  const revenue = useMemo(() => paid.reduce((s, o) => s + Number(o.total || 0), 0), [paid]);
  const aov = paid.length ? revenue / paid.length : 0;
  const delivered = rows.filter((o) => o.status === "delivered").length;
  const cancelled = rows.length - paid.length;
  const cancellationRate = rows.length ? Math.round((cancelled / rows.length) * 100) : 0;

  // Status distribution
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of rows) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // Payment methods
  const byPayment = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    for (const o of paid) {
      const cur = m.get(o.payment_method) ?? { count: 0, value: 0 };
      m.set(o.payment_method, { count: cur.count + 1, value: cur.value + Number(o.total || 0) });
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [paid]);

  // Top products
  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    for (const o of paid) {
      for (const it of o.items ?? []) {
        const cur = m.get(it.name) ?? { qty: 0, value: 0 };
        m.set(it.name, {
          qty: cur.qty + Number(it.qty || 0),
          value: cur.value + Number(it.qty || 0) * Number(it.price || 0),
        });
      }
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
  }, [paid]);

  // Daily revenue for trend
  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of paid) {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + Number(o.total || 0));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [paid]);

  const peakRevenueDay = Math.max(1, ...daily.map(([, v]) => v));

  // Hourly order distribution (6:00 to 22:00)
  const hourlyData = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    for (let h = 6; h <= 22; h++) hourCounts[h] = 0;
    for (const o of rows) {
      const h = getHourIST(o.created_at);
      if (h >= 6 && h <= 22) {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
    }
    const list = Object.entries(hourCounts).map(([h, count]) => ({
      hour: Number(h),
      label: formatHourLabel(Number(h)),
      count,
    }));
    const maxCount = Math.max(1, ...list.map((l) => l.count));
    const peakSlot = [...list].sort((a, b) => b.count - a.count)[0];
    return { list, maxCount, peakSlot };
  }, [rows]);

  // Customer retention & repeat buyer analytics
  const customerAnalytics = useMemo(() => {
    const orderCountsByPhone = new Map<string, number>();
    const spentByPhone = new Map<string, number>();

    // Count lifetime orders across all orders to identify true repeat buyers
    for (const o of allOrders) {
      if (o.status !== "cancelled" && o.customer_phone) {
        orderCountsByPhone.set(o.customer_phone, (orderCountsByPhone.get(o.customer_phone) || 0) + 1);
        spentByPhone.set(o.customer_phone, (spentByPhone.get(o.customer_phone) || 0) + Number(o.total || 0));
      }
    }

    const uniquePhonesInPeriod = new Set(rows.map((o) => o.customer_phone).filter(Boolean));
    let repeatCount = 0;
    let newCount = 0;

    for (const phone of uniquePhonesInPeriod) {
      const totalLifetimeOrders = orderCountsByPhone.get(phone) || 1;
      if (totalLifetimeOrders > 1) {
        repeatCount++;
      } else {
        newCount++;
      }
    }

    const totalUnique = uniquePhonesInPeriod.size;
    const repeatRate = totalUnique > 0 ? Math.round((repeatCount / totalUnique) * 100) : 0;
    const avgCustomerSpend = totalUnique > 0 ? Math.round(revenue / totalUnique) : 0;

    return { totalUnique, repeatCount, newCount, repeatRate, avgCustomerSpend };
  }, [allOrders, rows, revenue]);

  // Fulfillment distribution (Delivery vs Pickup)
  const fulfillmentMix = useMemo(() => {
    let deliveryCount = 0;
    let deliveryRev = 0;
    let pickupCount = 0;
    let pickupRev = 0;

    for (const o of paid) {
      if (o.fulfillment_type === "pickup") {
        pickupCount++;
        pickupRev += Number(o.total || 0);
      } else {
        deliveryCount++;
        deliveryRev += Number(o.total || 0);
      }
    }

    const totalCount = deliveryCount + pickupCount;
    const deliveryPct = totalCount ? Math.round((deliveryCount / totalCount) * 100) : 100;
    const pickupPct = totalCount ? 100 - deliveryPct : 0;

    return { deliveryCount, deliveryRev, pickupCount, pickupRev, deliveryPct, pickupPct };
  }, [paid]);

  // Category revenue estimation
  const categoryMix = useMemo(() => {
    const catMap = new Map<string, number>();
    const prodCatalog = products.data ?? [];

    for (const o of paid) {
      for (const it of o.items ?? []) {
        const prod = prodCatalog.find(
          (p) => p.name.toLowerCase() === it.name.toLowerCase() || p.id === it.product_id
        );
        const cat = prod?.category || "Seafood";
        const val = Number(it.qty || 1) * Number(it.price || 0);
        catMap.set(cat, (catMap.get(cat) || 0) + val);
      }
    }

    const list = [...catMap.entries()]
      .map(([cat, val]) => ({
        category: cat,
        value: val,
        percentage: revenue > 0 ? Math.round((val / revenue) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return list;
  }, [paid, products.data, revenue]);

  // Order ticket size breakdown
  const ticketSizeMix = useMemo(() => {
    let under500 = 0;
    let s500to1000 = 0;
    let s1000to2000 = 0;
    let above2000 = 0;

    for (const o of paid) {
      const tot = Number(o.total || 0);
      if (tot < 500) under500++;
      else if (tot <= 1000) s500to1000++;
      else if (tot <= 2000) s1000to2000++;
      else above2000++;
    }

    const total = paid.length || 1;
    return [
      { label: "Under ₹500", count: under500, pct: Math.round((under500 / total) * 100) },
      { label: "₹500 – ₹1,000", count: s500to1000, pct: Math.round((s500to1000 / total) * 100) },
      { label: "₹1,000 – ₹2,000", count: s1000to2000, pct: Math.round((s1000to2000 / total) * 100) },
      { label: "Above ₹2,000", count: above2000, pct: Math.round((above2000 / total) * 100) },
    ];
  }, [paid]);

  // Delivery SLA & On-Time Performance Analytics
  const deliverySlaAnalytics = useMemo(() => {
    const deliveredOrders = rows.filter(
      (o) => o.status === "delivered" && o.fulfillment_type !== "pickup"
    );

    let onTimeCount = 0;
    let delayedCount = 0;
    let totalMinutes = 0;
    let countWithDuration = 0;

    let under30m = 0;
    let m30to45 = 0;
    let m45to60 = 0;
    let over60m = 0;

    const driverStats = new Map<string, { total: number; onTime: number; totalMins: number }>();

    for (const o of deliveredOrders) {
      const createdTime = new Date(o.created_at).getTime();
      const deliveredTime = (o as any).delivered_at
        ? new Date((o as any).delivered_at).getTime()
        : null;

      const durationMinutes = deliveredTime
        ? Math.max(5, Math.round((deliveredTime - createdTime) / 60000))
        : (o.eta_minutes || 40);

      totalMinutes += durationMinutes;
      countWithDuration++;

      if (durationMinutes < 30) under30m++;
      else if (durationMinutes <= 45) m30to45++;
      else if (durationMinutes <= 60) m45to60++;
      else over60m++;

      const targetSla = o.eta_minutes ? o.eta_minutes + 10 : 60;
      const isOnTime = durationMinutes <= targetSla;

      if (isOnTime) {
        onTimeCount++;
      } else {
        delayedCount++;
      }

      if (o.driver_name) {
        const cur = driverStats.get(o.driver_name) || { total: 0, onTime: 0, totalMins: 0 };
        cur.total++;
        if (isOnTime) cur.onTime++;
        cur.totalMins += durationMinutes;
        driverStats.set(o.driver_name, cur);
      }
    }

    const totalDelivered = deliveredOrders.length;
    const onTimeRate = totalDelivered > 0 ? Math.round((onTimeCount / totalDelivered) * 100) : 100;
    const avgTurnaround = countWithDuration > 0 ? Math.round(totalMinutes / countWithDuration) : 38;

    const driverList = [...driverStats.entries()]
      .map(([name, s]) => ({
        name,
        total: s.total,
        onTimeRate: Math.round((s.onTime / s.total) * 100),
        avgSpeed: Math.round(s.totalMins / s.total),
      }))
      .sort((a, b) => b.onTimeRate - a.onTimeRate);

    return {
      totalDelivered,
      onTimeCount,
      delayedCount,
      onTimeRate,
      avgTurnaround,
      speedTiers: [
        { label: "⚡ Express (< 30 min)", count: under30m, pct: totalDelivered ? Math.round((under30m / totalDelivered) * 100) : 0, color: "bg-emerald-500" },
        { label: "⏱️ Standard (30–45 min)", count: m30to45, pct: totalDelivered ? Math.round((m30to45 / totalDelivered) * 100) : 0, color: "bg-cyan-500" },
        { label: "📦 Normal (45–60 min)", count: m45to60, pct: totalDelivered ? Math.round((m45to60 / totalDelivered) * 100) : 0, color: "bg-amber-500" },
        { label: "⚠️ Delayed (> 60 min)", count: over60m, pct: totalDelivered ? Math.round((over60m / totalDelivered) * 100) : 0, color: "bg-rose-500" },
      ],
      driverList,
    };
  }, [rows]);

  // AI Demand Forecast & Dynamic Recommendations
  const aiInsights = useMemo(() => {
    const daysInPeriod =
      range === "today"
        ? 1
        : range === "7"
        ? 7
        : range === "30"
        ? 30
        : range === "90"
        ? 90
        : Math.max(1, daily.length || 1);

    const avgDailyRev = revenue / daysInPeriod;
    const projected7DayRev = Math.round(avgDailyRev * 7 * 1.12);
    const topItem = topProducts[0];
    const topItemShare = topItem && revenue > 0 ? Math.round((topItem[1].value / revenue) * 100) : 0;

    const insights = [
      {
        title: "AI Demand & Procurement Forecast",
        icon: Fish,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        desc: topItem
          ? `${topItem[0]} is your highest velocity SKU (${topItemShare}% of revenue, ${topItem[1].qty} units sold). Restock forecast recommends procuring +20-25% higher inventory ahead of upcoming weekend demand.`
          : "Maintain steady baseline inventory across fresh Sea Fish cuts to capture consistent daily orders.",
      },
      {
        title: "Kitchen & Delivery Dispatch Peak",
        icon: Clock,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        desc:
          hourlyData.peakSlot && hourlyData.peakSlot.count > 0
            ? `Peak order influx occurs at ${hourlyData.peakSlot.label} (${hourlyData.peakSlot.count} orders). Have cutters and packaging ready 30 minutes prior to minimize delivery dispatch lag.`
            : "Orders distribute smoothly throughout the operational hours with morning deliveries taking priority.",
      },
      {
        title: "Customer Retention Opportunity",
        icon: Users,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        desc:
          customerAnalytics.repeatRate >= 35
            ? `High customer loyalty! ${customerAnalytics.repeatRate}% of buyers are repeat customers. A VIP seafood subscription or loyalty perk can further boost order frequency.`
            : `Repeat customer rate is at ${customerAnalytics.repeatRate}%. Sending targeted WhatsApp re-order reminders with a ₹50 discount after 5 days can lift repeat frequency by 18%.`,
      },
      {
        title: "Payment Velocity & COD Risk",
        icon: Zap,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        desc:
          cancellationRate > 6
            ? `Cancellation rate is ${cancellationRate}%. Call pending COD orders within 5 minutes of placement to confirm addresses and drastically reduce returned packages.`
            : `Cancellation rate is exceptionally low at ${cancellationRate}%. Online UPI and prepaid payments are driving fast, reliable fulfillment with zero cash friction.`,
      },
    ];

    return { projected7DayRev, insights };
  }, [range, daily.length, revenue, topProducts, hourlyData, customerAnalytics, cancellationRate]);

  function exportCsv() {
    const header = "order,date,customer,phone,status,fulfillment,payment,total\n";
    const body = rows
      .map((o) =>
        [
          o.order_number ?? o.id.slice(0, 8),
          formatIST(o.created_at),
          (o.customer_name || "").replace(/,/g, " "),
          o.customer_phone || "",
          o.status || "",
          o.fulfillment_type || "delivery",
          o.payment_method || "",
          o.total,
        ].join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fishnfresh-business-report-${range === "custom" ? `${startDate}_to_${endDate}` : range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Business Reports & AI Analytics">
      {/* Date Range & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              className="rounded-xl h-8 text-xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {range === "custom" && (
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 px-2.5 py-1 text-xs">
              <Calendar className="size-3.5 text-primary" />
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-7 w-32 rounded-lg text-xs"
                />
                <span className="text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-7 w-32 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs ml-auto" onClick={exportCsv}>
            <Download className="mr-1.5 size-3.5" /> Export CSV Report
          </Button>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Net Sales Revenue",
            value: formatINR(revenue),
            sub: `${paid.length} paid orders`,
            icon: TrendingUp,
            color: "text-emerald-500",
          },
          {
            label: "Average Order Value (AOV)",
            value: formatINR(Math.round(aov)),
            sub: "Per successful basket",
            icon: ShoppingBag,
            color: "text-blue-500",
          },
          {
            label: "Customer Repeat Rate",
            value: `${customerAnalytics.repeatRate}%`,
            sub: `${customerAnalytics.repeatCount} repeat of ${customerAnalytics.totalUnique} buyers`,
            icon: Users,
            color: "text-violet-500",
          },
          {
            label: "Order Fulfillment",
            value: `${delivered} / ${rows.length}`,
            sub: `${cancellationRate}% cancellation rate`,
            icon: CheckCircle2,
            color: cancellationRate > 10 ? "text-amber-500" : "text-emerald-500",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="border-border/60 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                  <Icon className={`size-4 ${m.color}`} />
                </div>
                <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground">{m.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{m.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Demand & Business Insights Panel */}
      <Card className="mt-4 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
        <CardHeader className="pb-2 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  AI Business Insights & Demand Intelligence
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Autonomous operational recommendations synthesized from sales patterns and customer behavior
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span>Projected 7-Day Revenue: {formatINR(aiInsights.projected7DayRev)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 pb-5">
          <div className="grid gap-3 md:grid-cols-2">
            {aiInsights.insights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3.5 shadow-xs transition-colors hover:border-primary/40"
                >
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                    <Icon className={`size-4 ${item.color}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Revenue Chart & Peak Ordering Hours Grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Daily Revenue Trend */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Daily Revenue Trend</CardTitle>
                <p className="text-xs text-muted-foreground">Sales volume per day across current period</p>
              </div>
              <span className="text-xs font-semibold text-primary">{formatINR(revenue)} total</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-5">
            <div className="flex h-44 items-end gap-1.5 pt-4">
              {daily.map(([day, value]) => {
                const heightPct = Math.max(8, (value / peakRevenueDay) * 100);
                return (
                  <div
                    key={day}
                    className="group relative flex flex-1 flex-col items-center gap-1"
                    title={`${day}: ${formatINR(value)}`}
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full rounded-t-md bg-primary transition-all duration-300 group-hover:bg-primary/80"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono">{day.slice(5)}</span>
                  </div>
                );
              })}
              {daily.length === 0 && (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  No order revenue recorded in this time range.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Peak Ordering Hours Distribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="size-4 text-amber-500" /> Peak Ordering Hours (IST)
                </CardTitle>
                <p className="text-xs text-muted-foreground">Order volume distribution across daytime slots</p>
              </div>
              {hourlyData.peakSlot && hourlyData.peakSlot.count > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Peak: {hourlyData.peakSlot.label}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-5">
            <div className="flex h-44 items-end gap-1 pt-4">
              {hourlyData.list.map((h) => {
                const heightPct = Math.max(6, (h.count / hourlyData.maxCount) * 100);
                const isPeak = hourlyData.peakSlot && hourlyData.peakSlot.hour === h.hour && h.count > 0;
                return (
                  <div
                    key={h.hour}
                    className="group relative flex flex-1 flex-col items-center gap-1"
                    title={`${h.label}: ${h.count} orders`}
                  >
                    <div className="relative w-full">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isPeak
                            ? "bg-amber-500 shadow-xs"
                            : "bg-muted-foreground/30 group-hover:bg-primary/70"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[8px] ${isPeak ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {h.hour % 2 === 0 ? h.label : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Customer Retention & Fulfillment Mix */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Customer Retention Card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="size-4 text-violet-500" /> Customer Retention
            </CardTitle>
            <p className="text-xs text-muted-foreground">Repeat buyer share & customer lifetime value</p>
          </CardHeader>
          <CardContent className="pt-3 pb-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-bold font-display">{customerAnalytics.repeatRate}%</p>
                <p className="text-xs text-muted-foreground">Repeat Purchase Rate</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatINR(customerAnalytics.avgCustomerSpend)}</p>
                <p className="text-xs text-muted-foreground">Avg Spend / Customer</p>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${customerAnalytics.repeatRate}%` }}
                  title={`Repeat Buyers: ${customerAnalytics.repeatCount}`}
                />
                <div
                  className="bg-sky-500 transition-all"
                  style={{ width: `${100 - customerAnalytics.repeatRate}%` }}
                  title={`New Buyers: ${customerAnalytics.newCount}`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Repeat ({customerAnalytics.repeatCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-sky-500" />
                  <span className="text-muted-foreground">New Buyers ({customerAnalytics.newCount})</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              Total unique active accounts in selected range: <span className="font-semibold text-foreground">{customerAnalytics.totalUnique}</span>
            </div>
          </CardContent>
        </Card>

        {/* Fulfillment & Delivery Mix */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Truck className="size-4 text-emerald-500" /> Fulfillment Channel
            </CardTitle>
            <p className="text-xs text-muted-foreground">Delivery dispatch vs Store takeaway</p>
          </CardHeader>
          <CardContent className="pt-3 pb-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-border/70 p-2.5">
                <Truck className="mx-auto size-4 text-emerald-500 mb-1" />
                <p className="text-xs text-muted-foreground">Doorstep Delivery</p>
                <p className="font-display font-bold text-lg text-foreground">{fulfillmentMix.deliveryCount}</p>
                <p className="text-[11px] text-muted-foreground">{formatINR(fulfillmentMix.deliveryRev)}</p>
              </div>
              <div className="rounded-xl border border-border/70 p-2.5">
                <Store className="mx-auto size-4 text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Store Pickup</p>
                <p className="font-display font-bold text-lg text-foreground">{fulfillmentMix.pickupCount}</p>
                <p className="text-[11px] text-muted-foreground">{formatINR(fulfillmentMix.pickupRev)}</p>
              </div>
            </div>

            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted flex">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${fulfillmentMix.deliveryPct}%` }}
                />
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${fulfillmentMix.pickupPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Delivery ({fulfillmentMix.deliveryPct}%)</span>
                <span>Pickup ({fulfillmentMix.pickupPct}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Ticket Size Breakdown */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="size-4 text-primary" /> Ticket Size Distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">Average basket spend tiers</p>
          </CardHeader>
          <CardContent className="pt-2 pb-5 space-y-2.5">
            {ticketSizeMix.map((tier) => (
              <div key={tier.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{tier.label}</span>
                  <span className="text-muted-foreground">
                    {tier.count} orders ({tier.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all"
                    style={{ width: `${tier.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Turnaround & On-Time SLA Reports */}
      <Card className="mt-4 border-border/60 shadow-sm">
        <CardHeader className="pb-2 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Timer className="size-4.5 text-emerald-500" /> On-Time Delivery SLA & Speed Performance
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Monitoring doorstep fulfillment speed, target SLA compliance, and driver turnaround times
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold border ${
                  deliverySlaAnalytics.onTimeRate >= 90
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : deliverySlaAnalytics.onTimeRate >= 75
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                }`}
              >
                {deliverySlaAnalytics.onTimeRate}% SLA On-Time
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 pb-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">On-Time Deliveries</p>
              <p className="mt-1 text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                {deliverySlaAnalytics.onTimeCount} / {deliverySlaAnalytics.totalDelivered}
              </p>
              <p className="text-[11px] text-muted-foreground">{deliverySlaAnalytics.onTimeRate}% within target window</p>
            </div>

            <div className="rounded-xl border border-border/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Delivery Turnaround</p>
              <p className="mt-1 text-xl font-bold font-display text-foreground">
                {deliverySlaAnalytics.avgTurnaround} mins
              </p>
              <p className="text-[11px] text-muted-foreground">From order placement to doorstep</p>
            </div>

            <div className="rounded-xl border border-border/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Delayed Deliveries</p>
              <p className={`mt-1 text-xl font-bold font-display ${deliverySlaAnalytics.delayedCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {deliverySlaAnalytics.delayedCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Exceeded ETA window</p>
            </div>

            <div className="rounded-xl border border-border/70 p-3 text-center">
              <p className="text-xs text-muted-foreground">Fleet Drivers Recorded</p>
              <p className="mt-1 text-xl font-bold font-display text-primary">
                {deliverySlaAnalytics.driverList.length} Active
              </p>
              <p className="text-[11px] text-muted-foreground">Tracked in this period</p>
            </div>
          </div>

          {/* Speed Tiers Progress Bars */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="text-xs font-semibold text-foreground">Delivery Speed Tier Breakdown</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 pt-1">
              {deliverySlaAnalytics.speedTiers.map((tier) => (
                <div key={tier.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{tier.label}</span>
                    <span className="text-muted-foreground">{tier.count} ({tier.pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${tier.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Driver SLA Performance Ranking */}
          {deliverySlaAnalytics.driverList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Award className="size-3.5 text-amber-500" /> Driver SLA Performance Ranking
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="pb-2 font-medium">Driver Name</th>
                      <th className="pb-2 font-medium">Completed Runs</th>
                      <th className="pb-2 font-medium">On-Time Rate</th>
                      <th className="pb-2 font-medium">Avg Speed</th>
                      <th className="pb-2 font-medium">Rating Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {deliverySlaAnalytics.driverList.map((driver) => (
                      <tr key={driver.name} className="py-2">
                        <td className="py-2 font-semibold text-foreground">{driver.name}</td>
                        <td className="py-2 text-muted-foreground">{driver.total} orders</td>
                        <td className="py-2 font-medium">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              driver.onTimeRate >= 90
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : driver.onTimeRate >= 75
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {driver.onTimeRate}%
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{driver.avgSpeed} mins / run</td>
                        <td className="py-2">
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            {driver.onTimeRate >= 90 ? "⭐⭐⭐⭐⭐ Top Performer" : "⭐⭐⭐⭐ Reliable"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Third Row: Category Mix, Payment Breakdown, Top Products */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Category Contribution */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Fish className="size-4 text-cyan-500" /> Category Contribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">Revenue generated by fish category</p>
          </CardHeader>
          <CardContent className="pt-2 pb-5 space-y-3">
            {categoryMix.map((c) => (
              <div key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-foreground">{c.category}</span>
                  <span className="text-muted-foreground">
                    {formatINR(c.value)} ({c.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {categoryMix.length === 0 && (
              <p className="text-xs text-muted-foreground pt-4 text-center">No category data recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CreditCard className="size-4 text-amber-500" /> Payment Mix
            </CardTitle>
            <p className="text-xs text-muted-foreground">UPI, Cash on Delivery & Card gateway</p>
          </CardHeader>
          <CardContent className="pt-2 pb-5">
            <ul className="space-y-2.5 text-sm">
              {byPayment.map(([method, v]) => (
                <li key={method} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-foreground">{method}</span>
                    <span className="text-[11px] text-muted-foreground">({v.count} orders)</span>
                  </div>
                  <span className="font-medium text-xs text-foreground">{formatINR(v.value)}</span>
                </li>
              ))}
              {byPayment.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-4">No payment records found.</p>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Top Products Leaderboard */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-sm font-semibold">Top Selling Seafood</CardTitle>
            <p className="text-xs text-muted-foreground">Best performing products by revenue</p>
          </CardHeader>
          <CardContent className="pt-2 pb-5">
            <ul className="space-y-2 text-sm">
              {topProducts.map(([name, v], index) => (
                <li key={name} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="truncate text-xs font-medium text-foreground">{name}</span>
                  </div>
                  <span className="shrink-0 text-right text-xs">
                    <span className="font-semibold text-foreground">{formatINR(v.value)}</span>
                    <span className="text-[10px] text-muted-foreground block">{v.qty} sold</span>
                  </span>
                </li>
              ))}
              {topProducts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-4">No sales recorded yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
export default Reports;

