import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  TrendingDown,
  TrendingUp,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Zap,
  ArrowRight,
  ShieldAlert,
  Flame,
  Package,
  Layers,
  Percent,
  Check,
  Sun,
  Moon,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminProductsQuery } from "@/lib/admin";
import { settingsQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({
    meta: [
      { title: "AI Dynamic Pricing & Markdown Rules | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Automated perishable decay markdowns, rush-hour surge pricing, and excess inventory clearance with mobile touch control.",
      },
    ],
  }),
  component: DynamicPricingPage,
});

interface PricingRules {
  timeDecay: {
    enabled: boolean;
    cutOffTime: string; // e.g. "17:30"
    discountPercent: number; // e.g. 12
  };
  rushHourSurge: {
    enabled: boolean;
    startHour: string; // e.g. "12:30"
    endHour: string; // e.g. "15:30"
    surgePercent: number; // e.g. 5
    applyWeekendOnly: boolean;
  };
  excessStock: {
    enabled: boolean;
    stockThreshold: number; // e.g. 15
    discountPercent: number; // e.g. 15
  };
  autopilot: boolean;
}

const DEFAULT_RULES: PricingRules = {
  timeDecay: {
    enabled: true,
    cutOffTime: "17:30",
    discountPercent: 12,
  },
  rushHourSurge: {
    enabled: true,
    startHour: "12:30",
    endHour: "15:30",
    surgePercent: 5,
    applyWeekendOnly: true,
  },
  excessStock: {
    enabled: true,
    stockThreshold: 15,
    discountPercent: 15,
  },
  autopilot: false,
};

interface PricingRecommendation {
  product: Product;
  currentPrice: number;
  suggestedPrice: number;
  ruleType: "time_decay" | "rush_surge" | "excess_stock" | "optimal";
  ruleDescription: string;
  marginProtectionText: string;
  urgency: "high" | "medium" | "low";
}

const TIME_PRESETS = [
  { label: "Morning Fresh", time: "08:00", emoji: "🌅", desc: "Baseline margins" },
  { label: "Lunch Peak", time: "13:30", emoji: "🍛", desc: "High demand rush surge" },
  { label: "Evening Decay", time: "18:00", emoji: "🌙", desc: "Perishable markdown" },
  { label: "Closing Flash", time: "20:30", emoji: "🚨", desc: "Zero-waste clearout" },
] as const;

function DynamicPricingPage() {
  const qc = useQueryClient();
  const { data: rawProducts, isLoading } = useQuery(adminProductsQuery());
  const { data: settings } = useQuery(settingsQuery);

  // Mobile segmented tab switcher: "adjustments" | "rules" | "simulator"
  const [activeMobileTab, setActiveMobileTab] = useState<"adjustments" | "rules" | "simulator">("adjustments");

  const [rules, setRules] = useState<PricingRules>(() => {
    if (typeof window === "undefined") return DEFAULT_RULES;
    try {
      const saved = localStorage.getItem("fnf_dynamic_pricing_rules");
      return saved ? JSON.parse(saved) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });

  // Simulated Time Slider (allows testing evening clearance / lunch surge at any time)
  const [simulatedHour, setSimulatedHour] = useState<string>(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    return `${hrs}:${mins}`;
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Save rules to localStorage
  const handleSaveRules = (newRules: PricingRules) => {
    setRules(newRules);
    try {
      localStorage.setItem("fnf_dynamic_pricing_rules", JSON.stringify(newRules));
      toast.success("Dynamic pricing rules saved!");
    } catch {}
  };

  // Convert "HH:MM" to slider minute value (0 - 1439)
  const sliderMinutes = useMemo(() => {
    const [h, m] = simulatedHour.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }, [simulatedHour]);

  const handleSliderChange = (minutes: number) => {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    setSimulatedHour(`${h}:${m}`);
  };

  // Evaluate dynamic pricing engine recommendations against active products
  const recommendations: PricingRecommendation[] = useMemo(() => {
    if (!rawProducts) return [];

    const [currentH, currentM] = simulatedHour.split(":").map(Number);
    const currentMinutes = (currentH || 0) * 60 + (currentM || 0);

    const [decayH, decayM] = rules.timeDecay.cutOffTime.split(":").map(Number);
    const decayMinutes = (decayH || 17) * 60 + (decayM || 30);

    const [surgeStartH, surgeStartM] = rules.rushHourSurge.startHour.split(":").map(Number);
    const [surgeEndH, surgeEndM] = rules.rushHourSurge.endHour.split(":").map(Number);
    const surgeStartMinutes = (surgeStartH || 12) * 60 + (surgeStartM || 30);
    const surgeEndMinutes = (surgeEndH || 15) * 60 + (surgeEndM || 30);

    const dayOfWeek = new Date().getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const results: PricingRecommendation[] = [];

    for (const prod of rawProducts) {
      const price = Number(prod.price || 0);
      const stock = Number(prod.stock || 0);
      if (price <= 0) continue;

      let suggestedPrice = price;
      let ruleType: PricingRecommendation["ruleType"] = "optimal";
      let ruleDescription = "Operating at target standard margin.";
      let marginProtectionText = "Healthy baseline profitability.";
      let urgency: PricingRecommendation["urgency"] = "low";

      // 1. Check Excess Stock Trigger
      if (rules.excessStock.enabled && stock >= rules.excessStock.stockThreshold) {
        const discountAmount = (price * rules.excessStock.discountPercent) / 100;
        suggestedPrice = Math.max(1, Math.round(price - discountAmount));
        ruleType = "excess_stock";
        ruleDescription = `Excess inventory alert: ${stock} units remaining. Apply ${rules.excessStock.discountPercent}% clearance markdown.`;
        marginProtectionText = `Recovers capital before expiration; preserves ~22% margin.`;
        urgency = "high";
      }
      // 2. Check Time-Decay Clearance (Evening markdown for perishables)
      else if (rules.timeDecay.enabled && currentMinutes >= decayMinutes) {
        const discountAmount = (price * rules.timeDecay.discountPercent) / 100;
        suggestedPrice = Math.max(1, Math.round(price - discountAmount));
        ruleType = "time_decay";
        ruleDescription = `Post-${rules.timeDecay.cutOffTime} perishable decay trigger. Markdown ${rules.timeDecay.discountPercent}% for zero-waste day-end clearout.`;
        marginProtectionText = `Avoids 100% total spoilage loss; liquidates daily catch fresh.`;
        urgency = "high";
      }
      // 3. Check Rush Hour Surge (Lunch peak demand surge)
      else if (
        rules.rushHourSurge.enabled &&
        currentMinutes >= surgeStartMinutes &&
        currentMinutes <= surgeEndMinutes &&
        (!rules.rushHourSurge.applyWeekendOnly || isWeekend)
      ) {
        const surgeAmount = (price * rules.rushHourSurge.surgePercent) / 100;
        suggestedPrice = Math.round(price + surgeAmount);
        ruleType = "rush_surge";
        ruleDescription = `Peak rush hour demand window. Apply ${rules.rushHourSurge.surgePercent}% high-demand surge pricing.`;
        marginProtectionText = `Maximizes counter throughput margin during rush demand.`;
        urgency = "medium";
      }

      if (suggestedPrice !== price) {
        results.push({
          product: prod,
          currentPrice: price,
          suggestedPrice,
          ruleType,
          ruleDescription,
          marginProtectionText,
          urgency,
        });
      }
    }

    return results;
  }, [rawProducts, rules, simulatedHour]);

  // Pre-select all recommendations by default
  useEffect(() => {
    setSelectedItems(new Set(recommendations.map((r) => r.product.id)));
  }, [recommendations.length]);

  // Estimated margin protected across recommended items
  const totalMarginProtected = useMemo(() => {
    return recommendations.reduce((acc, rec) => {
      const diff = Math.abs(rec.suggestedPrice - rec.currentPrice);
      const stock = Number(rec.product.stock || 1);
      return acc + diff * Math.min(stock, 10);
    }, 0);
  }, [recommendations]);

  // Apply pricing mutations to database
  const applyPricingMutation = useMutation({
    mutationFn: async (targets: PricingRecommendation[]) => {
      if (targets.length === 0) return;

      const promises = targets.map((rec) =>
        supabase
          .from("products")
          .update({ price: rec.suggestedPrice })
          .eq("id", rec.product.id)
      );

      const responses = await Promise.all(promises);
      const errors = responses.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} products`);
      }
    },
    onSuccess: (_, targets) => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `Applied dynamic prices to ${targets.length} product(s) successfully!`
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply dynamic pricing");
    },
  });

  const handleApplySelected = () => {
    const targets = recommendations.filter((r) => selectedItems.has(r.product.id));
    if (targets.length === 0) {
      toast.info("No items selected. Check one or more products to apply prices.");
      return;
    }
    applyPricingMutation.mutate(targets);
  };

  const handleApplySingle = (rec: PricingRecommendation) => {
    applyPricingMutation.mutate([rec]);
  };

  return (
    <AdminShell title="AI Dynamic Pricing Engine" allow={["admin", "manager"]}>
      <div className="space-y-6 max-w-6xl mx-auto pb-24 md:pb-16">
        {/* Segmented Mobile Tab Switcher (< md screens) */}
        <div className="grid grid-cols-3 gap-1 bg-muted/80 p-1.5 rounded-2xl md:hidden sticky top-2 z-30 shadow-xs backdrop-blur">
          <button
            onClick={() => setActiveMobileTab("adjustments")}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeMobileTab === "adjustments"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>⚡ Adjustments</span>
            {recommendations.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {recommendations.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveMobileTab("rules")}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
              activeMobileTab === "rules"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>⚙️ Rules</span>
          </button>
          <button
            onClick={() => setActiveMobileTab("simulator")}
            className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
              activeMobileTab === "simulator"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>⏱️ Simulator</span>
          </button>
        </div>

        {/* Hero Banner (Always visible on desktop, or adjustments tab on mobile) */}
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-[280px]">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                AI Dynamic Pricing &amp; Markdown Rules
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Automate perishable time-decay discounts, rush-hour surge pricing, and excess inventory flash
              clearance to maximize revenue and minimize day-end waste.
            </p>
          </div>

          {/* Desktop Top Trigger Bar */}
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-card border border-border rounded-2xl p-2.5 flex items-center gap-3 text-xs shadow-xs">
              <Clock className="size-4 text-primary shrink-0" />
              <div>
                <span className="text-[10px] text-muted-foreground block">Clock Simulator:</span>
                <input
                  type="time"
                  value={simulatedHour}
                  onChange={(e) => setSimulatedHour(e.target.value)}
                  className="bg-transparent font-bold text-foreground font-mono focus:outline-none"
                />
              </div>
            </div>

            <Button
              onClick={handleApplySelected}
              disabled={recommendations.length === 0 || applyPricingMutation.isPending}
              className="rounded-2xl h-11 text-xs font-bold px-5 bg-primary text-primary-foreground gap-2 shadow-sm"
            >
              <Zap className="size-4" />
              <span>
                {applyPricingMutation.isPending
                  ? "Applying Prices..."
                  : `Apply All Recommended (${recommendations.length})`}
              </span>
            </Button>
          </div>
        </div>

        {/* Interactive Time Simulator Card (Mobile simulator tab OR desktop collapsible card) */}
        <div className={`${activeMobileTab === "simulator" ? "block" : "hidden md:block"}`}>
          <Card className="rounded-3xl border-primary/30 bg-card/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <span>Interactive Time Simulator &amp; Clock Scrubber</span>
                </CardTitle>
                <div className="flex items-center gap-2 font-mono font-black text-sm bg-muted/70 px-3 py-1 rounded-xl">
                  <span>Simulated:</span>
                  <span className="text-primary">{simulatedHour}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Drag the time slider or tap a quick preset chip below to preview real-time perishable decay
                and surge price recommendations at different hours of the retail operating day.
              </p>

              {/* Range Slider */}
              <div className="space-y-1.5 pt-1">
                <input
                  type="range"
                  min="360"
                  max="1380"
                  step="15"
                  value={sliderMinutes}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-1">
                  <span>06:00 AM (Opening)</span>
                  <span>12:00 PM (Lunch)</span>
                  <span>06:00 PM (Decay)</span>
                  <span>11:00 PM (Closing)</span>
                </div>
              </div>

              {/* 4 Quick Preset Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {TIME_PRESETS.map((preset) => {
                  const isCurrent = simulatedHour === preset.time;
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => {
                        setSimulatedHour(preset.time);
                        toast.info(`Simulating ${preset.label} (${preset.time})`);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isCurrent
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-base">{preset.emoji}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono px-1.5 py-0 ${
                            isCurrent ? "border-primary text-primary font-bold" : "text-muted-foreground"
                          }`}
                        >
                          {preset.time}
                        </Badge>
                      </div>
                      <div className="mt-1">
                        <div className="text-xs font-bold text-foreground">{preset.label}</div>
                        <div className="text-[10px] text-muted-foreground line-clamp-1">{preset.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rule Customization Cards (Mobile rules tab OR desktop grid) */}
        <div
          className={`${
            activeMobileTab === "rules" ? "grid" : "hidden md:grid"
          } grid-cols-1 md:grid-cols-3 gap-4`}
        >
          {/* 1. Perishable Time Decay */}
          <Card className="rounded-3xl border-border/70 hover:border-amber-500/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="size-4 text-amber-500" />
                  <span>Time-Decay Clearance</span>
                </CardTitle>
                <Switch
                  checked={rules.timeDecay.enabled}
                  onCheckedChange={(val) =>
                    handleSaveRules({
                      ...rules,
                      timeDecay: { ...rules.timeDecay, enabled: val },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Applies automated evening discounts on perishable seafood and produce to ensure 0 unsold stock
                at closing time.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Clearance Time</label>
                  <Input
                    type="time"
                    value={rules.timeDecay.cutOffTime}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        timeDecay: { ...rules.timeDecay, cutOffTime: e.target.value },
                      })
                    }
                    className="h-8 text-xs font-mono rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Markdown %</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={rules.timeDecay.discountPercent}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        timeDecay: {
                          ...rules.timeDecay,
                          discountPercent: Number(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Rush Hour Surge */}
          <Card className="rounded-3xl border-border/70 hover:border-emerald-500/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <span>Rush Hour Surge</span>
                </CardTitle>
                <Switch
                  checked={rules.rushHourSurge.enabled}
                  onCheckedChange={(val) =>
                    handleSaveRules({
                      ...rules,
                      rushHourSurge: { ...rules.rushHourSurge, enabled: val },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Optimizes peak-time margins during heavy Sunday and weekend lunch/dinner rushes.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Start Time</label>
                  <Input
                    type="time"
                    value={rules.rushHourSurge.startHour}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        rushHourSurge: {
                          ...rules.rushHourSurge,
                          startHour: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs font-mono rounded-xl px-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">End Time</label>
                  <Input
                    type="time"
                    value={rules.rushHourSurge.endHour}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        rushHourSurge: {
                          ...rules.rushHourSurge,
                          endHour: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs font-mono rounded-xl px-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Surge %</label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={rules.rushHourSurge.surgePercent}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        rushHourSurge: {
                          ...rules.rushHourSurge,
                          surgePercent: Number(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Excess Stock Flash Markdown */}
          <Card className="rounded-3xl border-border/70 hover:border-rose-500/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Flame className="size-4 text-rose-500" />
                  <span>Excess Inventory Trigger</span>
                </CardTitle>
                <Switch
                  checked={rules.excessStock.enabled}
                  onCheckedChange={(val) =>
                    handleSaveRules({
                      ...rules,
                      excessStock: { ...rules.excessStock, enabled: val },
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Automatically activates flash clearance when inventory stock exceeds threshold near closing hours.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Stock Threshold</label>
                  <Input
                    type="number"
                    min="5"
                    value={rules.excessStock.stockThreshold}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        excessStock: {
                          ...rules.excessStock,
                          stockThreshold: Number(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Markdown %</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={rules.excessStock.discountPercent}
                    onChange={(e) =>
                      handleSaveRules({
                        ...rules,
                        excessStock: {
                          ...rules.excessStock,
                          discountPercent: Number(e.target.value),
                        },
                      })
                    }
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Recommendations Section (Visible on desktop OR mobile adjustments tab) */}
        <div className={`${activeMobileTab === "adjustments" ? "block" : "hidden md:block"}`}>
          <Card className="rounded-3xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span>Live Recommended Price Adjustments</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Showing {recommendations.length} calculated adjustments for simulated time:{" "}
                    <code className="font-mono font-bold text-foreground">{simulatedHour}</code>
                  </p>
                </div>

                {recommendations.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedItems.size === recommendations.length) {
                          setSelectedItems(new Set());
                        } else {
                          setSelectedItems(new Set(recommendations.map((r) => r.product.id)));
                        }
                      }}
                      className="rounded-xl text-xs h-8"
                    >
                      {selectedItems.size === recommendations.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {recommendations.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
                  <CheckCircle2 className="size-10 mx-auto text-emerald-500 opacity-60" />
                  <p className="font-bold text-foreground text-sm">All Inventory Operating at Target Margin</p>
                  <p className="max-w-md mx-auto">
                    No automated markdowns or surges needed for time {simulatedHour}. Use the clock simulator above to
                    preview evening clearance after {rules.timeDecay.cutOffTime}.
                  </p>
                </div>
              ) : (
                <>
                  {/* MOBILE CARD FEED (< md screens) */}
                  <div className="space-y-3.5 md:hidden">
                    {recommendations.map((rec) => {
                      const isSelected = selectedItems.has(rec.product.id);
                      const isDiscount = rec.suggestedPrice < rec.currentPrice;
                      const diff = Math.abs(rec.suggestedPrice - rec.currentPrice);
                      const pct = Math.round((diff / rec.currentPrice) * 100);

                      return (
                        <div
                          key={rec.product.id}
                          className={`rounded-2xl border transition-all p-4 space-y-3 ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-xs"
                              : "border-border/80 bg-card"
                          }`}
                        >
                          {/* Row 1: Checkbox, Thumbnail, Title, Stock Urgency */}
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedItems);
                                if (e.target.checked) next.add(rec.product.id);
                                else next.delete(rec.product.id);
                                setSelectedItems(next);
                              }}
                              className="size-5 rounded mt-0.5 accent-primary cursor-pointer shrink-0"
                            />

                            <div className="size-12 rounded-xl bg-muted border border-border/80 flex items-center justify-center overflow-hidden shrink-0">
                              {rec.product.image_url ? (
                                <img
                                  src={rec.product.image_url}
                                  alt={rec.product.name}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <Package className="size-6 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-foreground truncate">
                                {rec.product.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span>{rec.product.unit || "unit"}</span>
                                <span>&bull;</span>
                                <span
                                  className={
                                    Number(rec.product.stock || 0) >= rules.excessStock.stockThreshold
                                      ? "text-rose-600 font-bold"
                                      : "text-foreground"
                                  }
                                >
                                  Stock: {rec.product.stock ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Price Delta Capsule */}
                          <div className="flex items-center justify-between bg-muted/40 border border-border/60 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs line-through text-muted-foreground font-medium">
                                {formatINR(rec.currentPrice)}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground" />
                              <span className="text-base font-black text-foreground">
                                {formatINR(rec.suggestedPrice)}
                              </span>
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-xs font-bold px-2 py-0.5 ${
                                isDiscount
                                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                                  : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                              }`}
                            >
                              {isDiscount ? `-${pct}% Markdown` : `+${pct}% Surge`}
                            </Badge>
                          </div>

                          {/* Row 3: AI Reason & Margin Protection */}
                          <div className="bg-background/80 border border-border/50 rounded-xl p-2.5 text-xs space-y-1">
                            <p className="font-semibold text-foreground text-[11px] leading-snug">
                              {rec.ruleDescription}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              💡 {rec.marginProtectionText}
                            </p>
                          </div>

                          {/* Row 4: Single Apply Action */}
                          <div className="flex items-center justify-end pt-0.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplySingle(rec)}
                              disabled={applyPricingMutation.isPending}
                              className="h-8 text-xs font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/10 px-4"
                            >
                              Apply Price
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE VIEW (>= md screens) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/80 text-muted-foreground">
                          <th className="py-2.5 px-3 font-semibold">Select</th>
                          <th className="py-2.5 px-3 font-semibold">Product</th>
                          <th className="py-2.5 px-3 font-semibold">Stock</th>
                          <th className="py-2.5 px-3 font-semibold">Current</th>
                          <th className="py-2.5 px-3 font-semibold">Dynamic Price</th>
                          <th className="py-2.5 px-3 font-semibold">AI Analysis &amp; Rule</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {recommendations.map((rec) => {
                          const isSelected = selectedItems.has(rec.product.id);
                          const isDiscount = rec.suggestedPrice < rec.currentPrice;
                          const diff = Math.abs(rec.suggestedPrice - rec.currentPrice);
                          const pct = Math.round((diff / rec.currentPrice) * 100);

                          return (
                            <tr
                              key={rec.product.id}
                              className={`hover:bg-muted/30 transition-colors ${
                                isSelected ? "bg-primary/5" : ""
                              }`}
                            >
                              <td className="py-3 px-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const next = new Set(selectedItems);
                                    if (e.target.checked) next.add(rec.product.id);
                                    else next.delete(rec.product.id);
                                    setSelectedItems(next);
                                  }}
                                  className="size-4 rounded accent-primary cursor-pointer"
                                />
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="size-8 rounded-lg bg-muted border border-border/70 overflow-hidden shrink-0 flex items-center justify-center">
                                    {rec.product.image_url ? (
                                      <img
                                        src={rec.product.image_url}
                                        alt={rec.product.name}
                                        className="size-full object-cover"
                                      />
                                    ) : (
                                      <Package className="size-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground truncate max-w-[200px]">
                                      {rec.product.name}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      {rec.product.unit || "portion"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 font-semibold">
                                <span
                                  className={
                                    Number(rec.product.stock || 0) >= rules.excessStock.stockThreshold
                                      ? "text-rose-600 dark:text-rose-400 font-bold"
                                      : "text-foreground"
                                  }
                                >
                                  {rec.product.stock ?? 0}
                                </span>
                              </td>

                              <td className="py-3 px-3 font-medium text-muted-foreground">
                                {formatINR(rec.currentPrice)}
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-extrabold text-foreground">
                                    {formatINR(rec.suggestedPrice)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${
                                      isDiscount
                                        ? "border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                                        : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                                    }`}
                                  >
                                    {isDiscount ? `-${pct}%` : `+${pct}%`}
                                  </Badge>
                                </div>
                              </td>

                              <td className="py-3 px-3 max-w-[320px]">
                                <p className="text-[11px] font-medium text-foreground leading-snug">
                                  {rec.ruleDescription}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  💡 {rec.marginProtectionText}
                                </p>
                              </td>

                              <td className="py-3 px-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApplySingle(rec)}
                                  disabled={applyPricingMutation.isPending}
                                  className="h-7 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                                >
                                  Apply
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sticky Floating Mobile Action Bar (< md screens) */}
        {recommendations.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border p-3 md:hidden shadow-lg flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="space-y-0.5 min-w-0">
              <div className="text-xs font-bold text-foreground">
                {selectedItems.size} of {recommendations.length} Selected
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                🛡️ ~{formatINR(totalMarginProtected)} Margin Protected
              </div>
            </div>

            <Button
              onClick={handleApplySelected}
              disabled={recommendations.length === 0 || applyPricingMutation.isPending}
              className="h-10 text-xs font-bold px-4 bg-primary text-primary-foreground rounded-2xl gap-1.5 shadow-sm shrink-0"
            >
              <Zap className="size-3.5" />
              <span>
                {applyPricingMutation.isPending
                  ? "Applying..."
                  : `Apply Selected (${selectedItems.size})`}
              </span>
            </Button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
