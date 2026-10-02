import { createServerFn } from "@tanstack/react-start";
import { requireAdmin, requireOrderAccess } from "@/lib/authz.server";
import { sendTestStoreEmail } from "./emails.server";

export const testEmailDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    if (!data.email || !data.email.includes("@")) {
      throw new Error("Please enter a valid email address");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { userId } = await requireAdmin();
    // Test emails only go to the signed-in admin's own address.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    const own = u?.user?.email?.toLowerCase();
    if (!own || own !== data.email.trim().toLowerCase()) {
      throw new Error("Test emails can only be sent to your own sign-in email");
    }
    return await sendTestStoreEmail(own);
  });

export const sendOrderConfirmedEmailServer = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; guestPhone?: string | undefined }) => data)
  .handler(async ({ data }) => {
    // The recipient always comes from the order record itself, never from the caller.
    await requireOrderAccess(data.orderId, data.guestPhone ?? null);
    const { sendOrderConfirmedEmail } = await import("./emails.server");
    return await sendOrderConfirmedEmail(data.orderId);
  });
