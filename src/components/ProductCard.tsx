import { useState, useEffect } from "react";
import { Minus, Plus, Star, Fish, Zap, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr, formatStockDisplay } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { optimizeImageUrl } from "@/lib/imageOptimizer";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty, remove } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);
  const { data: settings } = useQuery(settingsQuery);

  const [localQtyStr, setLocalQtyStr] = useState<string>(() => (cartItem ? String(cartItem.qty) : "1"));

  useEffect(() => {
    if (cartItem) {
      setLocalQtyStr(String(cartItem.qty));
    }
  }, [cartItem?.qty]);

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
        "group overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 relative",
        isOutOfStock
          ? "opacity-75 bg-muted/20 border-border"
          : cartItem
          ? "border-primary ring-2 ring-primary/50 bg-primary/5 dark:bg-primary/10 shadow-md"
          : "border-border bg-card hover:border-primary/40 hover:shadow-md"
      )}
    >
      <div className="block relative">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {product.image_url ? (
            <img
              src={optimizeImageUrl(product.image_url, { width: 500, quality: 75 })}
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

        {/* Top Right: In-Cart Badge or Express SLA */}
        {cartItem ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="rounded-lg bg-primary text-primary-foreground pl-2 pr-1.5 py-0.5 text-[10px] font-bold shadow-md flex items-center gap-1.5 border border-white/20 animate-in fade-in">
              <span>✓ In Cart: {cartItem.qty} {product.unit || "kg"}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(product.id);
                  toast.success(`Removed "${product.name}" from cart`);
                }}
                className="size-3.5 rounded-full bg-white/20 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Remove from cart"
                aria-label={`Remove ${product.name} from cart`}
              >
                <X className="size-2.5" />
              </button>
            </span>
          </div>
        ) : !isOutOfStock && ((settings as any)?.express_delivery_enabled ?? true) ? (
          <div className="absolute top-2 right-2">
            <span className="rounded-md bg-black/65 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 flex items-center gap-0.5 shadow-xs border border-white/10">
              <Zap className="size-2.5 fill-amber-400 text-amber-400" />
              {(settings as any)?.express_sla_mins || 35}m
            </span>
          </div>
        ) : null}
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
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display text-sm sm:text-base font-bold text-foreground">
                {inr(Number(product.price))}
              </span>
              {!cartItem && hasDiscount && (
                <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground line-through whitespace-nowrap">
                  {inr(Number(product.old_price))}
                </span>
              )}
            </div>
            {!cartItem && hasDiscount && (
              <div className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap leading-tight mt-0.5">
                Save {inr(Number(product.old_price) - Number(product.price))}
              </div>
            )}
          </div>
          
          <div className="shrink-0">
            {isOutOfStock ? (
              <Button
                size="sm"
                variant="secondary"
                disabled
                className="h-7 rounded-full px-2.5 text-[11px] font-bold opacity-60 cursor-not-allowed"
              >
                Sold Out
              </Button>
            ) : cartItem ? (
              <div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 dark:bg-primary/20 p-0.5 shadow-2xs">
                {(() => {
                  const isWeighted = (product.unit || "").toLowerCase().includes("kg") || (product.unit || "").toLowerCase() === "g";
                  const step = isWeighted ? (cartItem.qty <= 1 ? 0.25 : 0.5) : 1;
                  const isAtMin = cartItem.qty <= step;

                  return (
                    <button
                      type="button"
                      className={`size-5.5 sm:size-6 rounded-full flex items-center justify-center transition-all active:scale-85 shadow-2xs cursor-pointer ${
                        isAtMin
                          ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                      onClick={() => {
                        const next = Math.max(0, Math.round((cartItem.qty - step) * 100) / 100);
                        if (next <= 0) {
                          remove(product.id);
                          toast.success(`Removed "${product.name}" from cart`);
                        } else {
                          setQty(product.id, next);
                        }
                      }}
                      title={isAtMin ? "Remove from cart" : "Decrease quantity"}
                    >
                      {isAtMin ? (
                        <Trash2 className="size-3 stroke-[2.2]" />
                      ) : (
                        <Minus className="size-3 stroke-[2.5]" />
                      )}
                    </button>
                  );
                })()}

                <input
                  type="text"
                  inputMode="decimal"
                  value={localQtyStr}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text === "" || /^\d*\.?\d*$/.test(text)) {
                      setLocalQtyStr(text);
                      const val = parseFloat(text);
                      if (!isNaN(val) && val > 0) {
                        if (product.stock !== null && val > Number(product.stock)) {
                          toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                          setQty(product.id, Number(product.stock));
                          setLocalQtyStr(String(product.stock));
                        } else {
                          setQty(product.id, val);
                        }
                      }
                    }
                  }}
                  onBlur={() => {
                    const val = parseFloat(localQtyStr);
                    if (isNaN(val) || val <= 0) {
                      setLocalQtyStr(String(cartItem.qty));
                    } else if (product.stock !== null && val > Number(product.stock)) {
                      setQty(product.id, Number(product.stock));
                      setLocalQtyStr(String(product.stock));
                    }
                  }}
                  className="w-6.5 sm:w-7 bg-transparent text-center text-[11px] sm:text-xs font-black font-mono outline-none text-primary dark:text-primary-foreground select-all p-0 leading-none"
                  title="Type custom quantity"
                />

                <button
                  type="button"
                  className="size-5.5 sm:size-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-all active:scale-85 shadow-2xs cursor-pointer"
                  onClick={() => {
                    const isWeighted = (product.unit || "").toLowerCase().includes("kg") || (product.unit || "").toLowerCase() === "g";
                    const step = isWeighted ? 0.5 : 1;
                    if (product.stock !== null && cartItem.qty + step > Number(product.stock)) {
                      toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                      return;
                    }
                    setQty(product.id, Math.round((cartItem.qty + step) * 100) / 100);
                  }}
                  title="Increase quantity"
                >
                  <Plus className="size-3 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-7 sm:h-7.5 rounded-full px-3 text-xs font-bold shadow-2xs hover:shadow-xs active:scale-95 transition-all"
                onClick={() => {
                  if (product.stock !== null && Number(product.stock) <= 0) {
                    toast.error("This product is currently out of stock");
                    return;
                  }
                  add(product, 1);
                  toast.success(`${product.name} added to cart`);
                }}
              >
                <Plus className="mr-1 size-3 stroke-[2.5]" /> Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
