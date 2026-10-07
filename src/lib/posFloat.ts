import { supabase } from "@/integrations/supabase/client";

/** Saves the opening cash on this device and in the shop's records so the 10 PM server report can use it. */
export async function saveOpeningFloat(amount: number) {
  try {
    localStorage.setItem("fnf_pos_opening_float", String(amount));
  } catch {}
  try {
    await (supabase.from("pos_shift_float" as any) as any).upsert({
      id: 1,
      opening_float: amount,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

/** Expected cash in drawer at close = opening cash + cash sales. */
export function expectedDrawerCash(openingFloat: number, cashSales: number) {
  return Math.round((openingFloat + cashSales) * 100) / 100;
}
