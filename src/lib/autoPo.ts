export interface AutoPoProduct {
  id: string;
  name: string;
  stock?: number | string | null;
  low_stock_threshold?: number | string | null;
  unit?: string | null;
  price?: number | string | null;
  cost_price?: number | string | null;
  buying_cost?: number | string | null;
}

/** Products at or below their own low-stock threshold (default 5) that are not already on an open PO. */
export function productsNeedingPo(products: AutoPoProduct[], openProductIds: Set<string>) {
  return products.filter((p) => {
    if (p.stock === null || p.stock === undefined || p.stock === "") return false;
    const threshold = Number(p.low_stock_threshold ?? 5);
    return Number(p.stock) <= threshold && !openProductIds.has(p.id);
  });
}

/** Restock to twice the threshold (at least 1). */
export function suggestedRestockQty(p: AutoPoProduct) {
  const threshold = Number(p.low_stock_threshold ?? 5) || 5;
  return Math.max(1, Math.ceil(threshold * 2 - Math.max(0, Number(p.stock) || 0)));
}

export function estimatedRate(p: AutoPoProduct) {
  const cost = Number(p.cost_price ?? p.buying_cost ?? 0);
  return cost > 0 ? cost : Math.round(Number(p.price || 0) * 0.7);
}
