export type Schedulable = {
  available_from?: string | null;
  available_to?: string | null;
  available_days?: number[] | null;
  expiry_date?: string | null;
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Is product sellable right now? Days are 0=Sun..6=Sat; expiry date is the last sellable day. */
export function isProductSellableNow(p: Schedulable, now: Date = new Date()): boolean {
  if (p.expiry_date) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (today > p.expiry_date) return false;
  }
  if (p.available_days && p.available_days.length > 0 && !p.available_days.includes(now.getDay())) return false;
  if (p.available_from && p.available_to) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const a = toMin(p.available_from);
    const b = toMin(p.available_to);
    const inside = a <= b ? cur >= a && cur <= b : cur >= a || cur <= b; // overnight windows
    if (!inside) return false;
  }
  return true;
}

export function scheduleLabel(p: Schedulable): string | null {
  const parts: string[] = [];
  if (p.available_days && p.available_days.length > 0 && p.available_days.length < 7)
    parts.push(p.available_days.slice().sort().map((d) => DAY_LABELS[d]).join(", "));
  if (p.available_from && p.available_to) parts.push(`${p.available_from.slice(0, 5)}–${p.available_to.slice(0, 5)}`);
  return parts.length ? parts.join(" · ") : null;
}
