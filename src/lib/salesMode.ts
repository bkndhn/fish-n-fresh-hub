/**
 * Store sales mode: who the shop sells to.
 *
 * - `retail`    — ordinary customers only. Trade rates and the bulk portal are off.
 * - `wholesale` — trade buyers only. Ordering needs an approved trade account.
 * - `both`      — hybrid: retail customers shop normally, approved trade
 *                 buyers automatically see bulk rates and slab discounts.
 */

export type SalesMode = "retail" | "wholesale" | "both";

export const SALES_MODES: { id: SalesMode; label: string; description: string }[] = [
  {
    id: "retail",
    label: "Retail only",
    description: "Sell to walk-in and home customers. Bulk rates stay hidden.",
  },
  {
    id: "wholesale",
    label: "Wholesale only",
    description: "Sell only to approved shops, hotels and caterers at trade rates.",
  },
  {
    id: "both",
    label: "Retail + Wholesale",
    description: "Home customers pay retail; approved trade buyers get bulk rates.",
  },
];

/** Reads the store's sales mode from settings, defaulting to retail. */
export function getSalesMode(settings?: { sales_mode?: string | null } | null): SalesMode {
  const raw = String(settings?.sales_mode ?? "").toLowerCase();
  if (raw === "wholesale" || raw === "both") return raw;
  return "retail";
}

/** Trade pricing and the bulk portal are only live in wholesale/both. */
export function isWholesaleEnabled(mode: SalesMode): boolean {
  return mode === "wholesale" || mode === "both";
}

/** Retail visitors can buy at retail prices only in retail/both. */
export function isRetailEnabled(mode: SalesMode): boolean {
  return mode === "retail" || mode === "both";
}

/**
 * Whether this shopper may place an order right now.
 * In wholesale-only mode an approved trade account is required.
 */
export function canPlaceOrder(mode: SalesMode, isApprovedTradeBuyer: boolean): boolean {
  if (mode === "wholesale") return isApprovedTradeBuyer;
  return true;
}

export function salesModeLabel(mode: SalesMode): string {
  return SALES_MODES.find((m) => m.id === mode)?.label ?? "Retail only";
}
