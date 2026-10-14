import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  phone: z.string().trim().min(8).max(20),
  supplierName: z.string().max(120),
  message: z.string().min(5).max(3500),
});

/** Admin-only: sends a purchase order straight into the supplier's WhatsApp chat (no tap needed when WhatsApp Business is connected). */
export const dispatchPoWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./authz.server");
    await requireAdmin();
    const { sendWhatsAppNotification } = await import("./whatsappBusiness.server");
    const r = await sendWhatsAppNotification({
      type: "order_confirmed",
      recipientPhone: data.phone,
      customerName: data.supplierName,
      customMessage: data.message,
    } as never);
    return { sent: !!r.success, skipped: !!r.skipped, fallbackUrl: r.fallbackUrl ?? null };
  });
