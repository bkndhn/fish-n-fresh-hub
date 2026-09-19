import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/hooks/useWishlist";
import { productsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Your Wishlist" },
      { name: "description", content: "View your saved products." },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { items: wishlistIds } = useWishlist();
  const { data: allProducts = [], isLoading } = useQuery(productsQuery());

  const wishlistProducts = allProducts.filter((p) => wishlistIds.includes(p.id));

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-6">
        <Heart className="size-6 text-rose-500 fill-rose-500" />
        <h1 className="text-2xl font-bold">Your Saved Items</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[3/4] bg-muted rounded-2xl" />
          ))}
        </div>
      ) : wishlistProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
            <Heart className="size-10 text-rose-500/50" />
          </div>
          <h2 className="text-xl font-bold mb-2">Your wishlist is empty</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Save items you like by tapping the heart icon on any product. They'll be waiting here when you're ready to order!
          </p>
          <Button asChild className="rounded-xl px-8 h-12 font-bold shadow-sm">
            <Link to="/catalog">
              <Search className="size-4 mr-2" />
              Browse Catalog
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlistProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
