import { createFileRoute } from "@tanstack/react-router";
import { parseOrderText } from "@/lib/whatsappBot";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  = Meta verification handshake (WHATSAPP_VERIFY_TOKEN).
 * POST = incoming messages, signed with X-Hub-Signature-256 (WHATSAPP_APP_SECRET).
 * Parsed messages become live "confirmed" orders, which reach the kitchen via Realtime.
 */
async function validSignature(body: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (
          token &&
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === token
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_APP_SECRET"];
        const body = await request.text();
        if (!secret || !(await validSignature(body, request.headers.get("x-hub-signature-256"), secret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const messages: { from: string; text: string; name: string }[] = [];
        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const v = change?.value;
            const name = v?.contacts?.[0]?.profile?.name ?? "WhatsApp Customer";
            for (const m of v?.messages ?? []) {
              if (m?.type === "text" && typeof m.text?.body === "string") {
                messages.push({ from: String(m.from).slice(0, 20), text: m.text.body.slice(0, 1000), name: String(name).slice(0, 80) });
              }
            }
          }
        }
        if (!messages.length) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWhatsAppNotification } = await import("@/lib/whatsappBusiness.server");
        const { data: products } = await supabaseAdmin
          .from("products")
          .select("id, name, price, unit")
          .eq("is_available", true)
          .limit(500);
        const catalog = (products ?? []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), unit: p.unit }));

        for (const msg of messages) {
          const parsed = parseOrderText(msg.text, catalog);
          if (!parsed.lines.length) {
            await sendWhatsAppNotification({
              recipientPhone: msg.from,
              type: "order_confirmed",
              customMessage: "Hi! Send your order like: 1kg Seer Fish, 500g Prawns. We'll confirm instantly.",
            }).catch(() => {});
            continue;
          }
          const orderNumber = `WA-${Date.now().toString().slice(-7)}`;
          const { error } = await supabaseAdmin.from("orders").insert({
            order_number: orderNumber,
            customer_name: msg.name,
            customer_phone: msg.from,
            fulfillment_type: "pickup",
            status: "confirmed",
            payment_method: "whatsapp",
            payment_status: "pending",
            subtotal: parsed.subtotal,
            total: parsed.subtotal,
            notes: `WhatsApp: ${msg.text}`.slice(0, 1000),
            items: parsed.lines.map((l) => ({
              product_id: l.product.id,
              name: l.product.name,
              price: l.product.price,
              qty: l.qty,
              unit: l.unit,
              line_total: l.lineTotal,
            })),
          });
          if (error) {
            console.error("[whatsapp-bot] insert failed", error.message);
            continue;
          }
          const list = parsed.lines.map((l) => `• ${l.qty} ${l.unit} ${l.product.name}`).join("\n");
          const miss = parsed.unmatched.length ? `\nNot found: ${parsed.unmatched.join(", ")}` : "";
          await sendWhatsAppNotification({
            recipientPhone: msg.from,
            type: "order_confirmed",
            customMessage: `✅ Order ${orderNumber} sent to kitchen\n${list}\nTotal ₹${parsed.subtotal}${miss}`,
          }).catch(() => {});
        }
        return Response.json({ ok: true });
      },
    },
  },
});
