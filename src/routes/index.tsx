import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Store, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/BannerCarousel";
import { TrustBadges } from "@/components/TrustBadges";
import { ProductCard } from "@/components/ProductCard";
import { AiPicksDialog } from "@/components/AiPicksDialog";
import { WhatsAppOrderDialog } from "@/components/WhatsAppOrderDialog";

import { getStoreVertical, getVerticalFaqs } from "@/lib/verticals";
import { bannersQuery, categoriesQuery, productsQuery, trustBadgesQuery, settingsQuery } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n";
import { getStoreStatus } from "@/lib/storeSchedule";
import { SeoStructuredData } from "@/components/SeoStructuredData";
import { useCustomerBranch } from "@/lib/customerBranchContext";
import { useCart } from "@/lib/cart";
import type { SiteSettings } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const { items: cartItems, subtotal: cartSubtotal, salesMode, isWholesale: isWholesaleBuyer } = useCart();
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const whatsAppNumber =
    settings?.whatsapp_order_phone || settings?.contact_phone || settings?.whatsapp_number || null;


  const { data: customCollections } = useQuery({
    queryKey: ["home_collections", activeBranch?.id],
    queryFn: async () => {
      let q = supabase
        .from("collections")
        .select(`
          id, name, sort_order,
          collection_products ( product_id, sort_order )
        `)
        .eq("active", true)
        .order("sort_order");
        
      if (activeBranch?.id) {
        q = q.or(`branch_id.eq.${activeBranch.id},branch_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
  });

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

      {salesMode !== "retail" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {salesMode === "wholesale" ? "Bulk orders only" : "Buying in bulk?"}
            </p>
            <p className="text-xs text-muted-foreground break-words">
              {salesMode === "wholesale"
                ? "This shop supplies shops, hotels and caterers. Register once to order at trade rates."
                : "Shops, hotels and caterers get trade rates that drop as the quantity goes up."}
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl shrink-0">
            <Link to="/wholesale">{isWholesaleBuyer ? "My trade account" : "Get trade rates"}</Link>
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Not sure what to buy?</p>
          <p className="text-xs text-muted-foreground break-words">Tell us your taste and we&apos;ll pick from today&apos;s stock.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AiPicksDialog products={products ?? []} branchId={activeBranch?.id ?? null} />
          {whatsAppNumber && (
            <Button
              type="button"
              size="sm"
              onClick={() => (cartItems.length > 0 ? setWhatsAppOpen(true) : navigate({ to: "/catalog" }))}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
            >
              <MessageSquare className="size-4 shrink-0" />
              Order on WhatsApp
            </Button>
          )}
        </div>
      </div>

      {whatsAppNumber && (
        <WhatsAppOrderDialog
          open={whatsAppOpen}
          onOpenChange={setWhatsAppOpen}
          items={cartItems}
          subtotal={cartSubtotal}
          deliveryFee={Number(settings?.delivery_fee ?? 0)}
          settings={(settings ?? null) as SiteSettings | null}
        />
      )}


      <div className="mt-4">
        <TrustBadges badges={badges ?? []} />
      </div>


      {/* Category Showcase with Horizontal Smooth Scrolling */}
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

      {/* Dynamic Custom Collections */}
      {customCollections?.map(col => {
        // Map junction rows to actual product objects, sorted correctly
        const colProductRefs = col.collection_products || [];
        const colProducts = colProductRefs
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((ref: any) => (products ?? []).find(p => p.id === ref.product_id))
          .filter(Boolean);
          
        if (colProducts.length === 0) return null;
        
        return (
          <section key={col.id} className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{col.name}</h2>
              <Link to="/catalog" className="text-sm font-semibold text-primary">
                {t("home.view_all")} &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {colProducts.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.featured")}</h2>
          <Link to="/catalog" className="text-sm font-semibold text-primary">
            {t("home.view_all")} &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {bestsellers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
