import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/queries";

type Search = { category?: string };

export const Route = createFileRoute("/catalog")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    category: typeof search['category'] === "string" ? (search['category'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Seafood Catalog — Fish N Fresh" },
      {
        name: "description",
        content: "Browse fresh fish, prawns, crab and squid by category. Search in English or Tamil.",
      },
      { property: "og:title", content: "Seafood Catalog — Fish N Fresh" },
      { property: "og:description", content: "Browse and order fresh seafood by category." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/catalog" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "price-asc" | "price-desc">("name");
  const { data: products } = useQuery(productsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const filtered = (products ?? [])
    .filter((p) => (category ? p.category === category : true))
    .filter((p) =>
      q
        ? `${p.name} ${p.name_tamil ?? ""}`.toLowerCase().includes(q.toLowerCase())
        : true,
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? Number(a.price) - Number(b.price)
        : sort === "price-desc"
          ? Number(b.price) - Number(a.price)
          : a.name.localeCompare(b.name),
    );

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Catalog</h1>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search seafood…"
        className="mt-3 rounded-xl"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={category ? "outline" : "default"}
          className="rounded-full"
          onClick={() => navigate({ search: {} })}
        >
          All
        </Button>
        {(categories ?? []).map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={category === c.name ? "default" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => navigate({ search: { category: c.name } })}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 text-xs">
        {(["name", "price-asc", "price-desc"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full border px-3 py-1 ${sort === s ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {s === "name" ? "A–Z" : s === "price-asc" ? "Price ↑" : "Price ↓"}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No products found.</p>
      )}
    </AppShell>
  );
}
