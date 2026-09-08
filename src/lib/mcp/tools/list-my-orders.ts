import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description: "List the signed-in customer's Fish N Fresh orders, most recent first.",
  inputSchema: {
    status: z.string().optional().describe("Filter by order status, e.g. pending, out_for_delivery, delivered."),
    limit: z.number().int().optional().describe("Maximum number of orders to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, total, subtotal, created_at, delivery_date, delivery_slot, eta_minutes, items",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 10, 1), 50));
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
