import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/push-offers")({
  head: () => ({
    meta: [
      { title: "Push Offers | Fish N Fresh Admin" },
      { name: "description", content: "Push combo deals and new arrivals as a timed pop-up in the shop." },
      { property: "og:title", content: "Push Offers | Fish N Fresh Admin" },
      { property: "og:description", content: "Timed pop-up offers for combos and new arrivals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PushOffersPage,
});

const KINDS = [
  { v: "combo", l: "🎁 Combo deal" },
  { v: "new_arrival", l: "✨ New arrival" },
  { v: "flash", l: "⚡ Flash deal" },
] as const;

function PushOffersPage() {
  const qc = useQueryClient();
  const empty = { kind: "combo", product_id: "", headline: "", subtext: "", badge: "", delay_seconds: "60" };
  const [f, setF] = useState(empty);

  const { data: products = [] } = useQuery({
    queryKey: ["push-offer-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,price,is_combo,image_url").order("name").limit(500);
      return data ?? [];
    },
  });
  const { data: offers = [] } = useQuery({
    queryKey: ["promo-popups-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promo_popups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["promo-popups-admin"] }); qc.invalidateQueries({ queryKey: ["active-promo-popup"] }); };

  const create = useMutation({
    mutationFn: async () => {
      if (!f.headline.trim()) throw new Error("Write a headline");
      const { error } = await supabase.from("promo_popups").insert({
        kind: f.kind, product_id: f.product_id || null, headline: f.headline.trim(),
        subtext: f.subtext.trim() || null, badge: f.badge.trim() || null,
        delay_seconds: Math.min(600, Math.max(5, Number(f.delay_seconds) || 60)), is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Offer saved — switch it on to push"); setF(empty); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (on) {
        const { error: e1 } = await supabase.from("promo_popups").update({ is_active: false }).neq("id", id).eq("is_active", true);
        if (e1) throw e1;
      }
      const { error } = await supabase.from("promo_popups").update({ is_active: on }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.on ? "Live — shoppers will see it" : "Offer paused"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("promo_popups").delete().eq("id", id); if (error) throw error; },
    onSuccess: refresh,
  });

  const pName = (id: string | null) => products.find((p) => p.id === id)?.name;

  return (
    <AdminShell title="Push Offers">
      <div className="mx-auto max-w-3xl space-y-6 p-4">
        <div className="rounded-3xl bg-gradient-to-br from-primary/15 to-accent/20 p-5">
          <h1 className="font-display text-2xl font-bold">Push Offers</h1>
          <p className="text-sm text-muted-foreground">Pick a combo or new arrival. It pops up for shoppers after they browse for the time you set — once per visit. Only one offer is live at a time.</p>
        </div>

        <div className="grid gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:grid-cols-2">
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {KINDS.map((k) => (
              <Button key={k.v} type="button" size="sm" variant={f.kind === k.v ? "default" : "outline"} className="rounded-full" onClick={() => setF({ ...f, kind: k.v })}>{k.l}</Button>
            ))}
          </div>
          <label className="space-y-1 text-sm sm:col-span-2">Product
            <select className="h-10 w-full rounded-md border bg-background px-2" value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
              <option value="">— No product (message only) —</option>
              {products.filter((p) => f.kind !== "combo" || p.is_combo).map((p) => <option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}
            </select>
            {f.kind === "combo" && !products.some((p) => p.is_combo) && <span className="text-xs text-muted-foreground">No combos yet — add one in Products and turn on “Combo pack”.</span>}
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">Headline<Input value={f.headline} placeholder="Weekend Family Combo — save ₹150" onChange={(e) => setF({ ...f, headline: e.target.value })} /></label>
          <label className="space-y-1 text-sm sm:col-span-2">Short message<Input value={f.subtext} placeholder="Fresh catch packed and ready today" onChange={(e) => setF({ ...f, subtext: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Badge text<Input value={f.badge} placeholder="Today only" onChange={(e) => setF({ ...f, badge: e.target.value })} /></label>
          <label className="space-y-1 text-sm">Show after (seconds)<Input type="number" value={f.delay_seconds} onChange={(e) => setF({ ...f, delay_seconds: e.target.value })} /></label>
          <Button className="sm:col-span-2" disabled={create.isPending} onClick={() => create.mutate()}>Save offer</Button>
        </div>

        <div className="space-y-3">
          {offers.length === 0 && <p className="text-center text-sm text-muted-foreground">No offers yet.</p>}
          {offers.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{o.headline}</p>
                <p className="truncate text-xs text-muted-foreground">{KINDS.find((k) => k.v === o.kind)?.l} · {pName(o.product_id) ?? "No product"} · after {o.delay_seconds}s</p>
              </div>
              <span className={`text-xs font-semibold ${o.is_active ? "text-primary" : "text-muted-foreground"}`}>{o.is_active ? "LIVE" : "Off"}</span>
              <Switch checked={o.is_active} onCheckedChange={(on) => toggle.mutate({ id: o.id, on })} />
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(o.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
