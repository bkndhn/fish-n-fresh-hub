import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Store } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/BannerCarousel";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import { getStoreVertical, getVerticalFaqs } from "@/lib/verticals";
import { bannersQuery, categoriesQuery, productsQuery, trustBadgesQuery, settingsQuery } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n";
import { getStoreStatus } from "@/lib/storeSchedule";
import { SeoStructuredData } from "@/components/SeoStructuredData";
import { useCustomerBranch } from "@/lib/customerBranchContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fresh Deliveries to Your Doorstep | Fast & Direct" },
      {
        name: "description",
        content:
          "Order directly online. Express same-day delivery, verified authentic quality, COD and UPI supported.",
      },
      { property: "og:title", content: "Fresh Deliveries to Your Doorstep" },
      {
        property: "og:description",
        content: "Fresh products delivered directly to your doorstep. COD & UPI supported.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { activeBranch, setIsLocationModalOpen } = useCustomerBranch();
  const { data: banners } = useQuery(bannersQuery);
  const { data: categories } = useQuery(categoriesQuery);
  const { data: products } = useQuery(productsQuery(activeBranch?.id));
  const { data: badges } = useQuery(trustBadgesQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { t } = useTranslation();

  const storeStatus = settings ? getStoreStatus(settings) : null;

  const featured = (products ?? []).filter((p) => p.is_featured).slice(0, 6);
  const bestsellers = [...(products ?? [])]
    .sort((a, b) => {
      if (b.is_bestseller && !a.is_bestseller) return 1;
      if (!b.is_bestseller && a.is_bestseller) return -1;
      return Number(b.rating) - Number(a.rating);
    })
    .slice(0, 6);

  const vertical = getStoreVertical(settings);
  const storeName = settings?.store_name || "Our Store";
  const faqs = getVerticalFaqs(vertical.id, storeName);

  return (
    <AppShell>
      <SeoStructuredData
        breadcrumbs={[{ name: "Home", path: "/" }]}
        faqs={faqs}
      />
      <h1 className="sr-only">
        {storeName} — {vertical.name}
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

      {/* Active Hub Express Dispatch Strip */}
      {activeBranch && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="size-4 text-primary shrink-0" />
            <div className="truncate">
              <span className="text-muted-foreground">Delivering from </span>
              <span className="font-bold text-foreground">{activeBranch.name}</span>
              <span className="text-muted-foreground hidden sm:inline"> · {vertical.badgeText}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
          >
            Change
          </button>
        </div>
      )}

      <BannerCarousel banners={banners ?? []} />

      <div className="mt-4">
        <TrustBadges badges={badges ?? []} />
      </div>

      {/* Image-Based Category Showcase with Horizontal Smooth Scrolling */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.categories")}</h2>
          <Link to="/catalog" preload="intent" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <span>{t("home.view_all")}</span>
            <span>&rarr;</span>
          </Link>
        </div>
        <div 
          className="flex gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar scrollbar-none scroll-smooth -mx-1 px-1 touch-pan-x"
          onWheel={(e) => {
            if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {/* All Catalog Card */}
          <Link
            to="/catalog"
            preload="intent"
            className="group flex min-w-[76px] flex-col items-center gap-1.5 text-center text-xs transition-transform active:scale-95 shrink-0"
          >
            <span className="size-16 overflow-hidden rounded-full border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center shadow-xs group-hover:border-primary group-hover:bg-primary/10 group-hover:shadow-md transition-all duration-200">
              <span className="text-xl">{vertical.emoji}</span>
            </span>
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
              All Items
            </span>
          </Link>

          {[...(categories ?? [])]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((c) => (
              <Link
                key={c.id}
                to="/catalog"
                search={{ category: c.name }}
                preload="intent"
                className="group flex min-w-[76px] flex-col items-center gap-1.5 text-center text-xs transition-transform active:scale-95 shrink-0"
              >
                <span className="size-16 overflow-hidden rounded-full border border-border/80 bg-card shadow-xs group-hover:border-primary group-hover:shadow-md transition-all duration-200">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <span className="size-full flex items-center justify-center bg-muted text-muted-foreground font-bold">
                      {c.name.slice(0, 1)}
                    </span>
                  )}
                </span>
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2 max-w-[80px]">
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
