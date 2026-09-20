import { createServerFn } from "@tanstack/react-start";
import { isStaffCaller } from "@/lib/authz.server";

/**
 * Server-side suspension check: the table itself is staff-only.
 * The free-text reason is only returned to signed-in staff — public callers
 * receive nothing more than a blocked/not-blocked flag.
 */
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

    const suspended = Boolean(row);
    if (!suspended) return { suspended: false, reason: null };

    const staff = await isStaffCaller();
    return { suspended: true, reason: staff ? (row?.reason ?? null) : null };
  });
