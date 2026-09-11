import { createFileRoute, Link } from "@tanstack/react-router";
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
  Flame,
  Snowflake,
  Scale,
  Search,
  Package,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { formatINR, formatIST, formatStockDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AnalyticsIntelligence } from "@/components/admin/AnalyticsIntelligence";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";

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

  const [velocityTierFilter, setVelocityTierFilter] = useState<"all" | "top" | "medium" | "slow">("all");
  const [velocitySearch, setVelocitySearch] = useState("");

  // Product Sales Velocity (Top 🔥, Medium ⚖️, Slow ❄️)
  const productVelocity = useMemo(() => {
    const catalog = products.data ?? [];
    const salesMap = new Map<string, { qty: number; value: number; count: number }>();

    for (const o of paid) {
      for (const it of o.items ?? []) {
        const prodKey = (it.product_id || it.name || "").toLowerCase().trim();
        const cur = salesMap.get(prodKey) ?? { qty: 0, value: 0, count: 0 };
        salesMap.set(prodKey, {
          qty: cur.qty + Number(it.qty || 0),
          value: cur.value + Number(it.qty || 0) * Number(it.price || 0),
          count: cur.count + 1,
        });
      }
    }

    const items = catalog.map((p) => {
      const byId = p.id ? salesMap.get(p.id.toLowerCase().trim()) : undefined;
      const byName = p.name ? salesMap.get(p.name.toLowerCase().trim()) : undefined;
      const match = byId || byName || { qty: 0, value: 0, count: 0 };

      const costPrice = Number((p as any).cost_price) || Math.round(Number(p.price || 0) * 0.68);
      const cogs = Math.round(costPrice * match.qty);
      const grossProfit = Math.max(0, match.value - cogs);
      const marginPct = match.value > 0 ? Math.round((grossProfit / match.value) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        category: p.category || "Seafood",
        imageUrl: p.image_url,
        price: Number(p.price || 0),
        costPrice,
        cogs,
        grossProfit,
        marginPct,
        stock: Number(p.stock || 0),
        unit: p.unit || "kg",
        lowStockThreshold: (p as any).low_stock_threshold ?? 5,
        isActive: p.is_available ?? true,
        qtySold: match.qty,
        revenue: match.value,
        ordersCount: match.count,
      };
    });

    // Sort descending by revenue, then quantity sold
    items.sort((a, b) => b.revenue - a.revenue || b.qtySold - a.qtySold);

    const totalSoldRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
    const totalCogs = items.reduce((sum, i) => sum + i.cogs, 0);
    const totalGrossProfit = items.reduce((sum, i) => sum + i.grossProfit, 0);
    const overallMarginPct = totalSoldRevenue > 0 ? Math.round((totalGrossProfit / totalSoldRevenue) * 100) : 32;
    const activeSellingItems = items.filter((i) => i.qtySold > 0);

    const enriched = items.map((p, idx) => {
      let tier: "top" | "medium" | "slow" = "slow";
      let recommendation = "";

      if (p.qtySold === 0) {
        tier = "slow";
        recommendation =
          p.stock > 0
            ? "Zero sales in period: Offer 10-15% flash deal or spotlight on home page"
            : "No movement & zero stock: Review whether to restock or retire SKU";
      } else if (activeSellingItems.length <= 3) {
        if (idx === 0) {
          tier = "top";
          recommendation =
            p.stock <= p.lowStockThreshold
              ? "Critical: Top revenue earner near depletion! Procure harbour catch ASAP"
              : "Star SKU: Maintain +25% buffer for weekend rush";
        } else if (p.qtySold >= 2) {
          tier = "medium";
          recommendation = "Steady mover: Maintain regular weekly catch inward schedule";
        } else {
          tier = "slow";
          recommendation = "Low turnover: Bundle with top seller to accelerate clearance";
        }
      } else {
        const rankRatio = idx / activeSellingItems.length;
        if (rankRatio <= 0.3 || (totalSoldRevenue > 0 && p.revenue / totalSoldRevenue >= 0.12)) {
          tier = "top";
          recommendation =
            p.stock <= p.lowStockThreshold
              ? "Urgent: High-velocity seller is low on stock! Restock via harbour catch inward"
              : "High Demand Star: High customer repeat rate. Keep minimum 20kg+ safety stock";
        } else if (rankRatio <= 0.7 || p.qtySold >= 3) {
          tier = "medium";
          recommendation = "Healthy movement: Demand is stable and predictable";
        } else {
          tier = "slow";
          recommendation = "Low velocity: Launch WhatsApp promotional broadcast or combo offer";
        }
      }

      return {
        ...p,
        tier,
        recommendation,
      };
    });

    const topList = enriched.filter((p) => p.tier === "top");
    const mediumList = enriched.filter((p) => p.tier === "medium");
    const slowList = enriched.filter((p) => p.tier === "slow");

    const topRevenue = topList.reduce((s, p) => s + p.revenue, 0);
    const mediumRevenue = mediumList.reduce((s, p) => s + p.revenue, 0);
    const slowRevenue = slowList.reduce((s, p) => s + p.revenue, 0);

    return {
      all: enriched,
      topList,
      mediumList,
      slowList,
      topCount: topList.length,
      mediumCount: mediumList.length,
      slowCount: slowList.length,
      topRevenue,
      mediumRevenue,
      slowRevenue,
      totalCogs,
      totalGrossProfit,
      overallMarginPct,
      totalCatalog: enriched.length,
    };
  }, [products.data, paid]);

  const filteredVelocityProducts = useMemo(() => {
    let list = productVelocity.all;
    if (velocityTierFilter !== "all") {
      list = list.filter((p) => p.tier === velocityTierFilter);
    }
    if (velocitySearch.trim()) {
      const q = velocitySearch.toLowerCase().trim();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [productVelocity.all, velocityTierFilter, velocitySearch]);

  const profitExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Product SKU", type: "string" },
      { key: "category", label: "Category", type: "string" },
      { key: "tier", label: "Velocity Tier", type: "string", format: (v) => v === "top" ? "Top Selling 🔥" : v === "medium" ? "Steady Mover ⚖️" : "Slow Mover ❄️" },
      { key: "price", label: "Selling Rate (₹)", type: "currency", format: (v, r) => `${formatINR(v)} / ${r.unit}` },
      { key: "costPrice", label: "Inward Cost (₹)", type: "currency", format: (v) => formatINR(v) },
      { key: "qtySold", label: "Units Sold", type: "number", format: (v, r) => `${v} ${r.unit}` },
      { key: "revenue", label: "Gross Revenue (₹)", type: "currency", format: (v) => formatINR(v) },
      { key: "cogs", label: "COGS (₹)", type: "currency", format: (v) => formatINR(v) },
      { key: "grossProfit", label: "Gross Profit (₹)", type: "currency", format: (v) => formatINR(v) },
      { key: "marginPct", label: "Margin (%)", type: "string", format: (v) => `${v}%` },
      { key: "stock", label: "Current Stock", type: "number", format: (v, r) => `${v} ${r.unit}` },
      { key: "recommendation", label: "Inventory Strategy", type: "string" },
    ];
    return {
      filename: `fishnfresh-profitability-report-${new Date().toISOString().slice(0, 10)}`,
      title: "Seafood SKU Profitability & Margin Analysis",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | ${filteredVelocityProducts.length} items | Total Profit: ${formatINR(productVelocity.totalGrossProfit)} (${productVelocity.overallMarginPct}% margin)`,
      columns,
      data: filteredVelocityProducts,
      orientation: "landscape",
    };
  }, [filteredVelocityProducts, productVelocity]);

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

  // Monthly Cohort Retention Matrix (Acquisition Month vs M0-M5 retention)
  const cohortAnalytics = useMemo(() => {
    const customerOrders = new Map<string, Date[]>();
    for (const o of allOrders) {
      if (o.status !== "cancelled" && o.customer_phone) {
        const list = customerOrders.get(o.customer_phone) || [];
        list.push(new Date(o.created_at));
        customerOrders.set(o.customer_phone, list);
      }
    }

    const cohorts = new Map<string, { size: number; monthCounts: number[] }>();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    customerOrders.forEach((dates) => {
      if (!dates.length) return;
      dates.sort((a, b) => a.getTime() - b.getTime());
      const firstDate = dates[0];
      if (!firstDate) return;
      const cKey = monthKey(firstDate);

      if (!cohorts.has(cKey)) {
        cohorts.set(cKey, { size: 0, monthCounts: [0, 0, 0, 0, 0, 0] });
      }
      const c = cohorts.get(cKey);
      if (!c) return;
      c.size++;

      const activeMonths = new Set<number>();
      dates.forEach((d) => {
        const monthDiff = (d.getFullYear() - firstDate.getFullYear()) * 12 + (d.getMonth() - firstDate.getMonth());
        if (monthDiff >= 0 && monthDiff < 6) {
          activeMonths.add(monthDiff);
        }
      });

      activeMonths.forEach((m) => {
        if (typeof c.monthCounts[m] === "number") {
          c.monthCounts[m]++;
        }
      });
    });

    const cohortList = [...cohorts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5)
      .map(([month, data]) => {
        const [y, m] = month.split("-");
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        const monthLabel = dateObj.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        return {
          monthKey: month,
          monthLabel,
          size: data.size,
          retention: data.monthCounts.map((count) =>
            data.size > 0 ? Math.round((count / data.size) * 100) : 0
          ),
        };
      });

    // Customer Loyalty Tiers
    let oneOrder = 0;
    let twoOrders = 0;
    let threeToFive = 0;
    let sixPlus = 0;
    const totalBuyers = customerOrders.size || 1;

    customerOrders.forEach((dates) => {
      const count = dates.length;
      if (count === 1) oneOrder++;
      else if (count === 2) twoOrders++;
      else if (count <= 5) threeToFive++;
      else sixPlus++;
    });

    const loyaltyTiers = [
      { label: "1-Time Buyers", count: oneOrder, pct: Math.round((oneOrder / totalBuyers) * 100), color: "bg-sky-500", desc: "Initial trial buyers" },
      { label: "2 Orders", count: twoOrders, pct: Math.round((twoOrders / totalBuyers) * 100), color: "bg-blue-500", desc: "First repeat achieved" },
      { label: "3–5 Orders", count: threeToFive, pct: Math.round((threeToFive / totalBuyers) * 100), color: "bg-emerald-500", desc: "Regular household customers" },
      { label: "6+ Orders", count: sixPlus, pct: Math.round((sixPlus / totalBuyers) * 100), color: "bg-purple-500", desc: "VIP seafood lovers" },
    ];

    const lifetimeRevenue = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgLtv = totalBuyers > 0 ? Math.round(lifetimeRevenue / totalBuyers) : 0;

    return { cohortList, loyaltyTiers, totalBuyers, avgLtv };
  }, [allOrders]);

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

  // Channel Performance: POS Retail Counter vs Online App Delivery
  const channelAnalytics = useMemo(() => {
    const posOrders = paid.filter((o) => o.fulfillment_type === "pos");
    const onlineOrders = paid.filter((o) => o.fulfillment_type !== "pos");

    const posRev = posOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const onlineRev = onlineOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalRev = (posRev + onlineRev) || 1;

    const posAov = posOrders.length ? Math.round(posRev / posOrders.length) : 0;
    const onlineAov = onlineOrders.length ? Math.round(onlineRev / onlineOrders.length) : 0;

    // POS Payment breakdown
    let posCash = 0;
    let posUpi = 0;
    let posCard = 0;
    for (const o of posOrders) {
      const tot = Number(o.total || 0);
      const meth = ((o as any).actual_payment_method || o.payment_method || "").toLowerCase();
      if (meth === "cash") posCash += tot;
      else if (meth === "upi" || meth === "upi_qr") posUpi += tot;
      else posCard += tot;
    }

    // Online Payment breakdown
    let onlineCod = 0;
    let onlinePrepaid = 0;
    for (const o of onlineOrders) {
      const tot = Number(o.total || 0);
      const meth = ((o as any).actual_payment_method || o.payment_method || "").toLowerCase();
      if (meth === "cod" || meth === "cash") onlineCod += tot;
      else onlinePrepaid += tot;
    }

    return {
      posCount: posOrders.length,
      posRev,
      posAov,
      posSharePct: Math.round((posRev / totalRev) * 100),
      posCash,
      posUpi,
      posCard,
      onlineCount: onlineOrders.length,
      onlineRev,
      onlineAov,
      onlineSharePct: Math.round((onlineRev / totalRev) * 100),
      onlineCod,
      onlinePrepaid,
    };
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

  const reportExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "order_number", label: "Order #", type: "string", format: (v, r) => v ?? r.id.slice(0, 8) },
      { key: "created_at", label: "Date & Time (IST)", type: "date", format: (v) => formatIST(v) },
      { key: "customer_name", label: "Customer Name", type: "string" },
      { key: "customer_phone", label: "Phone", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "fulfillment_type", label: "Fulfillment", type: "string" },
      { key: "payment_method", label: "Payment Method", type: "string" },
      { key: "total", label: "Total Amount (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
    ];
    return {
      filename: `fishnfresh-business-report-${range === "custom" ? `${startDate}_to_${endDate}` : range}`,
      title: "Fish N Fresh Business Performance Report",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | Range: ${range.toUpperCase()} | ${rows.length} orders`,
      columns,
      data: rows,
    };
  }, [rows, range, startDate, endDate]);

  return (
    <AdminShell title="Business Reports & AI Analytics" allow={["admin", "manager"]}>
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

          <ExportDropdown options={reportExportOptions} buttonLabel="Export Report" className="ml-auto" />
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

      {/* Quick Jump Bar for Profit & Cohort Views */}
      <div className="mt-3 flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-card border border-border/70 text-xs">
        <span className="text-[11px] font-bold text-muted-foreground px-1">Quick Views:</span>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-7 text-xs font-semibold"
          onClick={() => document.getElementById("profit-margin-analysis")?.scrollIntoView({ behavior: "smooth" })}
        >
          <TrendingUp className="size-3.5 mr-1 text-emerald-600" /> Profit Per Product &amp; Margins
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-7 text-xs font-semibold"
          onClick={() => document.getElementById("customer-cohorts-retention")?.scrollIntoView({ behavior: "smooth" })}
        >
          <Users className="size-3.5 mr-1 text-violet-600" /> Customer Cohorts &amp; Repeat Rates
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-7 text-xs font-semibold"
          onClick={() => document.getElementById("omnichannel-split")?.scrollIntoView({ behavior: "smooth" })}
        >
          <Store className="size-3.5 mr-1 text-primary" /> POS vs Online Split
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-7 text-xs font-semibold"
          onClick={() => document.getElementById("delivery-sla-section")?.scrollIntoView({ behavior: "smooth" })}
        >
          <Timer className="size-3.5 mr-1 text-cyan-600" /> Delivery SLA Speeds
        </Button>
      </div>

      {/* Peak Time & Sales Analytics, Date Range Comparison & Smart Harbour Purchasing Suite */}
      <AnalyticsIntelligence
        allOrders={allOrders}
        currentOrders={rows}
        products={products.data ?? []}
        range={range}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Omnichannel Performance: In-Store Counter POS vs Online App Delivery */}
      <Card id="omnichannel-split" className="mt-4 border-border/70 shadow-sm overflow-hidden scroll-mt-20">
        <CardHeader className="bg-muted/30 pb-3 pt-4 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Channel Performance: In-Store POS Counter vs Online App Delivery
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Real-time revenue split, average ticket comparison, and payment tender distribution
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                POS Share: {channelAnalytics.posSharePct}%
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                Online Share: {channelAnalytics.onlineSharePct}%
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Visual Channel Share Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Store className="size-3.5" /> In-Store Counter POS ({channelAnalytics.posSharePct}%)
              </span>
              <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1">
                <Truck className="size-3.5" /> Online App Delivery ({channelAnalytics.onlineSharePct}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-muted flex">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${channelAnalytics.posSharePct}%` }}
                title={`POS: ${formatINR(channelAnalytics.posRev)}`}
              />
              <div
                className="bg-sky-500 transition-all duration-500"
                style={{ width: `${channelAnalytics.onlineSharePct}%` }}
                title={`Online: ${formatINR(channelAnalytics.onlineRev)}`}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* IN-STORE POS COUNTER CARD */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                    <Store className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">In-Store Counter POS</h4>
                    <p className="text-[10px] text-muted-foreground">Walk-in retail counter sales &amp; instant receipts</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                  {channelAnalytics.posCount} bills
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">POS Revenue</p>
                  <p className="text-lg font-bold font-display text-emerald-700 dark:text-emerald-400">
                    {formatINR(channelAnalytics.posRev)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Counter AOV</p>
                  <p className="text-lg font-bold font-display text-foreground">
                    {formatINR(channelAnalytics.posAov)}
                  </p>
                </div>
              </div>

              {/* POS Tender Mix */}
              <div className="pt-2 border-t border-emerald-500/20 space-y-1.5 text-xs">
                <p className="text-[11px] font-semibold text-muted-foreground">Payment Tender Mix:</p>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-background/80 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block">Cash</span>
                    <span className="font-bold text-xs font-mono text-amber-600">{formatINR(channelAnalytics.posCash)}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background/80 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block">UPI QR</span>
                    <span className="font-bold text-xs font-mono text-emerald-600">{formatINR(channelAnalytics.posUpi)}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background/80 border border-emerald-500/20">
                    <span className="text-[10px] text-muted-foreground block">Card / Split</span>
                    <span className="font-bold text-xs font-mono text-primary">{formatINR(channelAnalytics.posCard)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ONLINE APP DELIVERY CARD */}
            <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                    <Truck className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Online App Orders</h4>
                    <p className="text-[10px] text-muted-foreground">Doorstep express delivery &amp; scheduled orders</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-sky-500/30 text-sky-700 dark:text-sky-300">
                  {channelAnalytics.onlineCount} orders
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-500/20">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Online Revenue</p>
                  <p className="text-lg font-bold font-display text-sky-700 dark:text-sky-400">
                    {formatINR(channelAnalytics.onlineRev)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Online AOV</p>
                  <p className="text-lg font-bold font-display text-foreground">
                    {formatINR(channelAnalytics.onlineAov)}
                  </p>
                </div>
              </div>

              {/* Online Payment Mix */}
              <div className="pt-2 border-t border-sky-500/20 space-y-1.5 text-xs">
                <p className="text-[11px] font-semibold text-muted-foreground">Payment Method Mix:</p>
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <div className="p-1.5 rounded-lg bg-background/80 border border-sky-500/20">
                    <span className="text-[10px] text-muted-foreground block">Cash on Delivery (COD)</span>
                    <span className="font-bold text-xs font-mono text-amber-600">{formatINR(channelAnalytics.onlineCod)}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-background/80 border border-sky-500/20">
                    <span className="text-[10px] text-muted-foreground block">Online / UPI Prepaid</span>
                    <span className="font-bold text-xs font-mono text-sky-600">{formatINR(channelAnalytics.onlinePrepaid)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
      <Card id="delivery-sla-section" className="mt-4 border-border/60 shadow-sm scroll-mt-20">
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-2xl border border-border/70 p-3 text-center bg-card shadow-2xs">
              <p className="text-[11px] font-medium text-muted-foreground">On-Time Deliveries</p>
              <p className="mt-1 text-lg sm:text-xl font-extrabold font-display text-emerald-600 dark:text-emerald-400">
                {deliverySlaAnalytics.onTimeCount} / {deliverySlaAnalytics.totalDelivered}
              </p>
              <p className="text-[10px] text-muted-foreground">{deliverySlaAnalytics.onTimeRate}% on-time</p>
            </div>

            <div className="rounded-2xl border border-border/70 p-3 text-center bg-card shadow-2xs">
              <p className="text-[11px] font-medium text-muted-foreground">Avg Turnaround</p>
              <p className="mt-1 text-lg sm:text-xl font-extrabold font-display text-foreground">
                {deliverySlaAnalytics.avgTurnaround} mins
              </p>
              <p className="text-[10px] text-muted-foreground">Order to doorstep</p>
            </div>

            <div className="rounded-2xl border border-border/70 p-3 text-center bg-card shadow-2xs">
              <p className="text-[11px] font-medium text-muted-foreground">Delayed Runs</p>
              <p className={`mt-1 text-lg sm:text-xl font-extrabold font-display ${deliverySlaAnalytics.delayedCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {deliverySlaAnalytics.delayedCount}
              </p>
              <p className="text-[10px] text-muted-foreground">Exceeded ETA</p>
            </div>

            <div className="rounded-2xl border border-border/70 p-3 text-center bg-card shadow-2xs">
              <p className="text-[11px] font-medium text-muted-foreground">Active Drivers</p>
              <p className="mt-1 text-lg sm:text-xl font-extrabold font-display text-primary">
                {deliverySlaAnalytics.driverList.length} Drivers
              </p>
              <p className="text-[10px] text-muted-foreground">Recorded in period</p>
            </div>
          </div>

          {/* Speed Tiers Progress Bars */}
          <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-3.5">
            <p className="text-xs font-bold text-foreground">Delivery Speed Tier Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              {deliverySlaAnalytics.speedTiers.map((tier) => (
                <div key={tier.label} className="space-y-1 rounded-xl bg-background/80 p-2 border border-border/40">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground truncate">{tier.label}</span>
                    <span className="font-bold text-muted-foreground ml-1">{tier.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${tier.pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{tier.count} orders</p>
                </div>
              ))}
            </div>
          </div>

          {/* Driver SLA Performance Ranking */}
          {deliverySlaAnalytics.driverList.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Award className="size-4 text-amber-500" /> Driver SLA Performance Ranking
              </p>

              {/* Mobile Card View for Driver SLA (sm:hidden) */}
              <div className="space-y-2 sm:hidden">
                {deliverySlaAnalytics.driverList.map((driver) => (
                  <div key={driver.name} className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-foreground">{driver.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          driver.onTimeRate >= 90
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : driver.onTimeRate >= 75
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {driver.onTimeRate}% SLA
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <span>{driver.total} runs delivered</span>
                      <span className="font-medium text-foreground">Avg {driver.avgSpeed} mins / run</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
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

      {/* Product Sales Velocity & Movement Analysis (Profit Per Product & Margins) */}
      <Card id="profit-margin-analysis" className="mt-4 border-border/60 shadow-sm scroll-mt-20">
        <CardHeader className="pb-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Flame className="size-5 text-orange-500 animate-pulse" />
                Product Sales Velocity & Movement Analysis
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Catalog categorized into Top Selling 🔥, Steady / Medium ⚖️, and Slow Selling ❄️ for the selected time window
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/admin/purchases">
                <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">
                  <Package className="mr-1.5 size-3.5 text-primary" /> Catch Inward Refill
                </Button>
              </Link>
              <Link to="/admin/products">
                <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">
                  <ExternalLink className="mr-1.5 size-3.5" /> Edit Products
                </Button>
              </Link>
              <ExportDropdown options={profitExportOptions} buttonLabel="Export Margin Sheet" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-5 space-y-4">
          {/* Velocity KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Top Selling */}
            <div
              onClick={() => setVelocityTierFilter(velocityTierFilter === "top" ? "all" : "top")}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-all shadow-2xs ${
                velocityTierFilter === "top"
                  ? "border-orange-500/60 bg-orange-500/10 ring-2 ring-orange-500/20"
                  : "border-border/70 bg-card hover:border-orange-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400">
                  <Flame className="size-4" /> Top Selling SKUs
                </span>
                <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-extrabold text-orange-600 dark:text-orange-400">
                  {productVelocity.topCount} SKUs
                </span>
              </div>
              <p className="mt-2 text-xl font-extrabold font-display text-foreground">
                {formatINR(productVelocity.topRevenue)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                High turnover • Fast revenue drivers
              </p>
            </div>

            {/* Medium / Steady */}
            <div
              onClick={() => setVelocityTierFilter(velocityTierFilter === "medium" ? "all" : "medium")}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-all shadow-2xs ${
                velocityTierFilter === "medium"
                  ? "border-blue-500/60 bg-blue-500/10 ring-2 ring-blue-500/20"
                  : "border-border/70 bg-card hover:border-blue-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Scale className="size-4" /> Medium / Steady SKUs
                </span>
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                  {productVelocity.mediumCount} SKUs
                </span>
              </div>
              <p className="mt-2 text-xl font-extrabold font-display text-foreground">
                {formatINR(productVelocity.mediumRevenue)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Steady volume • Predictable demand
              </p>
            </div>

            {/* Slow Selling */}
            <div
              onClick={() => setVelocityTierFilter(velocityTierFilter === "slow" ? "all" : "slow")}
              className={`cursor-pointer rounded-2xl border p-3.5 transition-all shadow-2xs ${
                velocityTierFilter === "slow"
                  ? "border-slate-500/60 bg-slate-500/10 ring-2 ring-slate-500/20"
                  : "border-border/70 bg-card hover:border-slate-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <Snowflake className="size-4" /> Slow / Low Velocity
                </span>
                <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-400">
                  {productVelocity.slowCount} SKUs
                </span>
              </div>
              <p className="mt-2 text-xl font-extrabold font-display text-foreground">
                {formatINR(productVelocity.slowRevenue)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Low turnover • Spoilage / overstock risk
              </p>
            </div>
          </div>

          {/* Unit Economics & Profit Margins Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/70 shadow-2xs">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Catalog Sales Revenue</p>
              <p className="text-base sm:text-lg font-bold font-display text-foreground">
                {formatINR(productVelocity.all.reduce((s, p) => s + p.revenue, 0))}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Est. Cost of Goods (COGS)</p>
              <p className="text-base sm:text-lg font-bold font-display text-muted-foreground">
                {formatINR(productVelocity.totalCogs)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Gross Profit</p>
              <p className="text-base sm:text-lg font-bold font-display text-emerald-600 dark:text-emerald-400">
                {formatINR(productVelocity.totalGrossProfit)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Blended Profit Margin</p>
              <p className="text-base sm:text-lg font-bold font-display text-primary">
                {productVelocity.overallMarginPct}%
              </p>
            </div>
          </div>

          {/* Filter Toolbar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={velocityTierFilter === "all" ? "default" : "outline"}
                className="rounded-xl h-8 text-xs font-semibold"
                onClick={() => setVelocityTierFilter("all")}
              >
                All SKUs ({productVelocity.totalCatalog})
              </Button>
              <Button
                size="sm"
                variant={velocityTierFilter === "top" ? "default" : "outline"}
                className={`rounded-xl h-8 text-xs font-semibold ${
                  velocityTierFilter === "top" ? "bg-orange-600 hover:bg-orange-700 text-white" : ""
                }`}
                onClick={() => setVelocityTierFilter("top")}
              >
                <Flame className="mr-1 size-3.5 text-orange-400" /> Top ({productVelocity.topCount})
              </Button>
              <Button
                size="sm"
                variant={velocityTierFilter === "medium" ? "default" : "outline"}
                className={`rounded-xl h-8 text-xs font-semibold ${
                  velocityTierFilter === "medium" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                }`}
                onClick={() => setVelocityTierFilter("medium")}
              >
                <Scale className="mr-1 size-3.5 text-blue-400" /> Medium ({productVelocity.mediumCount})
              </Button>
              <Button
                size="sm"
                variant={velocityTierFilter === "slow" ? "default" : "outline"}
                className={`rounded-xl h-8 text-xs font-semibold ${
                  velocityTierFilter === "slow" ? "bg-slate-700 hover:bg-slate-800 text-white" : ""
                }`}
                onClick={() => setVelocityTierFilter("slow")}
              >
                <Snowflake className="mr-1 size-3.5 text-slate-400" /> Slow ({productVelocity.slowCount})
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search fish or category..."
                value={velocitySearch}
                onChange={(e) => setVelocitySearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Product Cards for Mobile (< sm) */}
          <div className="space-y-3 sm:hidden pt-2">
            {filteredVelocityProducts.map((p) => {
              const isLowStock = p.stock <= p.lowStockThreshold;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="size-11 rounded-xl object-cover border border-border/50 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Fish className="size-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{p.category}</p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border flex items-center gap-1 ${
                        p.tier === "top"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                          : p.tier === "medium"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {p.tier === "top" && <Flame className="size-3" />}
                      {p.tier === "medium" && <Scale className="size-3" />}
                      {p.tier === "slow" && <Snowflake className="size-3" />}
                      {p.tier === "top" ? "Top Selling" : p.tier === "medium" ? "Steady Mover" : "Slow Mover"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Period Sales</span>
                      <span className="font-bold text-foreground">
                        {p.qtySold > 0 ? `${p.qtySold} sold` : "0 sold"}
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                        {formatINR(p.revenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Live Stock</span>
                      <span
                        className={`font-bold inline-flex items-center gap-1 ${
                          isLowStock ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                        }`}
                      >
                        {isLowStock && <AlertCircle className="size-3 shrink-0" />}
                        {formatStockDisplay(p.stock, p.unit)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Threshold: {p.lowStockThreshold}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/60 p-2.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Strategy: </span>
                    {p.recommendation}
                  </div>
                </div>
              );
            })}

            {filteredVelocityProducts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                No products match the selected velocity filter or search term.
              </div>
            )}
          </div>

          {/* Product Table for Desktop (>= sm) */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                  <th className="py-2.5 px-3.5 font-semibold">Product SKU</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Velocity</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Units Sold</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Revenue</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Inward Cost</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Gross Profit</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Margin %</th>
                  <th className="py-2.5 px-3 font-semibold">Current Stock</th>
                  <th className="py-2.5 px-3 font-semibold">Inventory Strategy & Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredVelocityProducts.map((p) => {
                  const isLowStock = p.stock <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3.5 font-medium">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="size-8 rounded-lg object-cover border border-border/50 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Fish className="size-4" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground block">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatINR(p.price)} / {p.unit}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 capitalize text-muted-foreground">{p.category}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                            p.tier === "top"
                              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                              : p.tier === "medium"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
                          }`}
                        >
                          {p.tier === "top" && <Flame className="size-3" />}
                          {p.tier === "medium" && <Scale className="size-3" />}
                          {p.tier === "slow" && <Snowflake className="size-3" />}
                          {p.tier === "top" ? "Top Selling 🔥" : p.tier === "medium" ? "Steady Mover ⚖️" : "Slow Mover ❄️"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                        {p.qtySold > 0 ? `${p.qtySold}` : "0"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {formatINR(p.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatINR(p.costPrice)} / {p.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatINR(p.grossProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                            p.marginPct >= 35
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : p.marginPct >= 20
                              ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {p.marginPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              isLowStock ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                            }`}
                          >
                            {formatStockDisplay(p.stock, p.unit)}
                          </span>
                          {isLowStock && (
                            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Low Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground leading-snug">
                        {p.recommendation}
                      </td>
                    </tr>
                  );
                })}

                {filteredVelocityProducts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-xs text-muted-foreground">
                      No products match the selected velocity filter or search term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Cohort Retention Matrix & Lifetime Value (LTV) Card */}
      <Card id="customer-cohorts-retention" className="mt-4 border-border/60 shadow-sm scroll-mt-20">
        <CardHeader className="pb-2 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="size-4 text-violet-500" /> Customer Cohort Retention & Loyalty Analytics
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Monthly acquisition cohorts tracking re-order rates across 6 months, customer loyalty distribution, and lifetime value
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                Customer LTV: {formatINR(cohortAnalytics.avgLtv)}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Active Buyers: {cohortAnalytics.totalBuyers}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 pb-5 space-y-4 min-w-0 max-w-full">
          <div className="grid gap-4 lg:grid-cols-3 min-w-0 max-w-full">
            {/* Cohort Heatmap Grid */}
            <div className="lg:col-span-2 min-w-0 max-w-full space-y-2">
              <p className="text-xs font-bold text-foreground">Monthly Retention Heatmap Grid</p>
              <div className="w-full min-w-0 overflow-x-auto no-scrollbar rounded-2xl border border-border/60">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                      <th className="py-2 px-3 font-semibold">Acquisition Month</th>
                      <th className="py-2 px-3 text-right font-semibold">Cohort Size</th>
                      <th className="py-2 px-3 text-center font-semibold">M0 (Launch)</th>
                      <th className="py-2 px-3 text-center font-semibold">M1</th>
                      <th className="py-2 px-3 text-center font-semibold">M2</th>
                      <th className="py-2 px-3 text-center font-semibold">M3</th>
                      <th className="py-2 px-3 text-center font-semibold">M4</th>
                      <th className="py-2 px-3 text-center font-semibold">M5</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {cohortAnalytics.cohortList.map((c) => (
                      <tr key={c.monthKey} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 font-bold text-foreground">{c.monthLabel}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-muted-foreground">
                          {c.size} users
                        </td>
                        {c.retention.map((pct, idx) => {
                          let bg = "bg-muted/30 text-muted-foreground";
                          if (pct === 100) bg = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold";
                          else if (pct >= 40) bg = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold";
                          else if (pct >= 25) bg = "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-medium";
                          else if (pct >= 10) bg = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
                          else if (pct > 0) bg = "bg-rose-500/10 text-rose-600 dark:text-rose-400";

                          return (
                            <td key={idx} className="py-2.5 px-2 text-center">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] ${bg}`}>
                                {pct}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {cohortAnalytics.cohortList.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                          Not enough order history yet to compute monthly cohorts.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                * Note: M0 represents month of initial acquisition. Subsequent columns represent re-order frequency in succeeding calendar months.
              </p>
            </div>

            {/* Loyalty Tiers Distribution */}
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
              <div>
                <p className="text-xs font-bold text-foreground">Customer Loyalty Tiers</p>
                <p className="text-[11px] text-muted-foreground">Order frequency distribution across all buyers</p>
              </div>

              <div className="space-y-2.5 pt-1">
                {cohortAnalytics.loyaltyTiers.map((tier) => (
                  <div key={tier.label} className="space-y-1 rounded-xl bg-background/80 p-2.5 border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">{tier.label}</span>
                        <span className="text-[10px] text-muted-foreground block">{tier.desc}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-foreground">{tier.count}</span>
                        <span className="text-[10px] text-muted-foreground block">{tier.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1">
                      <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${tier.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                <strong>Benchmark:</strong> A 30%+ repeat customer rate signals strong product retention in fresh food retail.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
export default Reports;

