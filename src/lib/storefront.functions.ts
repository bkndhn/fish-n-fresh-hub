import { createServerFn } from "@tanstack/react-start";

/**
 * The store's UPI collection handle is no longer readable straight from the
 * settings table by anonymous visitors. Checkout asks for it only at the moment
 * a payment is being made, so it is not casually scrapable alongside the rest
 * of the store's financial identifiers (GSTIN, FSSAI, gateway config).
 */
export const getStoreUpiTarget = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ upi_id: string | null; upi_name: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("store_settings")
      .select("upi_id, upi_name")
      .limit(1)
      .maybeSingle();
    return { upi_id: data?.upi_id ?? null, upi_name: data?.upi_name ?? null };
  },
);
