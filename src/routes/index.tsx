import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { BannerCarousel } from "@/components/BannerCarousel";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import { bannersQuery, categoriesQuery, productsQuery, trustBadgesQuery } from "@/lib/queries";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fish N Fresh — Fresh Seafood Delivered in Chennai" },
      {
        name: "description",
        content:
          "Order fresh fish, prawns and crab online in Chennai. Same-day delivery, lab-tested quality, COD and UPI payments.",
      },
      { property: "og:title", content: "Fish N Fresh — Fresh Seafood Delivered" },
      {
        property: "og:description",
        content: "Daily-catch seafood delivered to your door in Chennai. COD & UPI supported.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: banners } = useQuery(bannersQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: products } = useQuery(productsQuery);
  const { data: badges } = useQuery(trustBadgesQuery);

  const featured = (products ?? []).filter((p) => p.is_featured).slice(0, 6);
  const bestsellers = [...(products ?? [])]
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 6);

  return (
    <AppShell>
      <h1 className="sr-only">Fish N Fresh — fresh seafood delivered</h1>

      <BannerCarousel banners={banners ?? []} />

      <div className="mt-4">
        <TrustBadges badges={badges ?? []} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Categories</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.name }}
              className="flex min-w-[72px] flex-col items-center gap-1.5 text-center text-xs"
            >
              <span className="size-16 overflow-hidden rounded-full border border-border bg-card">
                {c.image_url && (
                  <img src={c.image_url} alt={c.name} className="size-full object-cover" />
                )}
              </span>
              <span className="line-clamp-1">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>


      <ProductRow title="Best sellers" products={bestsellers} />
      <ProductRow title="Featured" products={featured} />

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">All products</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(products ?? []).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function ProductRow({ title, products }: { title: string; products: ReturnType<typeof Array.prototype.slice> }) {
  if (!products?.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {products.map((p: any) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
