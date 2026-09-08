import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_order_status",
  title: "Get order status",
  description:
    "Get the delivery status, timeline and payment details of one of the signed-in customer's orders by order number.",
  inputSchema: {
    order_number: z.string().trim().describe("The order number shown on the order, e.g. FNF-1042."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, status_history, payment_status, payment_method, total, refund_amount, refunded_at, created_at, delivery_date, delivery_slot, eta_minutes, delivery_note, address, items",
      )
      .eq("order_number", order_number)
      .maybeSingle();

    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text" as const, text: `No order found with number ${order_number}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: { order: data },
    };
  },
});
