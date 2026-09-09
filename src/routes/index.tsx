import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/BannerCarousel";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import { QualityPromiseBanner } from "@/components/QualityPromiseBanner";
import { getVerticalConfig } from "@/lib/verticals";
import { bannersQuery, categoriesQuery, productsQuery, trustBadgesQuery, settingsQuery } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n";
import { getStoreStatus } from "@/lib/storeSchedule";

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
  const { data: settings } = useQuery(settingsQuery);
  const { t } = useTranslation();

  const storeStatus = settings ? getStoreStatus(settings) : null;

  const featured = (products ?? []).filter((p) => p.is_featured).slice(0, 6);
  const bestsellers = [...(products ?? [])]
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 6);

  const vertical = getVerticalConfig(settings?.business_vertical);

  return (
    <AppShell>
      <h1 className="sr-only">
        {settings?.store_name || "Fish N Fresh"} — {vertical.name}
      </h1>

      {storeStatus && !storeStatus.isOpen && (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs ${
            storeStatus.canAcceptOrder
              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Clock className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {storeStatus.statusTitle}{" "}
                {storeStatus.canAcceptOrder && "· Pre-Orders Open"}
              </p>
              <p className="opacity-90">{storeStatus.statusDescription}</p>
            </div>
          </div>
          {storeStatus.canAcceptOrder && (
            <Button asChild size="sm" className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-8">
              <Link to="/catalog">Order Ahead</Link>
            </Button>
          )}
        </div>
      )}

      <BannerCarousel banners={banners ?? []} />

      <div className="mt-4">
        <TrustBadges badges={badges ?? []} />
      </div>

      <QualityPromiseBanner className="mt-4" verticalEmoji={vertical.emoji} />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.categories")}</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">Scroll or swipe to explore &rarr;</span>
        </div>
        <div 
          className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scrollbar-none scroll-smooth -mx-1 px-1"
          onWheel={(e) => {
            if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.name }}
              className="group flex min-w-[76px] flex-col items-center gap-1.5 text-center text-xs transition-transform active:scale-95 shrink-0"
            >
              <span className="size-16 overflow-hidden rounded-full border border-border/80 bg-card shadow-xs group-hover:border-primary group-hover:shadow-md transition-all duration-200">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} loading="lazy" decoding="async" className="size-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <span className="size-full flex items-center justify-center bg-muted text-muted-foreground font-bold">
                    {c.name.slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.featured")}</h2>
          <Link to="/catalog" className="text-sm font-semibold text-primary">
            {t("home.view_all")} &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.bestsellers")}</h2>
          <Link to="/catalog" className="text-sm font-semibold text-primary">
            {t("home.view_all")} &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {bestsellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
