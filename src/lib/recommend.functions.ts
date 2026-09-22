// @ts-nocheck

import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const Input = z.object({
  preferences: z.string().min(3).max(600),
  branchId: z.string().nullable(),
});

const Schema = z.object({
  intro: z.string(),
  picks: z.array(
    z.object({
      product_id: z.string(),
      reason: z.string(),
      cut_suggestion: z.string().nullable(),
      cooking_tip: z.string().nullable(),
    }),
  ),
});

export type AiPick = {
  product_id: string;
  reason: string;
  cut_suggestion: string | null;
  cooking_tip: string | null;
};

export type AiRecommendation = {
  intro: string;
  picks: AiPick[];
  error?: string;
};

export const recommendProducts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<AiRecommendation> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { intro: "", picks: [], error: "AI is not configured yet." };

    const sbKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const sbUrl = process.env["SUPABASE_URL"];
    if (!sbKey || !sbUrl) return { intro: "", picks: [], error: "Catalog is unavailable right now." };

    const supabasePublic = createClient<Database>(sbUrl, sbKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (sbKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${sbKey}`) {
            h.delete("Authorization");
          }
          h.set("apikey", sbKey);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    let query = supabasePublic
      .from("products")
      .select("id, name, name_tamil, description, price, unit, category, stock, tags, best_for, protein, origin")
      .eq("is_available", true)
      .gt("stock", 0)
      .limit(120);
    if (data.branchId) query = query.or(`branch_id.eq.${data.branchId},branch_id.is.null`);

    const { data: rows, error } = await query;
    if (error || !rows || rows.length === 0) {
      return { intro: "", picks: [], error: "No products are available to recommend right now." };
    }

    const catalog = rows
      .map(
        (p) =>
          `${p.id} | ${p.name}${p.name_tamil ? ` (${p.name_tamil})` : ""} | ${p.category ?? "general"} | Rs.${p.price}/${p.unit} | ${
            p.best_for ?? ""
          } ${p.tags?.join(",") ?? ""} ${p.description?.slice(0, 120) ?? ""}`.trim(),
      )
      .join("\n");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Schema }),
        system:
          "You help shoppers pick items from a fresh seafood and grocery shop. " +
          "Only recommend products from the catalog given, using their exact ids. " +
          "Pick at most 4 items. Keep the intro under 30 words and each reason under 25 words. " +
          "Suggest a practical cut (curry cut, fry slice, whole cleaned, boneless fillet) when it fits, otherwise null. " +
          "Give one short cooking tip per pick when useful, otherwise null. " +
          "Consider budget, family size, spice level, bones, kids, health goals and cooking style mentioned by the shopper. " +
          "Never invent products, prices or ids.",
        prompt: `Shopper says: "${data.preferences}"\n\nCatalog (id | name | category | price | notes):\n${catalog}`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });

      const output = await result.output;
      const valid = new Set(rows.map((r) => r.id));
      return {
        intro: output.intro,
        picks: output.picks.filter((p) => valid.has(p.product_id)).slice(0, 4),
      };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return { intro: "", picks: [], error: "Could not read the suggestion. Please try rephrasing." };
      }
      const message = err instanceof Error ? err.message : "";
      if (message.includes("429")) return { intro: "", picks: [], error: "Too many requests. Please try again shortly." };
      if (message.includes("402")) return { intro: "", picks: [], error: "AI credits are exhausted. Please top up." };
      console.error("recommendProducts failed", err);
      return { intro: "", picks: [], error: "The suggestion service is unavailable right now." };
    }
  });
