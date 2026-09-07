import { Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty } = useCart();
  const cartItem = items.find((i) => i.product_id === product.id);

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl border shadow-sm transition-colors",
        cartItem ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="block">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
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
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="font-display font-bold">{inr(Number(product.price))}</span>
            {product.old_price ? (
              <span className="ml-1 text-xs text-muted-foreground line-through">
                {inr(Number(product.old_price))}
              </span>
            ) : null}
          </div>
          
          {cartItem ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-background/50 p-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-6 rounded-lg hover:bg-primary hover:text-primary-foreground"
                onClick={() => setQty(product.id, cartItem.qty - 0.5)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-xs font-medium tabular-nums">
                {cartItem.qty}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 rounded-lg hover:bg-primary hover:text-primary-foreground"
                onClick={() => setQty(product.id, cartItem.qty + 0.5)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => {
                add(product, 0.5);
                toast.success(`${product.name} added to cart`);
              }}
            >
              <Plus className="size-4" /> Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
