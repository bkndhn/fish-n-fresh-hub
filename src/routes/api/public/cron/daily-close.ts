import { createFileRoute } from "@tanstack/react-router";
import { expectedDrawerCash } from "@/lib/posFloat";

/**
 * Runs from the database scheduler at 10 PM IST: totals today's sales, adds the
 * opening cash, and sends the closing report to WhatsApp. Caller must present
 * LOVABLE_CRON_SECRET or the private token stored in cron_tokens (server-only table).
 */
async function authorized(request: Request, admin: any) {
  const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || token.length < 32) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const d = (v: string) => createHash("sha256").update(v).digest();
  const env = process.env["LOVABLE_CRON_SECRET"];
  if (env && timingSafeEqual(d(token), d(env))) return true;
  const { data } = await admin.from("cron_tokens").select("token").eq("name", "daily_close").maybeSingle();
  return !!data?.token && timingSafeEqual(d(token), d(data.token));
}

export const Route = createFileRoute("/api/public/cron/daily-close")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!(await authorized(request, supabaseAdmin))) return new Response("Unauthorized", { status: 401 });
        const { sendWhatsAppNotification } = await import("@/lib/whatsappBusiness.server");

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

        const { data: f } = await (supabaseAdmin.from("pos_shift_float" as any) as any)
          .select("opening_float")
          .eq("id", 1)
          .maybeSingle();
        const opening = Number(f?.opening_float ?? 1000) || 0;

        const { data: s } = await supabaseAdmin
          .from("store_settings")
          .select("store_name, contact_phone, social_whatsapp")
          .limit(1)
          .maybeSingle();
        const phone = process.env["CLOSING_REPORT_PHONE"] || s?.social_whatsapp || s?.contact_phone;
        const total = t.cash + t.upi + t.card + t.other;
        const r = (n: number) => `₹${n.toFixed(2)}`;
        const text = [
          `🧾 ${s?.store_name ?? "Store"} — Day close ${day}`,
          `Bills: ${t.count}`,
          `Opening cash: ${r(opening)}`,
          `Cash sales: ${r(t.cash)}`,
          `Expected cash in drawer: ${r(expectedDrawerCash(opening, t.cash))}`,
          `UPI: ${r(t.upi)}`,
          `Card: ${r(t.card)}`,
          `Other: ${r(t.other)}`,
          `Total sales: ${r(total)}`,
        ].join("\n");

        if (!phone) return Response.json({ ok: false, reason: "no phone" });
        const res = await sendWhatsAppNotification({ recipientPhone: phone, type: "order_confirmed", customMessage: text });
        return Response.json({ ok: res.success, skipped: res.skipped ?? false, count: t.count });
      },
    },
  },
});
