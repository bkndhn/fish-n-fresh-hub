import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ name: z.string().trim().min(2).max(120), category: z.string().max(80).optional() });
const Schema = z.object({
  descriptions: z.array(z.string()),
  image_prompts: z.array(z.string()),
});

export type ProductAiSuggestion = { descriptions: string[]; image_prompts: string[]; error?: string };

/** Admin-only: 3 short descriptions + 3 photo prompts for a product name (one cheap AI call). */
export const suggestProductContent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<ProductAiSuggestion> => {
    const { requireAdmin } = await import("./authz.server");
    await requireAdmin();
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { descriptions: [], image_prompts: [], error: "AI is not configured yet." };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai-gateway.server");
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
          "You write product copy for an Indian local shop app. Return exactly 3 descriptions (each under 40 words: " +
          "1 short & catchy, 1 usage/cooking tips, 1 freshness/health) and exactly 3 short English photo prompts " +
          "(realistic product photo, plain background, no text). Do not invent prices or certifications.",
        prompt: `Product: ${data.name}${data.category ? `\nCategory: ${data.category}` : ""}`,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      const out = await result.output;
      return { descriptions: out.descriptions.slice(0, 3), image_prompts: out.image_prompts.slice(0, 3) };
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      if (m.includes("429")) return { descriptions: [], image_prompts: [], error: "Too many requests. Try again in a minute." };
      if (m.includes("402")) return { descriptions: [], image_prompts: [], error: "AI credits are used up. Please top up." };
      console.error("suggestProductContent failed", err);
      return { descriptions: [], image_prompts: [], error: "Suggestions are unavailable right now." };
    }
  });
