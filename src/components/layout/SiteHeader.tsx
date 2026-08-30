import { Link } from "@tanstack/react-router";
import { Fish, Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const { count } = useCart();
  return (
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="ocean-gradient flex size-8 items-center justify-center rounded-xl text-primary-foreground">
            <Fish className="size-4" />
          </span>
          Fish N Fresh
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            to="/catalog"
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Browse catalog"
          >
            <Search className="size-5" />
          </Link>
          <Link to="/cart" className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cart">
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
