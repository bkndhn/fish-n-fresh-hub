import { Minus, Plus, Star, Fish } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr, formatStockDisplay } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const { data: settings } = useQuery(settingsQuery);

  const hasDiscount = product.old_price && Number(product.old_price) > Number(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((Number(product.old_price) - Number(product.price)) / Number(product.old_price)) * 100)
    : 0;

  const isOutOfStock = (product.stock !== null && Number(product.stock) <= 0) || product.is_available === false;
  const showStockToCustomer = (settings as any)?.show_stock_to_customers ?? true;
  const urgencyThreshold = Number((settings as any)?.stock_urgency_threshold ?? 5);
  const isLowStock =
    showStockToCustomer &&
    !isOutOfStock &&
    product.stock !== null &&
    Number(product.stock) <= urgencyThreshold;

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border shadow-sm transition-colors",
        isOutOfStock ? "opacity-75 bg-muted/20 border-border" : cartItem ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="block relative">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-300",
                !isOutOfStock && "group-hover:scale-105",
                isOutOfStock && "grayscale-30"
              )}
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

        {/* Status / Discount Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isOutOfStock ? (
            <span className="rounded-md bg-rose-600/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              Sold Out
            </span>
          ) : discountPercent > 0 ? (
            <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
              {discountPercent}% OFF
            </span>
          ) : null}
          {isLowStock && !isOutOfStock && (
            <span className="rounded-md bg-amber-500/95 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
              🔥 Only {formatStockDisplay(product.stock, product.unit)} left
            </span>
          )}
        </div>
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
            {isOutOfStock ? (
              <Button
                size="sm"
                variant="secondary"
                disabled
                className="h-8 rounded-xl px-2.5 text-xs opacity-60 cursor-not-allowed"
              >
                Sold Out
              </Button>
            ) : cartItem ? (
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
                        if (product.stock !== null && val > Number(product.stock)) {
                          toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                          setQty(product.id, Number(product.stock));
                        } else {
                          setQty(product.id, val);
                        }
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
                  onClick={() => {
                    if (product.stock !== null && cartItem.qty >= Number(product.stock)) {
                      toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                      return;
                    }
                    setQty(product.id, cartItem.qty + 1);
                  }}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8 rounded-xl px-3 text-xs"
                onClick={() => {
                  if (product.stock !== null && Number(product.stock) <= 0) {
                    toast.error("This product is currently out of stock");
                    return;
                  }
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
