import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Copy,
  Percent,
  IndianRupee,
  Search,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Zap,
  Flame,
  Split,
  TrendingUp,
  Gift,
  Share2,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { SocialCampaignHub } from "@/components/admin/SocialCampaignHub";
import { adminPromotionsQuery, type PromotionRow } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions & Offers | Fish N Fresh Admin" },
      { name: "description", content: "Create and customize seafood discount codes, campaigns, and validity periods." },
    ],
  }),
  component: PromotionsAdmin,
});

type PromoFormData = {
  id?: string;
  name: string;
  code: string;
  discount_type: "percent" | "fixed";
  value: number;
  min_order: number;
  valid_from: string;
  valid_to: string;
  description: string;
  active: boolean;
};

const INITIAL_FORM: PromoFormData = {
  name: "",
  code: "",
  discount_type: "percent",
  value: 10,
  min_order: 0,
  valid_from: "",
  valid_to: "",
  description: "",
  active: true,
};

function PromotionsAdmin() {
  const qc = useQueryClient();
  const promos = useQuery(adminPromotionsQuery);
  const rows = promos.data ?? [];

  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<"coupons" | "campaigns" | "social">("coupons");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "scheduled" | "expired" | "paused">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PromoFormData>(INITIAL_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Marketing campaigns & A/B testing query
  const campaigns = useQuery({
    queryKey: ["admin", "marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        return [
          {
            id: "camp-1",
            name: "Sunday Morning Catch Rush",
            type: "flash_sale",
            banner_headline: "⚡ Harbour Catch Flash Deal: 15% Off Until 11:30 AM",
            banner_subtext: "Use code MORNING15 at checkout for freshly landed Seer Fish & Pomfret.",
            variant_a_code: "MORNING15",
            min_cart_value: 499,
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 4 * 3600000).toISOString(),
            is_active: true,
            impressions_a: 240,
            conversions_a: 38,
            impressions_b: 0,
            conversions_b: 0,
          },
          {
            id: "camp-2",
            name: "Free Cleaned Prawns Cart Trigger",
            type: "cart_rule",
            banner_headline: "🎁 Automatic Reward: Free Cleaned Prawn Pack on Orders ₹999+",
            banner_subtext: "Auto-adds to cart with zero coupon code required.",
            variant_a_code: "FREEPRAWN",
            min_cart_value: 999,
            is_active: true,
            impressions_a: 520,
            conversions_a: 84,
            impressions_b: 0,
            conversions_b: 0,
          },
          {
            id: "camp-3",
            name: "Flat ₹100 Off vs 15% Off Experiment",
            type: "ab_test",
            banner_headline: "A/B Conversion Test: Fixed Cash Discount vs Percentage Cut",
            banner_subtext: "Live conversion velocity between flat cash rebate and percentage discount.",
            variant_a_code: "FLAT100",
            variant_b_code: "SEAFOOD15",
            min_cart_value: 699,
            is_active: true,
            impressions_a: 350,
            conversions_a: 58,
            impressions_b: 365,
            conversions_b: 71,
          },
        ];
      }
      return data;
    },
  });

  const toggleCampaign = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign status updated");
      qc.invalidateQueries({ queryKey: ["admin", "marketing-campaigns"] });
    },
    onError: () => toast.error("Could not update campaign"),
  });

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    type: "flash_sale" as "flash_sale" | "cart_rule" | "ab_test",
    banner_headline: "",
    banner_subtext: "",
    variant_a_code: "",
    variant_b_code: "",
    min_cart_value: 499,
    discount_amount: 50,
    hours: 4,
  });

  const createCampaign = useMutation({
    mutationFn: async (payload: typeof campaignForm) => {
      const record = {
        name: payload.name.trim(),
        title: payload.name.trim(),
        type: payload.type,
        campaign_type: payload.type,
        banner_headline: payload.banner_headline.trim() || payload.name.trim(),
        banner_subtext: payload.banner_subtext.trim(),
        variant_a_code: payload.variant_a_code.trim().toUpperCase() || null,
        variant_b_code: payload.type === "ab_test" ? payload.variant_b_code.trim().toUpperCase() : null,
        min_cart_value: Number(payload.min_cart_value || 0),
        min_cart_amount: Number(payload.min_cart_value || 0),
        discount_amount: Number(payload.discount_amount || 0),
        starts_at: new Date().toISOString(),
        ends_at: payload.type === "flash_sale" ? new Date(Date.now() + payload.hours * 3600000).toISOString() : null,
        is_active: true,
        impressions_a: 0,
        conversions_a: 0,
        impressions_b: 0,
        conversions_b: 0,
      };

      const { error } = await supabase.from("marketing_campaigns").insert([record]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marketing Campaign launched successfully!");
      setCampaignDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "marketing-campaigns"] });
      setCampaignForm({
        name: "",
        type: "flash_sale",
        banner_headline: "",
        banner_subtext: "",
        variant_a_code: "",
        variant_b_code: "",
        min_cart_value: 499,
        discount_amount: 50,
        hours: 4,
      });
    },
    onError: (err: any) => {
      toast.error("Failed to launch campaign: " + (err.message || err));
    },
  });

  // Toggle quick active status
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promotions").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion status updated");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save (Create or Update) mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PromoFormData) => {
      const payload = {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase() || null,
        discount_type: data.discount_type,
        value: Number(data.value) || 0,
        min_order: Number(data.min_order) || 0,
        valid_from: data.valid_from ? new Date(data.valid_from).toISOString() : null,
        valid_to: data.valid_to ? new Date(data.valid_to).toISOString() : null,
        description: data.description.trim() || null,
        active: data.active,
        type: "discount",
      };

      if (data.id) {
        const { error } = await supabase.from("promotions").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promotions").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(formData.id ? "Promotion updated" : "Promotion created successfully");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      setDialogOpen(false);
      setFormData(INITIAL_FORM);
    },
    onError: (e: any) => {
      toast.error(`Failed to save promotion: ${e.message || "Unknown error"}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion deleted");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(`Failed to delete promotion: ${e.message || "Unknown error"}`);
    },
  });

  const openCreate = () => {
    setFormData(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: PromotionRow) => {
    setFormData({
      id: p.id,
      name: p.name,
      code: p.code || "",
      discount_type: p.discount_type === "percentage" ? "percent" : (p.discount_type as "percent" | "fixed") || "percent",
      value: Number(p.value),
      min_order: Number(p.min_order || 0),
      valid_from: p.valid_from ? p.valid_from.slice(0, 16) : "",
      valid_to: p.valid_to ? p.valid_to.slice(0, 16) : "",
      description: p.description || "",
      active: p.active,
    });
    setDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code ${code} copied!`);
  };

  // Determine promo validity state
  const getStatus = (p: PromotionRow) => {
    const now = new Date();
    if (!p.active) return "paused";
    if (p.valid_to && new Date(p.valid_to) < now) return "expired";
    if (p.valid_from && new Date(p.valid_from) > now) return "scheduled";
    return "active";
  };

  // Filtered rows
  const filtered = rows.filter((p) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    const status = getStatus(p);
    if (filterTab === "active") return status === "active";
    if (filterTab === "scheduled") return status === "scheduled";
    if (filterTab === "expired") return status === "expired";
    if (filterTab === "paused") return status === "paused";

    return true;
  });

  return (
    <AdminShell title="Promotions & Offers" allow={["admin", "manager"]}>
      {/* Top Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Manage coupons, discount percentages, automated flash sales, and A/B campaign experiments.
          </p>
        </div>
        {mainTab === "coupons" && (
          <Button onClick={openCreate} className="rounded-xl self-start sm:self-auto">
            <Plus className="mr-1.5 size-4" /> Create Coupon
          </Button>
        )}
      </div>

      {/* View Switcher: Coupons vs Automated Campaigns vs Social Media Hub */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button
          size="sm"
          variant={mainTab === "coupons" ? "default" : "outline"}
          onClick={() => setMainTab("coupons")}
          className="rounded-xl h-8 text-xs font-semibold"
        >
          <Tag className="mr-1.5 size-3.5" /> Discount Coupons ({rows.length})
        </Button>
        <Button
          size="sm"
          variant={mainTab === "campaigns" ? "default" : "outline"}
          onClick={() => setMainTab("campaigns")}
          className="rounded-xl h-8 text-xs font-semibold"
        >
          <Sparkles className="mr-1.5 size-3.5 text-amber-500" /> Automated Campaigns & A/B Testing ({(campaigns.data || []).length})
        </Button>
        <Button
          size="sm"
          variant={mainTab === "social" ? "default" : "outline"}
          onClick={() => setMainTab("social")}
          className="rounded-xl h-8 text-xs font-semibold"
        >
          <Share2 className="mr-1.5 size-3.5 text-sky-500" /> Social Media Hub (Omnichannel)
        </Button>
      </div>

      {mainTab === "coupons" && (
        <>
          {/* Filter and Search Bar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupon code or name..."
            className="pl-9 pr-8 rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "scheduled", "expired", "paused"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filterTab === tab ? "default" : "outline"}
              className="rounded-xl capitalize text-xs h-8"
              onClick={() => setFilterTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {/* Promotion Cards */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const status = getStatus(p);
          const isPercent = p.discount_type === "percent" || p.discount_type === "percentage";

          return (
            <Card key={p.id} className="transition hover:border-primary/40">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base text-foreground">{p.name}</span>

                    {p.code && (
                      <button
                        type="button"
                        onClick={() => copyCode(p.code!)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary hover:bg-primary/20 transition"
                        title="Click to copy code"
                      >
                        <Tag className="size-3" />
                        {p.code}
                        <Copy className="size-3 ml-0.5 opacity-60" />
                      </button>
                    )}

                    {status === "active" && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-[10px]">Active</Badge>
                    )}
                    {status === "scheduled" && (
                      <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px]">
                        Scheduled
                      </Badge>
                    )}
                    {status === "expired" && (
                      <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                    )}
                    {status === "paused" && (
                      <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {isPercent ? `${p.value}% OFF` : `${formatINR(p.value)} OFF`}
                    </span>
                    <span>•</span>
                    <span>Min order: {formatINR(p.min_order)}</span>
                    {p.description && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-xs">{p.description}</span>
                      </>
                    )}
                  </div>

                  {/* Validity Period */}
                  {(p.valid_from || p.valid_to) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="size-3 text-primary" />
                      <span>
                        {p.valid_from ? `From: ${formatIST(p.valid_from)}` : "Starts: Immediately"}
                      </span>
                      <span>—</span>
                      <span>
                        {p.valid_to ? `Expires: ${formatIST(p.valid_to)}` : "No expiration"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div className="flex items-center gap-2">
                    {p.active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                        ● Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[10px] font-medium px-2 py-0.5">
                        ○ Paused
                      </Badge>
                    )}
                    <Switch
                      checked={p.active}
                      onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                      disabled={toggle.isPending}
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Edit2 className="size-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-xl px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No promotions found matching your filter.
          </div>
        )}
      </div>
    </>
  )}

  {mainTab === "campaigns" && (
        /* Automated Campaigns & A/B Testing View */
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/30 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                <Flame className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Active Growth Tooling & Conversion Experiments</h3>
                <p className="text-xs text-muted-foreground">
                  Automate flash catch drops, minimum-basket reward rules, and split-test promotional discounts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                Autonomous Growth Engine Active
              </Badge>
              <Button
                size="sm"
                className="rounded-xl h-8 text-xs font-semibold gap-1.5 shadow-xs"
                onClick={() => setCampaignDialogOpen(true)}
              >
                <Plus className="size-3.5" /> Launch Campaign
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {(campaigns.data || []).map((camp: any) => {
              const isAb = camp.type === "ab_test";
              const isFlash = camp.type === "flash_sale";
              const isCartRule = camp.type === "cart_rule";

              const rateA =
                camp.impressions_a > 0
                  ? Math.round((camp.conversions_a / camp.impressions_a) * 1000) / 10
                  : 0;
              const rateB =
                camp.impressions_b > 0
                  ? Math.round((camp.conversions_b / camp.impressions_b) * 1000) / 10
                  : 0;
              const winner = isAb ? (rateB > rateA ? "B" : "A") : null;

              return (
                <Card key={camp.id} className="border-border/80 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                            isFlash
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : isCartRule
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
                          }`}
                        >
                          {isFlash && <Zap className="size-3" />}
                          {isCartRule && <Gift className="size-3" />}
                          {isAb && <Split className="size-3" />}
                          {isFlash ? "Flash Catch Deal" : isCartRule ? "Auto Cart Rule" : "A/B Promotional Test"}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">{camp.name}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {camp.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                            ● Running Live
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[10px] font-medium px-2 py-0.5">
                            ○ Paused
                          </Badge>
                        )}
                        <Switch
                          id={`camp-switch-${camp.id}`}
                          checked={camp.is_active}
                          onCheckedChange={(active) =>
                            toggleCampaign.mutate({ id: camp.id, is_active: active })
                          }
                          disabled={toggleCampaign.isPending}
                        />
                      </div>
                    </div>

                    {/* Banner Headline Preview */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          {camp.banner_headline}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">{camp.banner_subtext}</div>
                      </div>
                      {isFlash && camp.ends_at && (
                        <div className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-center border border-amber-500/30">
                          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                            Ends In
                          </span>
                          <span className="font-mono text-xs font-extrabold text-foreground">
                            ~3h 45m
                          </span>
                        </div>
                      )}
                    </div>

                    {/* A/B Test Results Split Comparison */}
                    {isAb ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Variant A */}
                        <div
                          className={`rounded-xl border p-3 bg-muted/20 space-y-2 ${
                            winner === "A" ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-border/70"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1">
                              Variant A ({camp.variant_a_code})
                              {winner === "A" && (
                                <Badge className="bg-emerald-600 text-[9px] py-0 px-1">Winner ⭐</Badge>
                              )}
                            </span>
                            <span className="font-mono text-sm font-extrabold text-primary">{rateA}% CVR</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, rateA * 4)}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>{camp.impressions_a} Shoppers Seen</span>
                            <span className="font-semibold text-foreground">{camp.conversions_a} Orders Placed</span>
                          </div>
                        </div>

                        {/* Variant B */}
                        <div
                          className={`rounded-xl border p-3 bg-muted/20 space-y-2 ${
                            winner === "B" ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-border/70"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1">
                              Variant B ({camp.variant_b_code})
                              {winner === "B" && (
                                <Badge className="bg-emerald-600 text-[9px] py-0 px-1">Winner ⭐</Badge>
                              )}
                            </span>
                            <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{rateB}% CVR</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, rateB * 4)}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>{camp.impressions_b} Shoppers Seen</span>
                            <span className="font-semibold text-foreground">{camp.conversions_b} Orders Placed</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>Min Cart Trigger: <strong>{formatINR(camp.min_cart_value || 0)}</strong></span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {camp.conversions_a} conversions recorded
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {mainTab === "social" && (
        <SocialCampaignHub />
      )}

      {/* Create / Edit Promotion Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Edit Promotion" : "Create New Promotion"}</DialogTitle>
            <DialogDescription>
              Configure discount percentage or flat amount, validity dates, and min orders.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formData.name.trim()) {
                toast.error("Promotion name is required");
                return;
              }
              if (formData.value <= 0) {
                toast.error("Discount value must be greater than 0");
                return;
              }
              saveMutation.mutate(formData);
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs">Promotion Name *</Label>
              <Input
                placeholder="e.g. Weekend Catch 20% Off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Coupon Code (Optional)</Label>
                <Input
                  placeholder="e.g. FRESH20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-1 rounded-xl uppercase font-mono"
                />
              </div>

              <div>
                <Label className="text-xs">Discount Type</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(v: "percent" | "fixed") => setFormData({ ...formData, discount_type: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Flat Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  Discount Value ({formData.discount_type === "percent" ? "%" : "₹"}) *
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={formData.discount_type === "percent" ? "100" : undefined}
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="mt-1 rounded-xl"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Minimum Order Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.min_order}
                  onChange={(e) => setFormData({ ...formData, min_order: Number(e.target.value) })}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            {/* Date Periods */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="size-3 text-primary" /> Valid From
                </Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="size-3 text-primary" /> Valid To (Expiry)
                </Label>
                <Input
                  type="datetime-local"
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description / Terms</Label>
              <Textarea
                placeholder="Optional customer-facing description or terms..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 rounded-xl resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold">Enable Promotion Now</p>
                <p className="text-[11px] text-muted-foreground">Active promotions can be applied at checkout.</p>
              </div>
              <div className="flex items-center gap-2">
                {formData.active ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                    ● Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[10px] font-medium px-2 py-0.5">
                    ○ Inactive
                  </Badge>
                )}
                <Switch
                  checked={formData.active}
                  onCheckedChange={(active) => setFormData({ ...formData, active })}
                />
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : formData.id ? "Update Offer" : "Create Offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this offer? Any checkout with this code will no longer receive a discount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Launch Marketing Campaign Dialog */}
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Flame className="size-5 text-amber-500" /> Launch Growth Campaign
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure flash sales, automated basket reward rules, or A/B split conversion experiments.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!campaignForm.name.trim()) {
                toast.error("Please enter a campaign name");
                return;
              }
              createCampaign.mutate(campaignForm);
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <Label className="text-xs">Campaign Format</Label>
              <Select
                value={campaignForm.type}
                onValueChange={(val: any) => setCampaignForm({ ...campaignForm, type: val })}
              >
                <SelectTrigger className="mt-1 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="flash_sale">⚡ Flash Deal (Countdown + Top Bar)</SelectItem>
                  <SelectItem value="cart_rule">🎁 Auto Cart Reward (Zero Code Required)</SelectItem>
                  <SelectItem value="ab_test">⚖️ A/B Promotional Split Test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input
                placeholder="e.g. Sunday Morning Catch Rush"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                className="mt-1 rounded-xl text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs">Top Bar Banner Headline</Label>
              <Input
                placeholder="e.g. ⚡ Harbour Fresh Flash Deal: 15% Off Until 11:30 AM"
                value={campaignForm.banner_headline}
                onChange={(e) => setCampaignForm({ ...campaignForm, banner_headline: e.target.value })}
                className="mt-1 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Subtext / Instructions</Label>
              <Input
                placeholder="e.g. Use code MORNING15 at checkout for freshly landed Seer Fish."
                value={campaignForm.banner_subtext}
                onChange={(e) => setCampaignForm({ ...campaignForm, banner_subtext: e.target.value })}
                className="mt-1 rounded-xl text-xs"
              />
            </div>

            {campaignForm.type === "ab_test" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Variant A Promo Code</Label>
                  <Input
                    placeholder="e.g. FLAT100"
                    value={campaignForm.variant_a_code}
                    onChange={(e) => setCampaignForm({ ...campaignForm, variant_a_code: e.target.value.toUpperCase() })}
                    className="mt-1 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Variant B Promo Code</Label>
                  <Input
                    placeholder="e.g. SEAFOOD15"
                    value={campaignForm.variant_b_code}
                    onChange={(e) => setCampaignForm({ ...campaignForm, variant_b_code: e.target.value.toUpperCase() })}
                    className="mt-1 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    {campaignForm.type === "cart_rule" ? "Optional Promo Code" : "Flash Coupon Code"}
                  </Label>
                  <Input
                    placeholder={campaignForm.type === "cart_rule" ? "None (Auto Applied)" : "e.g. FLASH20"}
                    value={campaignForm.variant_a_code}
                    onChange={(e) => setCampaignForm({ ...campaignForm, variant_a_code: e.target.value.toUpperCase() })}
                    className="mt-1 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Minimum Spend (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={campaignForm.min_cart_value}
                    onChange={(e) => setCampaignForm({ ...campaignForm, min_cart_value: Number(e.target.value) })}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {campaignForm.type === "cart_rule" && (
              <div>
                <Label className="text-xs">Automatic Reward Discount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  value={campaignForm.discount_amount}
                  onChange={(e) => setCampaignForm({ ...campaignForm, discount_amount: Number(e.target.value) })}
                  className="mt-1 rounded-xl text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Orders exceeding ₹{campaignForm.min_cart_value} will automatically receive this flat deduction.
                </p>
              </div>
            )}

            {campaignForm.type === "flash_sale" && (
              <div>
                <Label className="text-xs">Flash Sale Duration (Hours)</Label>
                <Input
                  type="number"
                  min="1"
                  max="48"
                  value={campaignForm.hours}
                  onChange={(e) => setCampaignForm({ ...campaignForm, hours: Number(e.target.value) })}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            )}

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={() => setCampaignDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl text-xs font-semibold"
                disabled={createCampaign.isPending}
              >
                {createCampaign.isPending ? "Launching..." : "Launch Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
