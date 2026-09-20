/**
 * Wholesale (trade / bulk buyer) pricing helpers.
 *
 * A retail shop buying from a wholesale store gets tiered rates: the more they
 * buy of one item, the lower the per-unit price. Tiers are stored on the
 * product as a JSON array and mirrored by the database function
 * `wholesale_unit_price()`, which is the authority at order time.
 */

export type WholesaleTier = {
  min_qty: number;
  price: number;
};

export type WholesalePricing = {
  price: number;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  wholesale_tiers?: unknown;
};

export type WholesaleAccountStatus = "pending" | "approved" | "rejected" | "suspended";

export type WholesaleAccount = {
  id: string;
  user_id: string | null;
  business_name: string;
  contact_name: string | null;
  phone: string;
  email: string | null;
  gstin: string | null;
  address: string | null;
  status: string;
  extra_discount_percent: number;
  credit_limit: number;
  notes: string | null;
  created_at: string;
};

/** Normalises whatever is stored in `wholesale_tiers` into a sorted tier list. */
export function parseTiers(raw: unknown): WholesaleTier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: WholesaleTier[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const min_qty = Number(row["min_qty"]);
    const price = Number(row["price"]);
    if (!Number.isFinite(min_qty) || !Number.isFinite(price) || price <= 0) continue;
    tiers.push({ min_qty: Math.max(0, min_qty), price });
  }
  return tiers.sort((a, b) => a.min_qty - b.min_qty);
}

/**
 * Best unit price for a wholesale buyer at a given quantity.
 * Retail price is the ceiling: a tier only applies when it is cheaper.
 */
export function resolveWholesaleUnitPrice(product: WholesalePricing, qty: number): number {
  const retail = Number(product.price) || 0;
  let best = retail;

  const flat = product.wholesale_price == null ? null : Number(product.wholesale_price);
  const minQty = Number(product.wholesale_min_qty ?? 0) || 0;
  if (flat != null && Number.isFinite(flat) && flat > 0 && qty >= minQty && flat < best) {
    best = flat;
  }

  for (const tier of parseTiers(product.wholesale_tiers)) {
    if (qty >= tier.min_qty && tier.price < best) best = tier.price;
  }

  return Math.round(best * 100) / 100;
}

/** Applies the account-level extra discount on top of the tier price. */
export function applyAccountDiscount(unitPrice: number, extraPercent: number | null | undefined): number {
  const pct = Math.min(Math.max(Number(extraPercent ?? 0) || 0, 0), 50);
  if (pct <= 0) return unitPrice;
  return Math.round(unitPrice * (1 - pct / 100) * 100) / 100;
}

/** Savings versus the retail price, as a whole percentage. */
export function savingsPercent(retail: number, unitPrice: number): number {
  if (!retail || unitPrice >= retail) return 0;
  return Math.round(((retail - unitPrice) / retail) * 100);
}

/** The next cheaper tier above the current quantity, for "buy N more" hints. */
export function nextTier(product: WholesalePricing, qty: number): WholesaleTier | null {
  const current = resolveWholesaleUnitPrice(product, qty);
  const upcoming = parseTiers(product.wholesale_tiers).filter(
    (t) => t.min_qty > qty && t.price < current,
  );
  return upcoming[0] ?? null;
}

/**
 * Order-value discount bands: a whole basket above a value earns an extra
 * percentage off. Mirrors the database function
 * `wholesale_order_discount_percent()`, which is authoritative at order time.
 */
export type WholesaleBand = {
  id: string;
  label: string | null;
  min_order_value: number;
  discount_percent: number;
  active: boolean;
};

/** Highest band percentage the given order value qualifies for. */
export function resolveBandPercent(bands: WholesaleBand[], subtotal: number): number {
  let best = 0;
  for (const b of bands) {
    if (!b.active) continue;
    if (Number(subtotal) >= Number(b.min_order_value) && Number(b.discount_percent) > best) {
      best = Number(b.discount_percent);
    }
  }
  return Math.min(Math.max(best, 0), 50);
}

/** The next band above the current order value, for "spend N more" hints. */
export function nextBand(bands: WholesaleBand[], subtotal: number): WholesaleBand | null {
  const current = resolveBandPercent(bands, subtotal);
  const upcoming = bands
    .filter((b) => b.active && Number(b.min_order_value) > Number(subtotal) && Number(b.discount_percent) > current)
    .sort((a, b) => Number(a.min_order_value) - Number(b.min_order_value));
  return upcoming[0] ?? null;
}

