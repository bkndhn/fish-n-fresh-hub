import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Runs from the scheduler at closing time: totals today's counter sales and sends them to WhatsApp. */
export const Route = createFileRoute("/api/public/cron/daily-close")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWhatsAppNotification } = await import("@/lib/whatsappBusiness.server");

        // Today in India time
        const now = new Date(Date.now() + 5.5 * 3600_000);
        const day = now.toISOString().slice(0, 10);
        const start = new Date(`${day}T00:00:00+05:30`).toISOString();

        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("total, payment_method, actual_payment_method, status")
          .gte("created_at", start)
          .neq("status", "cancelled");

        const t = { cash: 0, upi: 0, card: 0, other: 0, count: 0 };
        for (const o of orders ?? []) {
          const m = String(o.actual_payment_method || o.payment_method || "").toLowerCase();
          const amt = Number(o.total) || 0;
          t.count++;
          if (m.includes("cash") || m === "cod") t.cash += amt;
          else if (m.includes("upi")) t.upi += amt;
          else if (m.includes("card")) t.card += amt;
          else t.other += amt;
        }

        const { data: s } = await supabaseAdmin
          .from("store_settings")
          .select("store_name, contact_phone, social_whatsapp")
          .limit(1)
          .maybeSingle();
        const phone = process.env["CLOSING_REPORT_PHONE"] || s?.social_whatsapp || s?.contact_phone;
        const total = t.cash + t.upi + t.card + t.other;
        const text = `🧾 ${s?.store_name ?? "Store"} — Day close ${day}\nBills: ${t.count}\nCash: ₹${t.cash.toFixed(2)}\nUPI: ₹${t.upi.toFixed(2)}\nCard: ₹${t.card.toFixed(2)}\nOther: ₹${t.other.toFixed(2)}\nTotal: ₹${total.toFixed(2)}`;

        if (!phone) return Response.json({ ok: false, reason: "no phone" });
        const res = await sendWhatsAppNotification({ recipientPhone: phone, type: "order_confirmed", customMessage: text });
        return Response.json({ ok: res.success, skipped: res.skipped ?? false, count: t.count });
      },
    },
  },
});
