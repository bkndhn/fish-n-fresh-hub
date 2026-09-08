import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { categoriesQuery, productsQuery } from "@/lib/queries";

type Search = { category?: string | undefined };

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

import {
  SlidersHorizontal,
  X,
  Sparkles,
  Check,
  RotateCcw,
  Search as SearchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PriceRange = "all" | "under300" | "300-600" | "600-1000" | "above1000";
type SortOption = "featured" | "price-asc" | "price-desc" | "rating" | "discount" | "name";

function Catalog() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/catalog" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortOption>("featured");
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const { data: products } = useQuery(productsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const activeFilterCount =
    (category ? 1 : 0) +
    (priceRange !== "all" ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    (unitFilter !== "all" ? 1 : 0) +
    (sort !== "featured" ? 1 : 0);

  const clearAllFilters = () => {
    navigate({ search: {} });
    setPriceRange("all");
    setInStockOnly(false);
    setDiscountOnly(false);
    setUnitFilter("all");
    setSort("featured");
    setQ("");
  };

  const filtered = (products ?? [])
    .filter((p) => (category ? p.category === category : true))
    .filter((p) =>
      q
        ? `${p.name} ${p.name_tamil ?? ""} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase())
        : true,
    )
    .filter((p) => {
      const price = Number(p.price);
      if (priceRange === "under300") return price < 300;
      if (priceRange === "300-600") return price >= 300 && price <= 600;
      if (priceRange === "600-1000") return price >= 600 && price <= 1000;
      if (priceRange === "above1000") return price > 1000;
      return true;
    })
    .filter((p) => {
      if (inStockOnly) {
        return p.is_available && (p.stock === null || Number(p.stock) > 0);
      }
      return true;
    })
    .filter((p) => {
      if (discountOnly) {
        return p.old_price && Number(p.old_price) > Number(p.price);
      }
      return true;
    })
    .filter((p) => {
      if (unitFilter === "all") return true;
      return (p.unit || "").toLowerCase().includes(unitFilter.toLowerCase());
    })
    .sort((a, b) => {
      if (sort === "price-asc") return Number(a.price) - Number(b.price);
      if (sort === "price-desc") return Number(b.price) - Number(a.price);
      if (sort === "rating") return Number(b.rating ?? 0) - Number(a.rating ?? 0);
      if (sort === "discount") {
        const discA = a.old_price ? Number(a.old_price) - Number(a.price) : 0;
        const discB = b.old_price ? Number(b.old_price) - Number(b.price) : 0;
        return discB - discA;
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0; // "featured" keeps default sort
    });

  return (
    <AppShell>
      {/* Header & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Seafood Catalog</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Fresh coastal catch, cut to order & packed in chill ice
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border">
            {filtered.length} {filtered.length === 1 ? "Catch" : "Catches"}
          </span>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fish, prawns, crab, or Tamil name (e.g. Vanjaram, Nethili)…"
            className="pl-10 h-11 rounded-2xl bg-card border-border shadow-xs text-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills (No Scrollbar Line, Smooth Wheel/Swipe) */}
      <div 
        className="mt-3 flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scrollbar-none scroll-smooth -mx-1 px-1"
        onWheel={(e) => {
          if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        <Button
          size="sm"
          variant={category ? "outline" : "default"}
          className="rounded-full text-xs font-semibold h-8 shrink-0 shadow-xs"
          onClick={() => navigate({ search: {} })}
        >
          All
        </Button>
        {(categories ?? []).map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={category === c.name ? "default" : "outline"}
            className="rounded-full text-xs font-semibold h-8 whitespace-nowrap shrink-0 shadow-xs"
            onClick={() => navigate({ search: { category: c.name } })}
          >
            {c.name}
          </Button>
        ))}
      </div>

      {/* Quick Filter Bar + Advance Filter Modal Trigger */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div 
          className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scrollbar-none scroll-smooth text-xs"
          onWheel={(e) => {
            if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          {/* Advanced Filter Modal Trigger */}
          <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? "default" : "outline"}
                size="sm"
                className="h-7 rounded-full text-xs gap-1 px-3 shrink-0 font-medium"
              >
                <SlidersHorizontal className="size-3" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px] rounded-full bg-background text-foreground">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-primary" />
                    Advanced Filters
                  </span>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                    >
                      <RotateCcw className="size-3 mr-1" /> Reset All
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Sort Order */}
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sort By</Label>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[
                      { id: "featured", label: "✨ Featured Catch" },
                      { id: "price-asc", label: "💰 Price: Low to High" },
                      { id: "price-desc", label: "💎 Price: High to Low" },
                      { id: "rating", label: "⭐ Highest Rated" },
                      { id: "discount", label: "🔥 Biggest Discount" },
                      { id: "name", label: "🔤 Name: A to Z" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSort(opt.id as SortOption)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs text-left font-medium transition-colors ${
                          sort === opt.id
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sort === opt.id && <Check className="size-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price Budget</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: "All Prices" },
                      { id: "under300", label: "Under ₹300" },
                      { id: "300-600", label: "₹300 – ₹600" },
                      { id: "600-1000", label: "₹600 – ₹1,000" },
                      { id: "above1000", label: "Premium (₹1,000+)" },
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setPriceRange(tier.id as PriceRange)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          priceRange === tier.id
                            ? "border-primary bg-primary text-primary-foreground font-bold"
                            : "border-border text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stock & Offer Toggles */}
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Availability & Deals</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInStockOnly(!inStockOnly)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium ${
                        inStockOnly
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold"
                          : "border-border text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span>⚡ In Stock Only</span>
                      {inStockOnly && <Check className="size-3.5 text-emerald-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountOnly(!discountOnly)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium ${
                        discountOnly
                          ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold"
                          : "border-border text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span>🔥 On Sale / Deals</span>
                      {discountOnly && <Check className="size-3.5 text-amber-600" />}
                    </button>
                  </div>
                </div>

                {/* Unit Filter */}
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Packaging Unit</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: "All Units" },
                      { id: "kg", label: "Per Kg (Kilogram)" },
                      { id: "g", label: "Per Gram (250g/500g)" },
                      { id: "pc", label: "Per Piece / Pack" },
                    ].map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setUnitFilter(u.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          unitFilter === u.id
                            ? "border-primary bg-primary text-primary-foreground font-bold"
                            : "border-border text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => setFilterModalOpen(false)}
                  >
                    View {filtered.length} {filtered.length === 1 ? "Result" : "Results"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Quick Filter Pill: In Stock */}
          <button
            type="button"
            onClick={() => setInStockOnly(!inStockOnly)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 transition-colors ${
              inStockOnly
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            ⚡ In Stock
          </button>

          {/* Quick Filter Pill: Under ₹500 */}
          <button
            type="button"
            onClick={() => setPriceRange(priceRange === "under300" ? "all" : "under300")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 transition-colors ${
              priceRange === "under300"
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Under ₹300
          </button>

          {/* Quick Filter Pill: On Sale */}
          <button
            type="button"
            onClick={() => setDiscountOnly(!discountOnly)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 transition-colors ${
              discountOnly
                ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            🔥 Deals
          </button>

          {/* Quick Sort Tabs */}
          {(["price-asc", "price-desc", "rating"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(sort === s ? "featured" : s)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 transition-colors ${
                sort === s
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "price-asc" ? "Price ↑" : s === "price-desc" ? "Price ↓" : "⭐ Top Rated"}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Active:</span>
          {category && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
              {category}
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => navigate({ search: {} })}
              />
            </span>
          )}
          {priceRange !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium text-foreground">
              {priceRange === "under300" ? "Under ₹300" : priceRange === "300-600" ? "₹300 – ₹600" : priceRange === "600-1000" ? "₹600 – ₹1,000" : "Premium (₹1,000+)"}
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => setPriceRange("all")}
              />
            </span>
          )}
          {inStockOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              In Stock Only
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => setInStockOnly(false)}
              />
            </span>
          )}
          {discountOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              Deals Only
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => setDiscountOnly(false)}
              />
            </span>
          )}
          {unitFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium text-foreground">
              Unit: {unitFilter}
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => setUnitFilter("all")}
              />
            </span>
          )}
          {sort !== "featured" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border px-2.5 py-0.5 text-xs font-medium text-foreground">
              Sort: {sort}
              <X
                className="size-3 cursor-pointer hover:opacity-75"
                onClick={() => setSort("featured")}
              />
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Product Cards Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold text-base">No catches matched your filters</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your budget or category filters, or request any rare fish and our harbour crew will source it!
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={clearAllFilters}>
              Reset All Filters
            </Button>
            <RequestFishDialog defaultQuery={q} />
          </div>
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border p-4 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="font-semibold text-sm">Looking for a specific fish not listed?</p>
            <p className="text-xs text-muted-foreground">Request any seasonal or rare catch and we'll get it for you.</p>
          </div>
          <RequestFishDialog />
        </div>
      )}
    </AppShell>
  );
}

function RequestFishDialog({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState(defaultQuery);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || phone.length < 10) {
      toast.error("Please enter the fish name and your 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("product_requests").insert({
        product_name: productName.trim(),
        customer_name: name.trim() || null,
        customer_phone: phone.replace(/\D/g, ""),
        notes: notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Request received! We'll message you when this catch arrives.");
      setOpen(false);
      setProductName("");
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl shrink-0">
          Request Special Catch
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Fish Variety</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="req-prod">Fish / Seafood Name *</Label>
            <Input
              id="req-prod"
              required
              placeholder="e.g. Mud Crab, Lobster, White Pomfret..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="req-name">Your Name</Label>
              <Input
                id="req-name"
                placeholder="Ravi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-phone">Phone *</Label>
              <Input
                id="req-phone"
                required
                inputMode="numeric"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-notes">Quantity or Specific Cut Requirement</Label>
            <Input
              id="req-notes"
              placeholder="e.g. Need ~2kg for Sunday lunch, curry cut"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
