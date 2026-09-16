import { supabase } from "@/integrations/supabase/client";

/**
 * Generates separate, clean, sequential order numbers for POS vs Online orders.
 *
 * Online orders: FNF-YYYYMMDD-XXXX (e.g. FNF-20260912-0001)
 * POS in-store orders: POS-YYYYMMDD-XXXX (e.g. POS-20260912-0001)
 */
export async function getNextOrderSequenceNumber(type: "online" | "pos" = "online"): Promise<string> {
  const prefix = type === "online" ? "FNF-" : "POS-";
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const pattern = `${prefix}${todayStr}-%`;

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number")
      .like("order_number", pattern)
      .order("order_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (!error && data && data.length > 0 && data[0]?.order_number) {
      const parts = data[0].order_number.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    } else {
      // Check local storage sequence fallback for resilience
      try {
        const storageKey = type === "online" ? "fnf_online_seq" : "fnf_pos_seq";
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.date === todayStr && typeof parsed.lastSeq === "number") {
            nextNum = Math.max(nextNum, parsed.lastSeq + 1);
          }
        }
      } catch {}
    }

    try {
      const storageKey = type === "online" ? "fnf_online_seq" : "fnf_pos_seq";
      localStorage.setItem(storageKey, JSON.stringify({ date: todayStr, lastSeq: nextNum }));
    } catch {}

    const padded = String(nextNum).padStart(4, "0");
    return `${prefix}${todayStr}-${padded}`;
  } catch {
    const fallbackSeq = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${todayStr}-${fallbackSeq}`;
  }
}
