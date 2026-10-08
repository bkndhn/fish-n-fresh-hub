// Kitchen bump bar rules: ticket age tiers and next-status bumps.
export type TicketTier = "fresh" | "active" | "urgent";

export const FRESH_LIMIT_MIN = 10;
export const URGENT_AFTER_MIN = 20;

export function ticketAgeMinutes(createdAt: string, now: number = Date.now()): number {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60000));
}

export function ticketTier(ageMin: number): TicketTier {
  if (ageMin < FRESH_LIMIT_MIN) return "fresh";
  if (ageMin <= URGENT_AFTER_MIN) return "active";
  return "urgent";
}

export function formatAge(createdAt: string, now: number = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Kitchen flow: pending → confirmed (prep) → packed (ready) → delivered (handed over). */
export const BUMP_NEXT: Record<string, string> = {
  pending: "confirmed",
  confirmed: "packed",
  packed: "delivered",
};
export const BUMP_PREV: Record<string, string> = {
  confirmed: "pending",
  packed: "confirmed",
  delivered: "packed",
};
export const BUMP_LABEL: Record<string, string> = {
  pending: "Start prep",
  confirmed: "Ready",
  packed: "Handed over",
};

export type KitchenStation = "all" | "dine_in" | "counter" | "delivery";

export function stationOf(o: { fulfillment_type?: string | null; table_number?: string | null }): Exclude<KitchenStation, "all"> {
  const f = (o.fulfillment_type ?? "").toLowerCase();
  if (o.table_number || f === "dine_in" || f === "table") return "dine_in";
  if (f === "delivery") return "delivery";
  return "counter";
}
