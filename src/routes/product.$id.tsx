import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, ShieldCheck, Star, MessageSquare, Fish } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { inr, formatIST, formatStockDisplay } from "@/lib/format";
import { productQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { ProductAiBenefitsCard } from "@/components/ProductAiBenefitsCard";

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
  const { data: settings } = useQuery(settingsQuery);
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  if (isLoading) return <AppShell><p className="py-20 text-center text-muted-foreground">Loading…</p></AppShell>;
  if (!product) return <AppShell><p className="py-20 text-center">Product not found.</p></AppShell>;

  const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  const isOutOfStock = (product.stock !== null && Number(product.stock) <= 0) || product.is_available === false;
  const showStockToCustomer = (settings as any)?.show_stock_to_customers ?? true;
  const urgencyThreshold = Number((settings as any)?.stock_urgency_threshold ?? 5);
  const isLowStock =
    showStockToCustomer &&
    !isOutOfStock &&
    product.stock !== null &&
    Number(product.stock) <= urgencyThreshold;

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="aspect-square w-full flex items-center justify-center bg-muted/60 text-muted-foreground">
              <Fish className="size-16 opacity-30" />
            </div>
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
          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className="font-display text-3xl font-bold">{inr(Number(product.price))}</span>
            {product.old_price && Number(product.old_price) > Number(product.price) && (
              <>
                <span className="text-base text-muted-foreground line-through">
                  MRP: {inr(Number(product.old_price))}
                </span>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  {Math.round(((Number(product.old_price) - Number(product.price)) / Number(product.old_price)) * 100)}% OFF
                </Badge>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  (Save {inr(Number(product.old_price) - Number(product.price))})
                </span>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">per {product.unit}</p>

          {/* Real-time Urgency / Out of Stock Banner */}
          {isOutOfStock ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <span className="size-2 rounded-full bg-rose-500" />
              Sold out for today — daily fresh catch arrives tomorrow morning
            </div>
          ) : isLowStock ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 animate-pulse">
              <span>🔥 High demand! Only <strong>{formatStockDisplay(product.stock, product.unit)}</strong> remaining in today's harvest</span>
            </div>
          ) : null}

          {product.description && <p className="mt-4 text-sm">{product.description}</p>}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <button onClick={() => setQty((v) => Math.max(1, v - 1))} aria-label="Decrease" disabled={isOutOfStock}>
                <Minus className="size-4" />
              </button>
              {product.allow_custom_qty ? (
                <input
                  type="number"
                  value={qty}
                  disabled={isOutOfStock}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      setQty(val);
                    }
                  }}
                  className="w-12 bg-transparent text-center font-semibold outline-none tabular-nums disabled:opacity-50"
                  min="1"
                  step="0.5"
                />
              ) : (
                <span className="w-6 text-center font-semibold">{qty}</span>
              )}
              <button onClick={() => setQty((v) => v + 1)} aria-label="Increase" disabled={isOutOfStock}>
                <Plus className="size-4" />
              </button>
            </div>
            <Button
              className="flex-1 rounded-xl"
              disabled={isOutOfStock}
              onClick={() => {
                add(product, qty);
                toast.success("Added to cart");
              }}
            >
              {isOutOfStock ? "Out of Stock" : `Add to cart · ${inr(Number(product.price) * qty)}`}
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

      {/* AI Multi-Language Health & Culinary Intelligence */}
      <div className="mt-8">
        <ProductAiBenefitsCard product={product} />
      </div>

      {product.recipe_title && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">{product.recipe_title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{product.recipe_steps}</p>
        </section>
      )}

      {/* Customer Reviews Section */}
      <ProductReviewsSection productId={product.id} productName={product.name} />

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

function ProductReviewsSection({ productId, productName }: { productId: string; productName: string }) {
  const qc = useQueryClient();
  const [openReview, setOpenReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Please enter your name");
      if (!comment.trim()) throw new Error("Please enter a short review");

      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        product_name: productName,
        rating,
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, "") || null,
        comment: comment.trim(),
        active: true,
        verified: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you for your feedback.");
      setOpenReview(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit review"),
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + Number(r.rating), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Customer Reviews {avgRating && <span className="text-sm font-normal text-muted-foreground">({avgRating} ★ / {reviews.length} reviews)</span>}
          </h2>
          <p className="text-xs text-muted-foreground">Real feedback from verified seafood lovers.</p>
        </div>

        <Dialog open={openReview} onOpenChange={setOpenReview}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl shrink-0">
              <MessageSquare className="mr-1.5 size-3.5" /> Rate & Review
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Write a Review for {productName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Your Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-accent hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`size-6 ${
                          s <= rating ? "fill-accent text-accent" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rev-name">Name *</Label>
                  <Input
                    id="rev-name"
                    placeholder="Deepak"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rev-phone">Phone (Optional)</Label>
                  <Input
                    id="rev-phone"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rev-comment">Review Comments *</Label>
                <Textarea
                  id="rev-comment"
                  placeholder="How was the freshness, taste, and cutting?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <Button
                className="w-full rounded-xl"
                disabled={submitReview.isPending || !name.trim() || !comment.trim()}
                onClick={() => submitReview.mutate()}
              >
                {submitReview.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border p-3 bg-muted/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs">{r.customer_name || "Seafood Customer"}</span>
                {r.verified && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                    Verified Buyer
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{formatIST(r.created_at)}</span>
            </div>

            <div className="flex items-center gap-1 text-accent">
              {[...Array(Number(r.rating || 5))].map((_, i) => (
                <Star key={i} className="size-3 fill-current" />
              ))}
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed">{r.comment}</p>

            {r.admin_reply && (
              <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2 text-xs text-primary">
                <p className="font-semibold text-[11px]">Shop Owner Reply:</p>
                <p className="text-[11px] text-muted-foreground">{r.admin_reply}</p>
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No reviews yet. Be the first to try this fresh catch and leave a review!
          </p>
        )}
      </div>
    </section>
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
