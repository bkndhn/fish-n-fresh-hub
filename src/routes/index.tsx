import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Truck, Waves } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { bannersQuery, categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";

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
  const { data: settings } = useQuery(settingsQuery);

  const featured = (products ?? []).filter((p) => p.is_featured).slice(0, 6);
  const bestsellers = [...(products ?? [])]
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 6);

  return (
    <AppShell>
      <section className="ocean-gradient relative overflow-hidden rounded-3xl px-6 py-10 text-primary-foreground">
        <h1 className="max-w-md text-3xl font-bold">
          {settings?.tagline ?? "Today's catch, at your door"}
        </h1>
        <p className="mt-2 max-w-md text-sm opacity-90">
          Cleaned, cut and packed fresh every morning. Free delivery over ₹
          {settings?.free_delivery_over ?? 500}.
        </p>
        <Button asChild variant="secondary" className="mt-5 rounded-xl">
          <Link to="/catalog">Shop fresh seafood</Link>
        </Button>
      </section>

      <section className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
        {[
          { icon: Waves, label: "Daily catch" },
          { icon: ShieldCheck, label: "Lab tested" },
          { icon: Truck, label: "Same-day delivery" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3">
            <Icon className="mx-auto mb-1 size-5 text-primary" />
            {label}
          </div>
        ))}
      </section>

      {banners && banners.length > 0 && (
        <section className="mt-8">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {banners.map((b) => (
              <div
                key={b.id}
                className="relative min-w-[260px] overflow-hidden rounded-2xl border border-border"
              >
                <img src={b.image_url} alt={b.title} className="h-32 w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                  <p className="text-sm font-semibold">{b.title}</p>
                  {b.subtitle && <p className="text-xs opacity-90">{b.subtitle}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Categories</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.name }}
              className="min-w-[110px] rounded-2xl border border-border bg-card p-3 text-center text-sm"
            >
              {c.image_url && (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="mb-2 h-16 w-full rounded-xl object-cover"
                />
              )}
              {c.name}
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
