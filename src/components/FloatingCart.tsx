import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";

export function FloatingCart() {
  const { items, count, subtotal } = useCart();
  const location = useLocation();

  // Suppress floating cart on Cart, Checkout, or Admin routes
  if (
    items.length === 0 ||
    location.pathname === "/cart" ||
    location.pathname === "/checkout" ||
    location.pathname.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-5xl px-3 sm:px-4 md:bottom-6 pointer-events-none">
      <div className="flex items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-2xl pointer-events-auto border border-white/15 animate-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/20 shrink-0">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-xs sm:text-sm">
              {count} {count === 1 ? "Item" : "Items"}
            </p>
            <p className="font-display font-bold text-sm sm:text-base">{inr(subtotal)}</p>
          </div>
        </div>
        <Button asChild variant="secondary" className="rounded-xl px-5 sm:px-6 shadow-sm text-xs sm:text-sm font-bold">
          <Link to="/cart">Go to Cart</Link>
        </Button>
      </div>
    </div>
  );
}
