export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekday (0 = Sunday) in the shop's time zone (IST). */
export function shopWeekday(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(now);
  return DAY_NAMES.indexOf(name);
}

export function normalizeWeekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}

export function isFreeDeliveryDay(weekdays: unknown, now: Date = new Date()): boolean {
  return normalizeWeekdays(weekdays).includes(shopWeekday(now));
}

/** Retail delivery fee after the free-delivery-day rule. */
export function applyFreeDeliveryDay(fee: number, weekdays: unknown, now: Date = new Date()): number {
  return isFreeDeliveryDay(weekdays, now) ? 0 : fee;
}

export function nextFreeDay(weekdays: unknown, now: Date = new Date()): number | null {
  const days = normalizeWeekdays(weekdays);
  if (!days.length) return null;
  const today = shopWeekday(now);
  return days.find((d) => d > today) ?? days[0]!;
}
