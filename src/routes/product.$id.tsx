import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { productQuery, productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Product — Fish N Fresh" },
      { name: "description", content: "Fresh seafood details, nutrition, quality and recipes." },
      { property: "og:title", content: "Product — Fish N Fresh" },
      { property: "og:description", content: "Nutrition, traceability and recipes for fresh seafood." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product, isLoading } = useQuery(productQuery(id));
  const { data: all } = useQuery(productsQuery);
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  if (isLoading) return <AppShell><p className="py-20 text-center text-muted-foreground">Loading…</p></AppShell>;
  if (!product) return <AppShell><p className="py-20 text-center">Product not found.</p></AppShell>;

  const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-muted">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="aspect-square w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.name_tamil && <p className="text-muted-foreground">{product.name_tamil}</p>}
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Star className="size-4 fill-current text-accent" />
            {Number(product.rating).toFixed(1)}
            {product.lab_tested && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" /> Lab tested
              </Badge>
            )}
          </div>
          <p className="mt-3 font-display text-3xl font-bold">{inr(Number(product.price))}</p>
          <p className="text-sm text-muted-foreground">per {product.unit}</p>
          {product.description && <p className="mt-4 text-sm">{product.description}</p>}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <button onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Decrease">
                <Minus className="size-4" />
              </button>
              {product.allow_custom_qty ? (
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      setQty(val);
                    }
                  }}
                  className="w-12 bg-transparent text-center font-semibold outline-none tabular-nums"
                  min="1"
                  step="0.5"
                />
              ) : (
                <span className="w-6 text-center font-semibold">{qty}</span>
              )}
              <button onClick={() => setQty((v) => v + 1)} aria-label="Increase">
                <Plus className="size-4" />
              </button>
            </div>
            <Button
              className="flex-1 rounded-xl"
              onClick={() => {
                add(product, qty);
                toast.success("Added to cart");
              }}
            >
              Add to cart · {inr(Number(product.price) * qty)}
            </Button>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {product.calories != null && <Info label="Calories" value={`${product.calories} kcal`} />}
            {product.protein && <Info label="Protein" value={product.protein} />}
            {product.best_for && <Info label="Best for" value={product.best_for} />}
            {product.source_origin && <Info label="Origin" value={product.source_origin} />}
            {product.storage && <Info label="Storage" value={product.storage} />}
            {product.traceability && <Info label="Traceability" value={product.traceability} />}
          </dl>
        </div>
      </div>

      {product.recipe_title && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">{product.recipe_title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{product.recipe_steps}</p>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
