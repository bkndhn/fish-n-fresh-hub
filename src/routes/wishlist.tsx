import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/hooks/useWishlist";
import { productsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Saved Items | Fish N Fresh" },
      { name: "description", content: "Your saved fresh seafood favourites, ready to order." },
      { property: "og:title", content: "Saved Items | Fish N Fresh" },
      { property: "og:description", content: "Your saved fresh seafood favourites, ready to order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
      <PageHeader eyebrow="Saved for later" title="Your saved items" subtitle={wishlistProducts.length ? `${wishlistProducts.length} favourite${wishlistProducts.length === 1 ? "" : "s"} ready to order` : "Tap the heart on any product to save it"} icon={<Heart className="size-5 fill-current" />} />

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-pulse">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {wishlistProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
