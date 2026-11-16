import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

/** Blinkit-style horizontal snap carousel of product cards. */
export function HomeShelf({ title, subtitle, badge, products }: { title: string; subtitle?: string; badge?: ReactNode; products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-extrabold tracking-tight">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <Link to="/catalog" className="shrink-0 text-xs font-semibold text-primary">See all &rarr;</Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
