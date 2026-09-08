export type CustomHoliday = {
  id: string;
  date: string; // YYYY-MM-DD
  reason: string;
};

export type StoreScheduleSettings = {
  is_open?: boolean;
  open_time?: string; // HH:mm (e.g. "07:00")
  close_time?: string; // HH:mm (e.g. "21:00")
  working_days?: number[]; // [0..6], 0=Sun, 1=Mon, ..., 6=Sat
  custom_holidays?: CustomHoliday[];
  allow_preorders_when_closed?: boolean; // true = accept preorders, false = block orders
  closed_message?: string;
};

export type StoreStatusResult = {
  isOpen: boolean;
  isManualClosed: boolean;
  isWeeklyHoliday: boolean;
  isCustomHoliday: boolean;
  isOutsideHours: boolean;
  holidayReason?: string | undefined;
  canAcceptOrder: boolean;
  allowPreorders: boolean;
  statusBadge: "open" | "preorder_only" | "closed";
  statusTitle: string;
  statusDescription: string;
  nextWorkingDate: string;
  openTimeFormatted: string;
  closeTimeFormatted: string;
};

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getLocalTodayString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime12h(time24: string): string {
  if (!time24) return "";
  const parts = time24.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Checks whether a specific date (YYYY-MM-DD) is a weekly off or custom holiday
 */
export function isDateHoliday(
  dateStr: string,
  workingDays: number[] = ALL_WEEKDAYS,
  customHolidays: CustomHoliday[] = []
): { isHoliday: boolean; reason?: string } {
  if (!dateStr) return { isHoliday: false };
  const d = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = d.getDay();

  // 1. Check custom holidays
  const custom = customHolidays.find((h) => h.date === dateStr);
  if (custom) {
    return { isHoliday: true, reason: custom.reason || "Store Holiday" };
  }

  // 2. Check weekly working days
  const activeDays = workingDays && workingDays.length > 0 ? workingDays : ALL_WEEKDAYS;
  if (!activeDays.includes(dayOfWeek)) {
    return { isHoliday: true, reason: `Weekly Off (${WEEKDAY_NAMES[dayOfWeek]})` };
  }

  return { isHoliday: false };
}

/**
 * Calculates the next open working day (YYYY-MM-DD) starting from startFrom
 */
export function getNextWorkingDate(
  workingDays: number[] = ALL_WEEKDAYS,
  customHolidays: CustomHoliday[] = [],
  startFrom: Date = new Date()
): string {
  const candidate = new Date(startFrom);
  const activeDays = workingDays && workingDays.length > 0 ? workingDays : ALL_WEEKDAYS;

  // Search up to 30 days ahead
  for (let i = 0; i < 30; i++) {
    const dateStr = getLocalTodayString(candidate);
    const dayOfWeek = candidate.getDay();

    const isCustom = customHolidays.some((h) => h.date === dateStr);
    const isWorkingDay = activeDays.includes(dayOfWeek);

    if (isWorkingDay && !isCustom) {
      return dateStr;
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  return getLocalTodayString(startFrom);
}

/**
 * Calculates complete store operating status:
 * - Is the store currently open?
 * - Are we on a weekly off or custom holiday?
 * - Are we outside operating hours?
 * - Can the customer place an order right now (immediate or pre-order)?
 */
export function getStoreStatus(settings: any, now: Date = new Date()): StoreStatusResult {
  const isManualClosed = settings?.is_open === false;
  const openTime = settings?.open_time || "07:00";
  const closeTime = settings?.close_time || "21:00";
  
  // working_days can be an array or json string
  let workingDays: number[] = ALL_WEEKDAYS;
  if (Array.isArray(settings?.working_days)) {
    workingDays = settings.working_days;
  } else if (typeof settings?.working_days === "string") {
    try {
      workingDays = JSON.parse(settings.working_days);
    } catch {
      workingDays = ALL_WEEKDAYS;
    }
  }

  // custom_holidays array
  let customHolidays: CustomHoliday[] = [];
  if (Array.isArray(settings?.custom_holidays)) {
    customHolidays = settings.custom_holidays;
  } else if (typeof settings?.custom_holidays === "string") {
    try {
      customHolidays = JSON.parse(settings.custom_holidays);
    } catch {
      customHolidays = [];
    }
  }

  const allowPreorders = settings?.allow_preorders_when_closed !== false;
  const customMessage = settings?.closed_message?.trim();

  const todayStr = getLocalTodayString(now);
  const currentDayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const openMinutes = (openH || 7) * 60 + (openM || 0);
  const closeMinutes = (closeH || 21) * 60 + (closeM || 0);

  // 1. Check Custom Holiday today
  const customHol = customHolidays.find((h) => h.date === todayStr);
  const isCustomHoliday = Boolean(customHol);
  const holidayReason = customHol?.reason || undefined;

  // 2. Check Weekly Off today
  const isWeeklyHoliday = !workingDays.includes(currentDayOfWeek);

  // 3. Check Operating Hours today
  const isOutsideHours = currentMinutes < openMinutes || currentMinutes >= closeMinutes;

  // Store is open ONLY IF manual open + open day + not holiday + within hours
  const isOpen = !isManualClosed && !isCustomHoliday && !isWeeklyHoliday && !isOutsideHours;

  // Next open date calculation
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWorkingDate = isOpen
    ? todayStr
    : getNextWorkingDate(workingDays, customHolidays, currentMinutes < openMinutes && !isCustomHoliday && !isWeeklyHoliday ? now : tomorrow);

  // Can the customer place an order?
  // If open -> YES
  // If closed -> YES only if allowPreorders is true
  const canAcceptOrder = isOpen || allowPreorders;

  let statusBadge: "open" | "preorder_only" | "closed" = "open";
  let statusTitle = `Open Now (${formatTime12h(openTime)} – ${formatTime12h(closeTime)})`;
  let statusDescription = "Accepting fresh orders for today's delivery slots.";

  if (isManualClosed) {
    statusBadge = allowPreorders ? "preorder_only" : "closed";
    statusTitle = "Temporarily Closed";
    statusDescription =
      customMessage ||
      (allowPreorders
        ? "We are currently closed for restocking. Pre-orders are open for our next working day."
        : "Store is currently not accepting new orders. Please check back soon.");
  } else if (isCustomHoliday) {
    statusBadge = allowPreorders ? "preorder_only" : "closed";
    statusTitle = `Closed for ${holidayReason || "Holiday"}`;
    statusDescription =
      customMessage ||
      (allowPreorders
        ? `We are closed today for ${holidayReason || "holiday"}. Pre-orders are accepted for delivery on ${nextWorkingDate}.`
        : `Store is closed today for ${holidayReason || "holiday"}. Orders are paused.`);
  } else if (isWeeklyHoliday) {
    statusBadge = allowPreorders ? "preorder_only" : "closed";
    statusTitle = `Weekly Off (${WEEKDAY_NAMES[currentDayOfWeek]})`;
    statusDescription =
      customMessage ||
      (allowPreorders
        ? `Today is our regular weekly off. Pre-orders are open for ${nextWorkingDate}.`
        : `Our store is closed today for weekly off. Orders will resume on ${nextWorkingDate}.`);
  } else if (isOutsideHours) {
    statusBadge = allowPreorders ? "preorder_only" : "closed";
    statusTitle = `Closed (${formatTime12h(openTime)} – ${formatTime12h(closeTime)})`;
    statusDescription =
      customMessage ||
      (allowPreorders
        ? `Shop is outside operating hours. Pre-orders are open for delivery on ${nextWorkingDate}.`
        : `Shop operates from ${formatTime12h(openTime)} to ${formatTime12h(closeTime)}. Orders are paused until tomorrow morning.`);
  }

  return {
    isOpen,
    isManualClosed,
    isWeeklyHoliday,
    isCustomHoliday,
    isOutsideHours,
    holidayReason,
    canAcceptOrder,
    allowPreorders,
    statusBadge,
    statusTitle,
    statusDescription,
    nextWorkingDate,
    openTimeFormatted: formatTime12h(openTime),
    closeTimeFormatted: formatTime12h(closeTime),
  };
}