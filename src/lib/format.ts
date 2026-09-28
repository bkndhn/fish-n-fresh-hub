export function inr(value: number | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

export const formatINR = inr;

export function formatIST(dateStr: string | null | undefined | Date): string {
  if (!dateStr) return "-";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Format date & exact time with 12-hour AM/PM for tax invoices, POS receipts, and order bills.
 * e.g., "10 Sep 2026, 11:15 AM" or "10 Sep 2026, 11:15:30 AM"
 */
export function formatInvoiceDateTime(
  dateStr: string | null | undefined | Date,
  includeSeconds = false
): string {
  if (!dateStr) return "-";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(d);
}

export function formatStockDisplay(stock: number | null | undefined, unit: string | null | undefined): string {
  const s = stock ?? 0;
  const u = (unit || "kg").trim();
  const lower = u.toLowerCase();

  if (lower === "kg") return `${s} kg`;
  if (lower === "g" || lower === "gram" || lower === "grams") return `${s} g`;
  if (lower === "250g") return `${s} packs (250g)`;
  if (lower === "500g") return `${s} packs (500g)`;
  if (lower === "100g") return `${s} packs (100g)`;
  if (lower === "pc" || lower === "piece" || lower === "pcs" || lower === "pieces") return `${s} pcs`;
  if (lower === "pack" || lower === "packs") return `${s} packs`;
  if (lower === "tray" || lower === "trays") return `${s} trays`;
  if (lower === "dozen") return `${s} dozen`;
  if (lower.endsWith("g") && !lower.includes(" ")) return `${s} packs (${u})`;
  return `${s} ${u}`;
}

export function formatStockUnitLabel(unit: string | null | undefined): string {
  const u = (unit || "kg").trim();
  const lower = u.toLowerCase();
  if (lower.endsWith("g") && lower !== "g") return `packs (${u})`;
  if (lower === "pc" || lower === "piece") return "pcs";
  return u;
}

export function formatStockBadge(stock: number | null | undefined, unit: string | null | undefined): string {
  const s = stock ?? 0;
  const u = (unit || "kg").trim();
  const lower = u.toLowerCase();

  if (lower === "kg") return `${s} kg`;
  if (lower === "g" || lower === "gram" || lower === "grams") return `${s} g`;
  if (lower === "250g") return `${s} pkts (250g)`;
  if (lower === "500g") return `${s} pkts (500g)`;
  if (lower === "100g") return `${s} pkts (100g)`;
  if (lower === "pc" || lower === "piece" || lower === "pcs" || lower === "pieces") return `${s} pcs`;
  if (lower === "pack" || lower === "packs") return `${s} pkts`;
  if (lower === "tray" || lower === "trays") return `${s} trays`;
  if (lower === "dozen") return `${s} doz`;
  if (lower.endsWith("g") && !lower.includes(" ")) return `${s} pkts (${u})`;
  return `${s} ${u}`;
}

/**
 * Formats a count into a compact string like 1,450 -> 1.5K, 25,000 -> 25K
 */
export function formatCompactNumber(count: number | null | undefined): string {
  const n = Number(count) || 0;
  if (n <= 0) return "0";
  if (n < 1000) return String(n);
  if (n < 1000000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}K` : `${Number(k.toFixed(1))}K`;
  }
  const m = n / 1000000;
  return m >= 10 ? `${Math.round(m)}M` : `${Number(m.toFixed(1))}M`;
}
