import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_products",
  title: "List seafood products",
  description:
    "List seafood products in the Fish N Fresh catalogue, optionally filtered by search text or category.",
  inputSchema: {
    search: z.string().optional().describe("Text to match against the product name."),
    category: z.string().optional().describe("Category name to filter by."),
    only_available: z.boolean().optional().describe("Only return products currently in stock."),
    limit: z.number().int().optional().describe("Maximum number of products to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, category, only_available, limit }) => {
    const supabase = supabaseAnon();
    let query = supabase
      .from("products")
      .select("id, name, description, price, old_price, unit, category, stock, is_available, origin, rating")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));

    if (search) query = query.ilike("name", `%${search}%`);
    if (category) query = query.eq("category", category);
    if (only_available) query = query.eq("is_available", true);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
