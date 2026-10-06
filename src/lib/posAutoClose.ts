export const AUTO_CLOSE_KEY = "fnf_pos_auto_close_time";
export const LOCKED_DAY_KEY = "fnf_pos_locked_day";

export function todayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** True when the closing time ("HH:MM") has passed today and the counter was not yet locked today. */
export function shouldAutoLock(time: string, now: Date, lockedDay: string | null) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  if (lockedDay === todayKey(now)) return false;
  const [h, m] = time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h! * 60 + m!;
}
