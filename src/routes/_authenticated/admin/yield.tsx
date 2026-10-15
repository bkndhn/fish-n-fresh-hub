import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { calcYield, YIELD_PRESETS } from "@/lib/yieldCalc";

export const Route = createFileRoute("/_authenticated/admin/yield")({
  head: () => ({
    meta: [
      { title: "Yield & Cutting Loss | Fish N Fresh Admin" },
      { name: "description", content: "Find true cost per cleaned kg after cutting loss and spot margin leaks." },
      { property: "og:title", content: "Yield & Cutting Loss | Fish N Fresh Admin" },
      { property: "og:description", content: "Find true cost per cleaned kg after cutting loss and spot margin leaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YieldPage,
});

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function YieldPage() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [rawKg, setRawKg] = useState("");
  const [cost, setCost] = useState("");
  const [cleanKg, setCleanKg] = useState("");
  const [byp, setByp] = useState("");
  const [notes, setNotes] = useState("");
  const [updateCost, setUpdateCost] = useState(true);
  const [logWaste, setLogWaste] = useState(true);

  const { data: products = [] } = useQuery({
    queryKey: ["yield-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,price,cost_price,unit").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["yield-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("yield_cutting_logs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const product = products.find((p) => p.id === productId);
  const result = useMemo(
    () => calcYield({ rawKg: +rawKg, costPerKg: +cost, cleanedKg: +cleanKg, byproductRevenue: +byp || 0, sellingPrice: Number(product?.price ?? 0) }),
    [rawKg, cost, cleanKg, byp, product],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!product || !result) throw new Error("Pick a product and enter valid weights");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("yield_cutting_logs").insert({
        product_id: product.id, product_name: product.name,
        raw_weight_kg: +rawKg, purchase_cost_per_kg: +cost, total_raw_cost: result.totalRawCost,
        cleaned_weight_kg: +cleanKg, byproduct_revenue: +byp || 0, cutting_loss_pct: result.lossPct,
        true_cost_per_kg: result.trueCostPerKg, current_selling_price: Number(product.price ?? 0),
        realized_margin_pct: result.marginPct, notes: notes || null,
      });
      if (error) throw error;
      if (updateCost) {
        const { error: e2 } = await supabase.from("products").update({ cost_price: result.trueCostPerKg }).eq("id", product.id);
        if (e2) toast.error("Saved, but cost price not updated: " + e2.message);
      }
      if (logWaste && result.wasteKg > 0) {
        const { error: e3 } = await supabase.from("waste_entries").insert({
          entry_number: `YLD-${Date.now().toString().slice(-8)}`, product_id: product.id, product_name: product.name,
          quantity: result.wasteKg, unit: "kg", reason: "cleaning_gutting_loss", action_taken: "discarded",
          cost_loss: Math.round(result.wasteKg * +cost * 100) / 100, logged_by: u.user?.email ?? "admin",
        });
        if (e3) toast.error("Saved, but wastage not logged: " + e3.message);
      }
    },
    onSuccess: () => {
      toast.success("Yield saved");
      setRawKg(""); setCleanKg(""); setByp(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["yield-logs"] });
      qc.invalidateQueries({ queryKey: ["yield-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold">Yield & Cutting Loss</h1>
          <p className="text-sm text-muted-foreground">Enter raw weight bought and cleaned weight after cutting to see your real cost per kg.</p>
        </div>

        <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">Product
            <select className="h-10 w-full rounded-md border bg-background px-2" value={productId}
              onChange={(e) => { setProductId(e.target.value); const p = products.find((x) => x.id === e.target.value); if (p?.cost_price && !cost) setCost(String(p.cost_price)); }}>
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} — sells {inr(Number(p.price))}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">Raw weight bought (kg)<Input type="number" inputMode="decimal" value={rawKg} onChange={(e) => setRawKg(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Purchase rate (₹/kg)<Input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Cleaned sellable weight (kg)<Input type="number" inputMode="decimal" value={cleanKg} onChange={(e) => setCleanKg(e.target.value)} /></label>
          <label className="space-y-1 text-sm">Byproduct sales, optional (₹)<Input type="number" inputMode="decimal" value={byp} onChange={(e) => setByp(e.target.value)} /></label>
          <div className="md:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">Typical yield (fills cleaned weight from raw weight):</p>
            <div className="flex flex-wrap gap-2">
              {YIELD_PRESETS.map((p) => (
                <Button key={p.label} type="button" size="sm" variant="outline" disabled={!(+rawKg > 0)}
                  onClick={() => setCleanKg(((+rawKg * p.yieldPct) / 100).toFixed(2))}>{p.label} {p.yieldPct}%</Button>
              ))}
            </div>
          </div>
          <label className="space-y-1 text-sm md:col-span-2">Notes<Input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>

        {result ? (
          <div className={`grid grid-cols-2 gap-3 rounded-xl border p-4 md:grid-cols-4 ${result.sellingAtLoss ? "border-destructive bg-destructive/10" : "bg-card"}`}>
            <Stat label="Cutting loss" value={`${result.lossPct}% (${result.wasteKg} kg)`} />
            <Stat label="True cost / kg" value={inr(result.trueCostPerKg)} />
            <Stat label="Margin / kg" value={product ? inr(result.marginPerKg) : "—"} />
            <Stat label="Margin %" value={product ? `${result.marginPct}%` : "—"} />
            {result.sellingAtLoss && <p className="col-span-full font-semibold text-destructive">Selling below true cost — raise price above {inr(result.trueCostPerKg)}/kg.</p>}
          </div>
        ) : (rawKg && cleanKg) ? <p className="text-sm text-destructive">Cleaned weight must be more than 0 and not above raw weight.</p> : null}

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />Update product cost to true cost</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={logWaste} onChange={(e) => setLogWaste(e.target.checked)} />Log cutting waste in wastage</label>
          <Button onClick={() => save.mutate()} disabled={!result || !product || save.isPending}>{save.isPending ? "Saving…" : "Save yield"}</Button>
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold">Recent yields</h2>
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No yields logged yet.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
              <div>
                <p className="font-medium">{l.product_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("en-IN")} · {Number(l.raw_weight_kg)} kg → {Number(l.cleaned_weight_kg)} kg</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Loss {Number(l.cutting_loss_pct)}%</Badge>
                <Badge variant="outline">Cost {inr(Number(l.true_cost_per_kg))}/kg</Badge>
                <Badge variant={Number(l.realized_margin_pct) < 0 ? "destructive" : "secondary"}>Margin {Number(l.realized_margin_pct)}%</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}
