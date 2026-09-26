import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WebhookEndpointRow = {
  id: string;
  label: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  last_status: number | null;
  last_error: string | null;
  last_delivered_at: string | null;
  created_at: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin_or_super");
  if (!data) throw new Error("Forbidden");
}

export const listWebhookEndpoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { data, error } = await (context as any).supabase
      .from("webhook_endpoints")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WebhookEndpointRow[];
  });

export const saveWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      id?: string;
      label: string;
      url: string;
      events: string[];
      is_active: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!/^https?:\/\/.+/i.test(data.url)) throw new Error("Enter a valid https:// URL");
    if (!data.label.trim()) throw new Error("Give this webhook a name");
    if (data.events.length === 0) throw new Error("Pick at least one event");

    const db = (context as any).supabase;
    const payload = {
      label: data.label.trim(),
      url: data.url.trim(),
      events: data.events,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await db.from("webhook_endpoints").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { success: true, id: data.id };
    }
    const { data: row, error } = await db
      .from("webhook_endpoints")
      .insert({ ...payload, created_by: (context as any).userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { success: true, id: row.id as string };
  });

export const deleteWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await (context as any).supabase
      .from("webhook_endpoints")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

/** Send a simulated payment.succeeded payload to one endpoint and report the result. */
export const testWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { data: ep, error } = await (context as any).supabase
      .from("webhook_endpoints")
      .select("id, url, secret")
      .eq("id", data.id)
      .single();
    if (error || !ep) throw new Error("Webhook not found");

    const { deliverOne, buildPayload } = await import("./webhooks.server");
    const payload = buildPayload(
      "payment.succeeded",
      {
        id: "00000000-0000-0000-0000-000000000000",
        order_number: "TEST-PING",
        status: "confirmed",
        payment_status: "paid",
        payment_method: "card",
        total: 499,
        items: [{ name: "Test item", qty: 1, price: 499 }],
        customer_name: "Test Customer",
        customer_phone: "9999999999",
        created_at: new Date().toISOString(),
      },
      { test: true },
    );
    const result = await deliverOne({ url: ep.url, secret: ep.secret, payload });
    return result;
  });
