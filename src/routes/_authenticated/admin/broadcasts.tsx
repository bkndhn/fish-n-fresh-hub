import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Anchor,
  Bell,
  Compass,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Radio,
  Zap,
  Play,
  Mail,
  Users,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatIST } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import { triggerLocalNotification } from "@/lib/fcm";
import {
  DRIP_SEQUENCES,
  getDripEvaluationSummary,
  dispatchDripCycle,
  type DripEvaluationSummary,
} from "@/lib/marketingDrips.server";
import type { CatchBroadcast } from "@/lib/types";
import type { SiteSettings } from '@/lib/types';

export const Route = createFileRoute("/_authenticated/admin/broadcasts")({
  head: () => ({
    meta: [
      { title: "Morning Catch Alerts | Fish N Fresh Admin" },
      { name: "description", content: "Broadcast daily morning harbour boat catches and instant alerts to customers." },
    ],
  }),
  component: AdminBroadcastsPage,
});

const QUICK_TEMPLATES = [
  {
    title: "🌅 Kasimedu 06:30 AM Boat Landed! Live Catch Available",
    harbour: "Kasimedu Harbour, Chennai",
    message: "Fresh Vanjaram (Seer Fish), White Prawns, and Red Snapper just unloaded at the dock! Cleaned, chemical-free and packed on ice.",
  },
  {
    title: "⚓ Afternoon 02:00 PM Boat Docked — Blue Crabs & Squid",
    harbour: "Kasimedu Dock 2, Chennai",
    message: "Live sea crabs, squids and fresh pomfret landed in the afternoon boat! Ideal for evening dinner delivery.",
  },
  {
    title: "🦐 Rare Tiger Prawns & Deep-Sea Lobster Alert",
    harbour: "Cuddalore Deep Sea Harbour",
    message: "Limited 35kg catch of Jumbo Tiger Prawns arrived this morning. First-come-first-served, order before stocks run out!",
  },
];

function AdminBroadcastsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [harbour, setHarbour] = useState("Kasimedu Harbour, Chennai");
  const [message, setMessage] = useState("");
  const [targetCategory, setTargetCategory] = useState("");

  const [activeTab, setActiveTab] = useState<"broadcasts" | "drips">("broadcasts");
  const [activeDripToggles, setActiveDripToggles] = useState<Record<string, boolean>>({
    winback_7d: true,
    review_48h: true,
    abandoned_cart_2h: true,
    friday_feast: true,
    welcome_first: true,
  });
  const [dispatchingDrip, setDispatchingDrip] = useState<string | null>(null);

  const { data: dripSummaries = [], refetch: refetchDrips } = useQuery({
    queryKey: ["admin", "drip-evaluations"],
    queryFn: async () => {
      try {
        const res = await getDripEvaluationSummary();
        return res || [];
      } catch {
        return [];
      }
    },
  });

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ["admin-catch-broadcasts"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("catch_broadcasts")
          .select("*")
          .order("sent_at", { ascending: false });

        if (error) throw error;
        return (data as unknown as CatchBroadcast[]) || [];
      } catch (err) {
        console.warn("Could not fetch catch broadcasts:", err);
        return [];
      }
    },
  });

  const sendBroadcast = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) {
        throw new Error("Please enter broadcast title and message");
      }

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id || null;

      // 1. Insert into database
      const { data, error } = await supabase
        .from("catch_broadcasts")
        .insert({
          title: title.trim(),
          harbour_source: harbour.trim() || "Kasimedu Harbour, Chennai",
          message: message.trim(),
          target_category: targetCategory.trim() || null,
          is_active: true,
          sent_by: userId,
        })
        .select("*")
        .single();

      if (error) throw error;

      // 2. Trigger browser push alert to subscribed devices
      triggerLocalNotification(title.trim(), {
        body: `${harbour}: ${message.trim()}`,
        url: "/catalog",
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
      qc.invalidateQueries({ queryKey: ["latest-catch-broadcast"] });
      toast.success("🌅 Harbour Catch Broadcast sent successfully!");
      setTitle("");
      setMessage("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to dispatch broadcast");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("catch_broadcasts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
      qc.invalidateQueries({ queryKey: ["latest-catch-broadcast"] });
      toast.success("Broadcast visibility updated");
    },
  });

  const deleteBroadcast = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catch_broadcasts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
      qc.invalidateQueries({ queryKey: ["latest-catch-broadcast"] });
      toast.success("Broadcast deleted");
    },
  });

  const [editingBroadcast, setEditingBroadcast] = useState<CatchBroadcast | null>(null);

  const updateBroadcast = useMutation({
    mutationFn: async (updated: CatchBroadcast) => {
      const { error } = await supabase
        .from("catch_broadcasts")
        .update({
          title: updated.title.trim(),
          harbour_source: updated.harbour_source.trim(),
          message: updated.message.trim(),
          target_category: updated.target_category || null,
          is_active: updated.is_active,
        })
        .eq("id", updated.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
      qc.invalidateQueries({ queryKey: ["latest-catch-broadcast"] });
      toast.success("Catch broadcast updated successfully!");
      setEditingBroadcast(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update broadcast");
    },
  });

  const { data: settings } = useQuery(settingsQuery);

  const toggleMasterAlerts = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("store_settings")
        .update({ live_alerts_enabled: enabled })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: ["store_settings"] });
      const previous = qc.getQueryData(["store_settings"]);
      qc.setQueryData(["store_settings"], (old: any) =>
        old ? { ...old, live_alerts_enabled: enabled } : old
      );
      return { previous };
    },
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["store_settings"] });
      toast.success(enabled ? "Storefront Harbour Catch Alert Banner enabled" : "Storefront Harbour Catch Alert Banner disabled");
    },
    onError: (err: any, _, context: any) => {
      if (context?.previous) {
        qc.setQueryData(["store_settings"], context.previous);
      }
      toast.error(err.message || "Failed to update banner setting");
    },
  });

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setTitle(tpl.title);
    setHarbour(tpl.harbour);
    setMessage(tpl.message);
  };

  return (
    <AdminShell title="Morning Catch Alerts" allow={["admin", "manager", "inventory_manager", "staff"]}>
      <div className="space-y-6">
        {/* Header Hero */}
        <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-background to-teal-500/10 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Anchor className="size-6 text-sky-600 dark:text-sky-400" />
                Harbour Morning Catch Alerts & Push Broadcast
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Broadcast boat arrivals directly from Kasimedu & coastal docks to customer mobile devices and storefront announcement banner.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto bg-background/80 backdrop-blur-xs border border-border/80 rounded-2xl px-3.5 py-2 shadow-2xs">
              <div className="text-right">
                <p className="text-xs font-bold leading-tight text-foreground">
                  {(settings as SiteSettings)?.live_alerts_enabled !== false ? "Store Banner Active" : "Store Banner Muted"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(settings as SiteSettings)?.live_alerts_enabled !== false ? "Shown on top of store" : "Hidden from customers"}
                </p>
              </div>
              <Switch
                checked={(settings as SiteSettings)?.live_alerts_enabled !== false}
                onCheckedChange={(val) => toggleMasterAlerts.mutate(val)}
                disabled={toggleMasterAlerts.isPending}
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full min-w-0 max-w-full space-y-4">
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar touch-pan-x pb-0.5">
            <TabsList className="rounded-2xl p-1 bg-muted/60 flex-nowrap w-max">
              <TabsTrigger value="broadcasts" className="rounded-xl text-xs font-bold gap-1.5 whitespace-nowrap shrink-0">
                <Radio className="size-3.5 text-sky-600 shrink-0" /> Harbour Morning Alerts
              </TabsTrigger>
              <TabsTrigger value="drips" className="rounded-xl text-xs font-bold gap-1.5 whitespace-nowrap shrink-0">
                <Zap className="size-3.5 text-amber-500 shrink-0" /> Automated Marketing Drips
                <span className="ml-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-extrabold">
                  5 Sequences
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="broadcasts" className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-base sm:text-lg flex items-center gap-2">
                  <Send className="size-4 text-primary" /> Dispatch New Harbour Announcement
                </h2>
                <span className="text-xs text-muted-foreground">1-Click customer push</span>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Quick Harbour Templates:</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((tpl, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs h-8 border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left font-normal gap-1.5"
                      onClick={() => applyTemplate(tpl)}
                    >
                      <Sparkles className="size-3 text-sky-500" />
                      <span className="truncate max-w-[200px] sm:max-w-[280px]">{tpl.title}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs font-bold">Broadcast Headline / Boat Notice</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Kasimedu 06:30 AM Boat Landed — Vanjaram Steaks Available"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="harbour" className="text-xs font-bold">Harbour / Dock Source</Label>
                  <Input
                    id="harbour"
                    placeholder="e.g. Kasimedu Harbour, Chennai"
                    value={harbour}
                    onChange={(e) => setHarbour(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-xs font-bold">Customer Notice Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe the freshly unloaded catch, cutting options, and delivery timeslots..."
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Bell className="size-3.5 text-primary" />
                  <span>Will trigger in-app banner and browser push notifications to subscribed customers.</span>
                </div>
                <Button
                  className="rounded-xl font-bold gap-2 px-6 self-end sm:self-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  disabled={sendBroadcast.isPending || !title.trim() || !message.trim()}
                  onClick={() => sendBroadcast.mutate()}
                >
                  {sendBroadcast.isPending ? "Broadcasting..." : <><Send className="size-4" /> Broadcast Catch Now</>}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-display font-semibold text-base flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" /> Harbour Broadcast History
              </h2>

              {isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading broadcasts...</p>
              ) : broadcasts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                  No previous catch broadcasts sent yet. Dispatch your first morning boat update above!
                </div>
              ) : (
                <div className="grid gap-3">
                  {broadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{b.title}</span>
                          <Badge variant="outline" className="text-[10px] font-mono border-sky-500/40 text-sky-600 dark:text-sky-400 gap-1">
                            <Compass className="size-2.5" /> {b.harbour_source}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{formatIST(b.sent_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{b.message}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Banner Live:</span>
                          <Switch
                            checked={b.is_active}
                            onCheckedChange={(val) => toggleActive.mutate({ id: b.id, is_active: val })}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                          onClick={() => setEditingBroadcast({ ...b })}
                          title="Edit broadcast"
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          onClick={() => deleteBroadcast.mutate(b.id)}
                          title="Delete broadcast"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="drips" className="space-y-6">
            <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
                    <Zap className="size-5 text-amber-500" />
                    Automated Retention Drips &amp; Abandoned Cart Triggers
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Intelligent background re-engagement rules that convert one-time seafood buyers into weekly repeat customers.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl font-bold text-xs h-9 bg-amber-600 hover:bg-amber-500 text-white gap-1.5 shadow-sm"
                  disabled={Boolean(dispatchingDrip)}
                  onClick={async () => {
                    try {
                      setDispatchingDrip("all");
                      for (const seq of DRIP_SEQUENCES) {
                        if (activeDripToggles[seq.id]) {
                          await dispatchDripCycle({ data: { sequenceId: seq.id, isDryRun: false } });
                        }
                      }
                      toast.success("All active marketing drip cycles executed successfully!");
                      qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
                    } catch (e: any) {
                      toast.error(e.message || "Failed to dispatch drips");
                    } finally {
                      setDispatchingDrip(null);
                    }
                  }}
                >
                  <Play className="size-3.5" />
                  {dispatchingDrip === "all" ? "Executing Sequences..." : "Run Active Drips Now"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DRIP_SEQUENCES.map((seq) => {
                const summary = dripSummaries.find((s) => s.sequenceId === seq.id);
                const isEnabled = activeDripToggles[seq.id] ?? true;
                const isRunning = dispatchingDrip === seq.id;

                return (
                  <div
                    key={seq.id}
                    className={`rounded-2xl border p-4 bg-card shadow-xs space-y-3 transition-all ${
                      isEnabled ? "border-border/80" : "border-border/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{seq.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400">
                            {seq.delayText}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{seq.triggerDescription}</p>
                      </div>

                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(val) =>
                          setActiveDripToggles((prev) => ({ ...prev, [seq.id]: val }))
                        }
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-1 font-mono">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Coupon Attached:</span>
                        <strong className="text-primary font-mono">{seq.defaultPromoCode}</strong>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Offer Value:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{seq.discountSummary}</strong>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Eligible Audience:</span>
                        <strong className="text-foreground">{summary?.eligibleCount ?? 0} customers</strong>
                      </div>
                    </div>

                    {summary?.sampleAudience && summary.sampleAudience.length > 0 && (
                      <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
                        <Users className="size-3 text-muted-foreground" />
                        <span>Sample Targets:</span>
                        {summary.sampleAudience.slice(0, 2).map((a, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-muted/60 text-foreground font-medium">
                            {a.name} ({a.phoneOrEmail})
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Mail className="size-3" /> Email + Browser Push
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-7 text-xs font-semibold gap-1"
                        disabled={isRunning || !isEnabled}
                        onClick={async () => {
                          try {
                            setDispatchingDrip(seq.id);
                            const res = await dispatchDripCycle({ data: { sequenceId: seq.id, isDryRun: false } });
                            toast.success(`Drip "${seq.name}" triggered for ${res.dispatchedCount} customers!`);
                            refetchDrips();
                            qc.invalidateQueries({ queryKey: ["admin-catch-broadcasts"] });
                          } catch (err: any) {
                            toast.error(err.message || "Dispatch failed");
                          } finally {
                            setDispatchingDrip(null);
                          }
                        }}
                      >
                        <Send className="size-3 text-primary" />
                        {isRunning ? "Sending..." : "Dispatch Now"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Broadcast Dialog */}
        <Dialog open={Boolean(editingBroadcast)} onOpenChange={(open) => !open && setEditingBroadcast(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="size-4 text-sky-500" />
                Edit Harbour Catch Alert
              </DialogTitle>
            </DialogHeader>

            {editingBroadcast && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateBroadcast.mutate(editingBroadcast);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title">Alert Title</Label>
                  <Input
                    id="edit-title"
                    value={editingBroadcast.title}
                    onChange={(e) => setEditingBroadcast({ ...editingBroadcast, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-harbour">Harbour Source / Dock</Label>
                  <Input
                    id="edit-harbour"
                    value={editingBroadcast.harbour_source}
                    onChange={(e) => setEditingBroadcast({ ...editingBroadcast, harbour_source: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-category">Target Category (Optional)</Label>
                  <Input
                    id="edit-category"
                    value={editingBroadcast.target_category || ""}
                    onChange={(e) => setEditingBroadcast({ ...editingBroadcast, target_category: e.target.value })}
                    placeholder="e.g. Sea Fish, Crabs, Prawns"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-msg">Broadcast Message</Label>
                  <Textarea
                    id="edit-msg"
                    rows={3}
                    value={editingBroadcast.message}
                    onChange={(e) => setEditingBroadcast({ ...editingBroadcast, message: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-muted/50 border border-border">
                  <Label htmlFor="edit-active" className="text-xs cursor-pointer">
                    Live Announcement Banner
                  </Label>
                  <Switch
                    id="edit-active"
                    checked={editingBroadcast.is_active}
                    onCheckedChange={(checked) => setEditingBroadcast({ ...editingBroadcast, is_active: checked })}
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingBroadcast(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold"
                    disabled={updateBroadcast.isPending}
                  >
                    {updateBroadcast.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
