import { createServerFn } from "@tanstack/react-start";

/** Server-side suspension check: the table itself is staff-only. */
export const checkSuspension = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => {
    const phone = String(input?.phone ?? "").replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15) throw new Error("Enter a valid phone number");
    return { phone };
  })
  .handler(async ({ data }): Promise<{ suspended: boolean; reason: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("customer_suspensions")
      .select("reason")
      .eq("phone", data.phone)
      .maybeSingle();
    return { suspended: Boolean(row), reason: row?.reason ?? null };
  });
