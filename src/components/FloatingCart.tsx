import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingCart, ArrowRight } from "lucide-react";
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

  const roundedCount = Math.round(count * 100) / 100;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-5xl px-3 sm:px-4 md:bottom-6 pointer-events-none">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/95 px-4 py-3 text-primary-foreground shadow-2xl pointer-events-auto border border-white/20 animate-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center rounded-2xl bg-white/20 shrink-0 shadow-inner">
            <ShoppingCart className="size-5" />
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-black shadow-xs">
              {items.length}
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-base sm:text-lg font-mono tracking-tight">{inr(subtotal)}</span>
              <span className="text-xs text-primary-foreground/80 font-medium">({roundedCount} {items.length === 1 ? "unit/kg" : "units/kg"})</span>
            </div>
            <p className="text-[11px] text-primary-foreground/75 line-clamp-1">
              {items.slice(0, 2).map((i) => i.name).join(", ")}{items.length > 2 ? ` +${items.length - 2} more` : ""}
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" className="rounded-xl px-4 sm:px-6 shadow-md text-xs sm:text-sm font-bold gap-1.5 hover:scale-102 transition-transform">
          <Link to="/cart">
            <span>Go to Cart</span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
