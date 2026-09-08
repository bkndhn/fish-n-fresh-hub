import { Minus, Plus, Star, Fish } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);

  const hasDiscount = product.old_price && Number(product.old_price) > Number(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((Number(product.old_price) - Number(product.price)) / Number(product.old_price)) * 100)
    : 0;

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border shadow-sm transition-colors",
        cartItem ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="block relative">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/50 text-muted-foreground">
              <Fish className="size-8 opacity-30" />
            </div>
          )}
        </div>
        {discountPercent > 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
            {discountPercent}% OFF
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="block">
          <h3 className="line-clamp-1 text-sm font-semibold">{product.name}</h3>
          {product.name_tamil && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.name_tamil}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="size-3 fill-current text-accent" />
          {Number(product.rating).toFixed(1)}
          <span>· {product.unit}</span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-1">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display font-bold">{inr(Number(product.price))}</span>
            {hasDiscount ? (
              <div className="flex items-center gap-1 text-[10px]">
                <span className="truncate text-muted-foreground line-through">
                  {inr(Number(product.old_price))}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Save {inr(Number(product.old_price) - Number(product.price))}
                </span>
              </div>
            ) : null}
          </div>
          
          <div className="shrink-0">
            {cartItem ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-background/50 p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 rounded-lg hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setQty(product.id, Math.max(0, cartItem.qty - 1))}
                >
                  <Minus className="size-3" />
                </Button>
                {product.allow_custom_qty ? (
                  <input
                    type="number"
                    value={cartItem.qty}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setQty(product.id, val);
                      }
                    }}
                    className="w-8 bg-transparent text-center text-xs font-medium tabular-nums outline-none"
                    min="1"
                    step="0.5"
                  />
                ) : (
                  <span className="w-6 text-center text-xs font-medium tabular-nums">
                    {cartItem.qty}
                  </span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 rounded-lg hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setQty(product.id, cartItem.qty + 1)}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8 rounded-xl px-3 text-xs"
                onClick={() => {
                  add(product, 1);
                  toast.success(`${product.name} added to cart`);
                }}
              >
                <Plus className="mr-1 size-3" /> Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
