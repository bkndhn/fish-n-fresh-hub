export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
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
