import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Anchor, Bell, Compass, Send, Trash2, CheckCircle2, Clock, Sparkles, Radio } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatIST } from "@/lib/format";
import { triggerLocalNotification } from "@/lib/fcm";
import type { CatchBroadcast } from "@/lib/types";

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
            <Badge className="bg-sky-600 hover:bg-sky-700 text-white font-mono text-xs px-3 py-1 gap-1.5 self-start sm:self-auto">
              <Radio className="size-3 animate-pulse" /> Live Broadcast Active
            </Badge>
          </div>
        </div>

        {/* Compose New Broadcast Card */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base sm:text-lg flex items-center gap-2">
              <Send className="size-4 text-primary" /> Dispatch New Harbour Announcement
            </h2>
            <span className="text-xs text-muted-foreground">1-Click customer push</span>
          </div>

          {/* Quick Presets */}
          <div>
            <Label className="text-xs text-muted-foreground">Quick Harbor Landing Presets:</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((tpl, i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs h-8 border-dashed hover:border-primary hover:text-primary"
                  onClick={() => applyTemplate(tpl)}
                >
                  <Sparkles className="mr-1 size-3 text-sky-500" />
                  {tpl.harbour.split(",")[0]} Catch
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-title" className="text-xs font-semibold">Alert Title *</Label>
              <Input
                id="broadcast-title"
                placeholder="e.g. 🌅 Kasimedu 06:30 AM Boat Landed! Live Catch Ready"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="harbour-source" className="text-xs font-semibold">Harbour Source *</Label>
              <Input
                id="harbour-source"
                placeholder="e.g. Kasimedu Harbour, Chennai"
                value={harbour}
                onChange={(e) => setHarbour(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-msg" className="text-xs font-semibold">Alert Message & Highlights *</Label>
            <Textarea
              id="broadcast-msg"
              rows={3}
              placeholder="Detail the fresh species landed, special prices, or cut recommendations..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold gap-2 shadow-xs"
              disabled={sendBroadcast.isPending || !title || !message}
              onClick={() => sendBroadcast.mutate()}
            >
              <Send className="size-4" />
              {sendBroadcast.isPending ? "Broadcasting..." : "Send Live Alert to Store & Customers"}
            </Button>
          </div>
        </div>

        {/* Past Broadcast History */}
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-base flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" /> Past Harbour Broadcasts ({broadcasts.length})
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
                      className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => deleteBroadcast.mutate(b.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
