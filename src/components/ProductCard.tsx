import { Link } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Link to="/product/$id" params={{ id: product.id }} className="block">
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
      </Link>
      <div className="space-y-1 p-3">
        <Link to="/product/$id" params={{ id: product.id }} className="block">
          <h3 className="line-clamp-1 text-sm font-semibold">{product.name}</h3>
          {product.name_tamil && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{product.name_tamil}</p>
          )}
        </Link>
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
          <Button
            size="sm"
            className="rounded-xl"
            onClick={() => {
              add(product);
              toast.success(`${product.name} added to cart`);
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
