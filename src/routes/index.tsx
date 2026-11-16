import { HomeSearchBar } from "@/components/HomeSearchBar";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { Clock, Store, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/BannerCarousel";
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
import type { SiteSettings, Product } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { StickyCategoryBar } from "@/components/StickyCategoryBar";
import { HomeShelf } from "@/components/home/HomeShelf";
import { RepeatLastOrder } from "@/components/home/RepeatLastOrder";
import { normalizeHomeLayout, recentProducts, HOME_SECTION_LABELS } from "@/lib/homeLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fish N Fresh — Fresh Seafood & Meat Delivered in 35 Minutes" },
      {
        name: "description",
        content:
          "Buy dock-fresh fish, prawns, crab and premium meat online. Ice-packed, chemical-free, same-day express delivery or store pickup. COD and UPI accepted.",
      },
      { name: "keywords", content: "fresh fish online, seafood delivery, prawns, crab, meat delivery, fish shop near me" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "Fish N Fresh" },
      { property: "og:title", content: "Fish N Fresh — Fresh Seafood & Meat Delivered in 35 Minutes" },
      {
        property: "og:description",
        content: "Dock-fresh seafood and premium meat, ice-packed and delivered to your doorstep. COD & UPI supported.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:url", content: "https://fishnfresh.lovable.app/" },
      { property: "og:image", content: "https://fishnfresh.lovable.app/icons/icon-maskable-512.png" },
      { property: "og:image:alt", content: "Fish N Fresh — fresh seafood and meat delivery" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Fish N Fresh — Fresh Seafood & Meat Delivered in 35 Minutes" },
      {
        name: "twitter:description",
        content: "Dock-fresh seafood and premium meat, ice-packed and delivered to your doorstep. COD & UPI supported.",
      },
      { name: "twitter:image", content: "https://fishnfresh.lovable.app/icons/icon-maskable-512.png" },
      // Local search signals
      { name: "geo.region", content: "IN-TN" },
      { name: "geo.placename", content: "Tirupur, Tamil Nadu" },
      { name: "ICBM", content: "11.1085, 77.3411" },
    ],
    links: [{ rel: "canonical", href: "https://fishnfresh.lovable.app/" }],
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
  const categoryShowcaseRef = useRef<HTMLElement>(null);
  const [showCategoryPills, setShowCategoryPills] = useState(false);
  useEffect(() => {
    const el = categoryShowcaseRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowCategoryPills(!!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
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

  const featured = (products ?? []).filter((p) => p.is_featured).slice(0, 12);
  const bestsellers = [...(products ?? [])]
    .sort((a, b) => {
      if (b.is_bestseller && !a.is_bestseller) return 1;
      if (!b.is_bestseller && a.is_bestseller) return -1;
      return Number(b.rating) - Number(a.rating);
    })
    .slice(0, 12);

  const topRated = useMemo(
    () => [...(products ?? [])].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0)).slice(0, 10),
    [products],
  );
  const homeLayout = useMemo(() => normalizeHomeLayout((settings as { home_layout?: unknown } | undefined)?.home_layout), [settings]);
  const recent = useMemo(
    () => recentProducts((products ?? []) as (Product & { updated_at?: string })[], homeLayout.recentMode, homeLayout.recentDays).slice(0, 12),
    [products, homeLayout],
  );
  const pinned = useMemo(
    () => homeLayout.pinnedProductIds.map((id) => (products ?? []).find((p) => p.id === id)).filter(Boolean) as Product[],
    [products, homeLayout],
  );
  const deals = useMemo(
    () => (products ?? []).filter((p) => p.old_price && Number(p.old_price) > Number(p.price)).slice(0, 12),
    [products],
  );

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

      <Link to="/offers" className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-primary-foreground shadow-md">
        <span className="text-xs font-bold">🎉 Launch Offer · Free delivery days</span>
        <span className="text-[11px] font-semibold underline">See offer</span>
      </Link>
      <Link to="/standee" className="mb-3 -mt-1 block text-center text-[11px] font-semibold text-primary underline">
        Visit our shop · hours, address & WhatsApp
      </Link>

      {/* Active Hub Express Dispatch Strip */}
      {activeBranch && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="size-4 text-primary shrink-0" />
            <div className="truncate">
              <span className="text-muted-foreground">Delivering from </span>
              <span className="font-bold text-foreground">{activeBranch.name}</span>
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

      <HomeSearchBar />

      <BannerCarousel banners={banners ?? []} />


      {whatsAppNumber && (
        <WhatsAppOrderDialog
          open={whatsAppOpen}
          onOpenChange={setWhatsAppOpen}
          items={cartItems.map((i) => ({
            productId: i.product_id,
            name: i.name,
            cutPreference: i.cut_preference || undefined,
            qty: i.qty,
            unit: i.unit || "unit",
            price: i.price,
            totalPrice: i.price * i.qty,
          }))}
          subtotal={cartSubtotal}
          deliveryFee={Number(settings?.delivery_fee ?? 0)}
          settings={(settings ?? null) as SiteSettings | null}
        />
      )}




      {/* Category Showcase with Horizontal Smooth Scrolling */}
      <section ref={categoryShowcaseRef} className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">{t("home.categories")}</h2>
          <Link to="/catalog" preload="intent" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            <span>{t("home.view_all")}</span>
            <span>&rarr;</span>
          </Link>
        </div>
        <div 
          className="flex gap-4 overflow-x-auto pb-1 pt-1 no-scrollbar scrollbar-none scroll-smooth -mx-1 px-1 touch-pan-x"
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

      {/* Slim pill bar that stays pinned at top while scrolling (same as Catalog) */}
      {showCategoryPills && (
        <div className="fixed inset-x-0 top-14 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
          <StickyCategoryBar
            className="!static"
            categories={categories ?? []}
            selectedCategory={undefined}
            onSelectCategory={(catName) =>
              navigate({ to: "/catalog", search: catName ? { category: catName } : {} } as any)
            }
          />
        </div>
      )}

      {homeLayout.sections.filter((s) => s.enabled).map((sec) => {
        const title = sec.title || HOME_SECTION_LABELS[sec.id];
        switch (sec.id) {
          case "repeat_order":
            return <RepeatLastOrder key={sec.id} title={title} />;
          case "recent":
            return (
              <HomeShelf key={sec.id} title={title} products={recent}
                subtitle={homeLayout.recentMode === "edited" ? "Recently updated items" : "Newly added to the shop"}
                badge={<span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>} />
            );
          case "pinned":
            return <HomeShelf key={sec.id} title={title} products={pinned} />;
          case "featured":
            return <HomeShelf key={sec.id} title={title} products={featured} />;
          case "deals":
            return <HomeShelf key={sec.id} title={title} products={deals}
              badge={<span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">% OFF</span>} />;
          case "top_rated":
            return <HomeShelf key={sec.id} title={title} products={topRated} subtitle="Verified customer reviews" />;
          case "bestsellers":
            return <HomeShelf key={sec.id} title={title} products={bestsellers} />;
          case "collections":
            return (customCollections ?? []).map((col) => {
              const refs = [...(col.collection_products || [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
              const list = refs.map((r: any) => (products ?? []).find((p) => p.id === r.product_id)).filter(Boolean) as Product[];
              return <HomeShelf key={col.id} title={col.name} products={list} />;
            });
        }
      })}
      <div className="mt-10 space-y-3 border-t pt-6">
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
      </div>
    </AppShell>
  );
}
