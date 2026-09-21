import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductCard } from "@/components/ProductCard";
import { recommendProducts, type AiRecommendation } from "@/lib/recommend.functions";
import type { Product } from "@/lib/types";

const CHIPS = [
  "Boneless and mild — cooking for kids",
  "Spicy tawa fry for 4 people",
  "Traditional curry, under ₹500",
  "High protein, low oil diet meals",
];

export function AiPicksDialog({
  products,
  branchId,
}: {
  products: Product[];
  branchId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiRecommendation | null>(null);
  const recommend = useServerFn(recommendProducts);

  const ask = async (value: string) => {
    const preferences = value.trim();
    if (preferences.length < 3 || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await recommend({ data: { preferences, branchId: branchId ?? null } });
      setResult(res);
    } catch {
      setResult({ intro: "", picks: [], error: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Help me choose
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Tell us what you feel like eating
          </DialogTitle>
          <DialogDescription>
            Describe your taste, budget or who you are cooking for and we will pick from today&apos;s stock.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="e.g. Mild boneless fish for kids, family of 4, around ₹600"
        />

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setText(c);
                void ask(c);
              }}
              className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {c}
            </button>
          ))}
        </div>

        <Button onClick={() => void ask(text)} disabled={loading || text.trim().length < 3} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Finding your picks…" : "Suggest for me"}
        </Button>

        {result?.error && <p className="text-sm text-destructive">{result.error}</p>}

        {result && !result.error && (
          <div className="space-y-4">
            {result.intro && <p className="text-sm text-muted-foreground">{result.intro}</p>}
            {result.picks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing in today&apos;s stock matches that. Try describing it differently.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {result.picks.map((pick) => {
                const product = byId.get(pick.product_id);
                if (!product) return null;
                return (
                  <div key={pick.product_id} className="space-y-1">
                    <ProductCard product={product} />
                    <p className="text-xs text-muted-foreground">{pick.reason}</p>
                    {pick.cut_suggestion && (
                      <p className="text-xs font-medium text-primary">Cut: {pick.cut_suggestion}</p>
                    )}
                    {pick.cooking_tip && <p className="text-xs text-muted-foreground">{pick.cooking_tip}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
