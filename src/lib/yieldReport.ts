export interface YieldLogRow {
  product_id: string | null;
  product_name: string;
  purchase_cost_per_kg: number;
  true_cost_per_kg: number;
  cutting_loss_pct: number;
  batch_ref?: string | null;
  delivery_date?: string | null;
  created_at: string;
}
export interface YieldProductRow {
  id: string;
  name: string;
  price: number;
  category: string;
}
export interface YieldReportRow {
  productId: string;
  name: string;
  category: string;
  nominalCost: number;
  trueCost: number;
  lossPct: number;
  price: number;
  marginLossPerKg: number;
  marginPct: number;
  belowCost: boolean;
  batches: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Latest batch per product decides today's true cost; earlier batches stay as history. */
export function buildYieldReport(logs: YieldLogRow[], products: YieldProductRow[]): YieldReportRow[] {
  const byProduct = new Map<string, YieldLogRow[]>();
  for (const l of logs) {
    if (!l.product_id) continue;
    const arr = byProduct.get(l.product_id) ?? [];
    arr.push(l);
    byProduct.set(l.product_id, arr);
  }
  const rows: YieldReportRow[] = [];
  for (const p of products) {
    const list = byProduct.get(p.id);
    if (!list?.length) continue;
    const latest = [...list].sort((a, b) =>
      (b.delivery_date ?? b.created_at).localeCompare(a.delivery_date ?? a.created_at) || b.created_at.localeCompare(a.created_at),
    )[0]!;
    const nominal = Number(latest.purchase_cost_per_kg);
    const trueCost = Number(latest.true_cost_per_kg);
    const price = Number(p.price);
    rows.push({
      productId: p.id,
      name: p.name,
      category: p.category || "Uncategorised",
      nominalCost: r2(nominal),
      trueCost: r2(trueCost),
      lossPct: Number(latest.cutting_loss_pct),
      price,
      marginLossPerKg: r2(trueCost - nominal),
      marginPct: price > 0 ? r2(((price - trueCost) / price) * 100) : 0,
      belowCost: price < trueCost,
      batches: list.length,
    });
  }
  return rows.sort((a, b) => b.marginLossPerKg - a.marginLossPerKg);
}

export function groupByCategory(rows: YieldReportRow[]) {
  const map = new Map<string, { category: string; products: number; avgLossPct: number; avgMarginPct: number; belowCost: number }>();
  for (const r of rows) {
    const g = map.get(r.category) ?? { category: r.category, products: 0, avgLossPct: 0, avgMarginPct: 0, belowCost: 0 };
    g.avgLossPct += r.lossPct;
    g.avgMarginPct += r.marginPct;
    g.products += 1;
    if (r.belowCost) g.belowCost += 1;
    map.set(r.category, g);
  }
  return [...map.values()].map((g) => ({ ...g, avgLossPct: r2(g.avgLossPct / g.products), avgMarginPct: r2(g.avgMarginPct / g.products) }));
}
