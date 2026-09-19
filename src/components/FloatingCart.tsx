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
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/95 px-3 py-2.5 sm:px-4 sm:py-3 text-primary-foreground shadow-2xl pointer-events-auto border border-white/20 animate-in slide-in-from-bottom-3 duration-300 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="relative flex size-9 sm:size-10 items-center justify-center rounded-2xl bg-white/20 shrink-0 shadow-inner">
            <ShoppingCart className="size-4.5 sm:size-5" />
            <span className="absolute -top-1 -right-1 flex size-4.5 sm:size-5 items-center justify-center rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-black shadow-xs">
              {items.length}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-extrabold text-sm sm:text-base md:text-lg font-mono tracking-tight whitespace-nowrap">{inr(subtotal)}</span>
              <span className="text-[11px] sm:text-xs text-primary-foreground/80 font-medium whitespace-nowrap">({roundedCount} {items.length === 1 ? "unit/kg" : "units/kg"})</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-primary-foreground/75 truncate">
              {items.slice(0, 2).map((i) => i.name).join(", ")}{items.length > 2 ? ` +${items.length - 2} more` : ""}
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" className="shrink-0 rounded-xl px-3 sm:px-5 shadow-md text-xs sm:text-sm font-bold gap-1 sm:gap-1.5 hover:scale-102 transition-transform h-8.5 sm:h-10">
          <Link to="/cart">
            <span className="whitespace-nowrap">Go to Cart</span>
            <ArrowRight className="size-3.5 sm:size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
