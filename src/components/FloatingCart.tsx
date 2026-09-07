import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";

export function FloatingCart() {
  const { items, count, subtotal } = useCart();

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-5xl px-4 md:bottom-6">
      <div className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/20">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {count} {count === 1 ? "Item" : "Items"}
            </p>
            <p className="font-display font-bold">{inr(subtotal)}</p>
          </div>
        </div>
        <Button asChild variant="secondary" className="rounded-xl px-6 shadow-sm">
          <Link to="/cart">Go to Cart</Link>
        </Button>
      </div>
    </div>
  );
}
