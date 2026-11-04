import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ phone: z.string().trim().min(8).max(20), message: z.string().min(5).max(2000) });

/** Admin-only: sends a supplier payment receipt via WhatsApp Business when connected; otherwise returns a tap-to-send link. */
export const sendDueReceipt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { requireAdmin, requireSupplierPhone } = await import("./authz.server");
    await requireAdmin();
    const verifiedPhone = await requireSupplierPhone(data.phone);
    const { sendWhatsAppNotification } = await import("./whatsappBusiness.server");
    const r = await sendWhatsAppNotification({ type: "order_confirmed", recipientPhone: verifiedPhone, customMessage: data.message } as never);
    return { sent: !!r.success, fallbackUrl: r.fallbackUrl ?? null };
  });
