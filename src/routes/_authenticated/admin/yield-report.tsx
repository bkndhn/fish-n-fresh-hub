import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { buildYieldReport, groupByCategory } from "@/lib/yieldReport";

export const Route = createFileRoute("/_authenticated/admin/yield-report")({
  head: () => ({
    meta: [
      { title: "Yield Margin Report | Fish N Fresh Admin" },
      { name: "description", content: "Nominal purchase price vs true cleaned cost and margin loss per product and category." },
      { property: "og:title", content: "Yield Margin Report | Fish N Fresh Admin" },
      { property: "og:description", content: "Nominal purchase price vs true cleaned cost and margin loss per product and category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YieldReportPage,
});

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function YieldReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["yield-report"],
    queryFn: async () => {
      const [logs, prods] = await Promise.all([
        supabase.from("yield_cutting_logs").select("product_id,product_name,purchase_cost_per_kg,true_cost_per_kg,cutting_loss_pct,batch_ref,delivery_date,created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("products").select("id,name,price,category"),
      ]);
      if (logs.error) throw logs.error;
      if (prods.error) throw prods.error;
      return { logs: logs.data ?? [], products: prods.data ?? [] };
    },
  });
  const rows = useMemo(
    () => (data ? buildYieldReport(data.logs as any, data.products.map((p) => ({ ...p, price: Number(p.price), category: p.category ?? "" }))) : []),
    [data],
  );
  const cats = useMemo(() => groupByCategory(rows), [rows]);
  const losing = rows.filter((r) => r.belowCost);

  return (
    <AdminShell title="Yield Margin Report">
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-bold">Yield Margin Report</h1>
          <p className="text-sm text-muted-foreground">What you paid per kg vs what each cleaned kg really costs, from your latest delivery of each item.</p>
        </div>

        {losing.length > 0 && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm">
            <p className="font-semibold text-destructive">{losing.length} item(s) selling below true cost</p>
            <ul className="mt-1 list-disc pl-5">
              {losing.map((r) => <li key={r.productId}>{r.name}: sells {inr(r.price)}, really costs {inr(r.trueCost)}/kg — raise price.</li>)}
            </ul>
          </div>
        )}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No yields recorded yet. <Link to="/admin/yield" className="text-primary underline">Record your first delivery</Link>.</p>
        ) : (
          <>
            <section>
              <h2 className="mb-2 font-semibold">By category</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cats.map((c) => (
                  <div key={c.category} className="rounded-xl border bg-card p-3 text-sm">
                    <p className="font-semibold">{c.category}</p>
                    <p className="text-muted-foreground">{c.products} items · avg loss {c.avgLossPct}% · avg margin {c.avgMarginPct}%</p>
                    {c.belowCost > 0 && <Badge variant="destructive" className="mt-1">{c.belowCost} below cost</Badge>}
                  </div>
                ))}
              </div>
            </section>
            <section className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>{["Product", "Category", "Paid /kg", "True cost /kg", "Loss", "Extra cost /kg", "Sells", "Margin", "Batches"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.productId} className={`border-t ${r.belowCost ? "bg-destructive/10" : ""}`}>
                      <td className="p-2 font-medium">{r.name}</td>
                      <td className="p-2">{r.category}</td>
                      <td className="p-2">{inr(r.nominalCost)}</td>
                      <td className="p-2 font-semibold">{inr(r.trueCost)}</td>
                      <td className="p-2">{r.lossPct}%</td>
                      <td className="p-2 text-destructive">{inr(r.marginLossPerKg)}</td>
                      <td className="p-2">{inr(r.price)}</td>
                      <td className="p-2">{r.marginPct}%</td>
                      <td className="p-2">{r.batches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
