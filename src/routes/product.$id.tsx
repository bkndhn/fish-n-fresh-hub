import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Minus, Plus, ShieldCheck, Star, MessageSquare, Fish, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";
import { inr, formatIST, formatStockDisplay } from "@/lib/format";
import { productQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { ProductAiBenefitsCard } from "@/components/ProductAiBenefitsCard";
import { SeoStructuredData } from "@/components/SeoStructuredData";
import { createSubscription } from "@/lib/subscriptions.functions";
import { useCustomerBranch } from "@/lib/customerBranchContext";
import type { SiteSettings } from '@/lib/types';

const PORTION_CHIPS = [
  { label: "250g", val: 0.25 },
  { label: "500g", val: 0.5 },
  { label: "750g", val: 0.75 },
  { label: "1 kg", val: 1.0 },
  { label: "1.5 kg", val: 1.5 },
  { label: "2 kg", val: 2.0 },
  { label: "3 kg", val: 3.0 },
];

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params, context }: any) => {
    try {
      const product = await context.queryClient.ensureQueryData(productQuery(params.id));
      return { product };
    } catch {
      return { product: null };
    }
  },
  head: ({ loaderData }: any) => {
    const p = loaderData?.product;
    if (!p) {
      return {
        meta: [
          { title: "Fresh Seafood & Farm Meat | Fish N Fresh" },
          { name: "description", content: "Fresh seafood details, nutrition, quality and recipes." },
        ],
      };
    }

    const title = `${p.name} (Fresh ${p.unit}) | Daily Ocean Catch`;
    const desc = p.description || `Order fresh ${p.name} online. 100% chemical-free, lab-tested quality delivered in 35 mins.`;
    const img = p.image_url || "/placeholder.svg";

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: `${p.name} — ₹${p.price}/${p.unit}` },
        { property: "og:description", content: desc },
        { property: "og:image", content: img },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${p.name} — ₹${p.price}/${p.unit}` },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: img },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product, isLoading } = useQuery(productQuery(id));
  const { data: all } = useQuery(productsQuery());
  const { data: settings } = useQuery(settingsQuery);
  const { add, items } = useCart();
  const { activeBranch } = useCustomerBranch();
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const cartItem = items.find((i) => i.product_id === product?.id);

  const navigate = useNavigate();
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [subFrequency, setSubFrequency] = useState<"weekly" | "daily" | "bi_weekly">("weekly");
  const [subDay, setSubDay] = useState<"sunday" | "wednesday" | "friday">("sunday");
  const [subSlot, setSubSlot] = useState("07:00 AM - 09:00 AM (Early Catch)");
  const [subName, setSubName] = useState("");
  const [subPhone, setSubPhone] = useState("");
  const [subAddress, setSubAddress] = useState("");
  const [subCutting, setSubCutting] = useState("Curry Cut");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
    }
  }, [product?.id, product?.variants]);

  useEffect(() => {
    if (product) {
      document.title = `${product.name} | ${settings?.store_name || "Universal Retail Hub"}`;
    }
  }, [product, settings?.store_name]);

  if (isLoading) return <AppShell><p className="py-20 text-center text-muted-foreground">Loading…</p></AppShell>;
  if (!product) return <AppShell><p className="py-20 text-center">Product not found.</p></AppShell>;

  const effectivePrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
  const effectiveStock = selectedVariant ? Number(selectedVariant.stock ?? 0) : (product.stock !== null ? Number(product.stock) : 0);
  const related = (all ?? []).filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  const isOutOfStock = (product.stock !== null && effectiveStock <= 0) || product.is_available === false;
  const showStockToCustomer = (settings as SiteSettings)?.show_stock_to_customers ?? true;
  const urgencyThreshold = Number((settings as SiteSettings)?.stock_urgency_threshold ?? 5);
  const isLowStock =
    showStockToCustomer &&
    !isOutOfStock &&
    product.stock !== null &&
    Number(product.stock) <= urgencyThreshold;

  return (
    <AppShell>
      <SeoStructuredData
        product={product}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Catalog", path: "/catalog" },
          ...(product.category ? [{ name: product.category, path: `/catalog?category=${encodeURIComponent(product.category)}` }] : []),
          { name: product.name, path: `/product/${product.id}` },
        ]}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
              }}
            />
          ) : (
            <div className="aspect-square w-full flex items-center justify-center bg-muted/60 text-muted-foreground">
              <Fish className="size-16 opacity-30" />
            </div>
          )}
        </div>
        <div>
          {/* Brand & Model Header */}
          {(product.brand || product.model_number) && (
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {product.brand && (
                <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary font-black text-xs uppercase tracking-wider border border-primary/20">
                  {product.brand}
                </span>
              )}
              {product.model_number && (
                <span className="text-xs font-mono text-muted-foreground">
                  Model: {product.model_number}
                </span>
              )}
            </div>
          )}

          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.name_tamil && <p className="text-muted-foreground">{product.name_tamil}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Star className="size-4 fill-current text-accent" />
              {Number(product.rating).toFixed(1)}
            </div>
            {product.warranty_period_months && product.warranty_period_months > 0 && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-bold gap-1">
                <ShieldCheck className="size-3" /> {product.warranty_period_months}M Official Warranty
              </Badge>
            )}
            {product.aisle_location && (
              <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1">
                📍 {product.aisle_location}
              </Badge>
            )}
            {product.lab_tested && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" /> Lab tested
              </Badge>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className="font-display text-3xl font-bold">{inr(effectivePrice)}</span>
            {product.old_price && Number(product.old_price) > effectivePrice && (
              <>
                <span className="text-base text-muted-foreground line-through">
                  MRP: {inr(Number(product.old_price))}
                </span>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  {Math.round(((Number(product.old_price) - effectivePrice) / Number(product.old_price)) * 100)}% OFF
                </Badge>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  (Save {inr(Number(product.old_price) - effectivePrice)})
                </span>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">per {product.unit}</p>

          {/* 2D Size & Color Variant Matrix Selection */}
          {product.variants && product.variants.length > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl border border-border bg-card space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Select Size & Color Variant:
                </label>
                <button
                  type="button"
                  onClick={() => setSizeChartOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  📏 Size Guide
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {product.variants.map((v: any) => {
                  const isSelected = (selectedVariant?.id || product.variants?.[0]?.id) === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all border ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 font-bold"
                          : "border-border hover:border-primary/40 bg-muted/30"
                      }`}
                    >
                      <div className="text-foreground">
                        {v.size ? `Size: ${v.size} ` : ""}{v.color ? `· ${v.color}` : ""}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-bold text-primary font-mono">{inr(Number(v.price))}</span>
                        <span>{v.stock > 0 ? `${v.stock} left` : "Sold out"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real-time Urgency / Out of Stock / Inactive Banner */}
          {product.is_available === false ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <span className="size-2 rounded-full bg-rose-500" />
              Item Currently Inactive — Not Available for Ordering
            </div>
          ) : isOutOfStock ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
              <span className="size-2 rounded-full bg-rose-500" />
              Sold out for today — daily fresh catch arrives tomorrow morning
            </div>
          ) : isLowStock ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 animate-pulse">
              <span>🔥 High demand! Only <strong>{formatStockDisplay(product.stock, product.unit)}</strong> remaining in today's harvest</span>
            </div>
          ) : null}

          {product.description && <p className="mt-4 text-sm">{product.description}</p>}

          <div className="mt-5 space-y-3">
            {/* Quick Portion Chips for weight-based items */}
            {(product.unit?.toLowerCase().includes("kg") || product.unit?.toLowerCase() === "g") && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Choose Portion / Weight:</span>
                  <span className="text-xs font-mono text-primary font-bold">{qty} {product.unit}</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PORTION_CHIPS.map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => {
                        setQty(chip.val);
                        setQtyInput(String(chip.val));
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                        qty === chip.val
                          ? "bg-primary text-primary-foreground shadow-xs scale-102"
                          : "bg-muted/60 hover:bg-muted text-foreground border border-border/70"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 bg-card shadow-2xs">
                <button
                  onClick={() => {
                    const isWeighted = (product.unit || "").toLowerCase().includes("kg") || (product.unit || "").toLowerCase() === "g";
                    const step = isWeighted ? (qty <= 1 ? 0.25 : 0.5) : 1;
                    const next = Math.max(isWeighted ? 0.25 : 1, Math.round((qty - step) * 100) / 100);
                    setQty(next);
                    setQtyInput(String(next));
                  }}
                  aria-label="Decrease"
                  disabled={isOutOfStock || qty <= (product.unit?.toLowerCase().includes("kg") ? 0.25 : 1)}
                  className="disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qtyInput}
                  disabled={isOutOfStock}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text === "" || /^\d*\.?\d*$/.test(text)) {
                      setQtyInput(text);
                      const val = parseFloat(text);
                      if (!isNaN(val) && val > 0) {
                        if (product.stock !== null && val > Number(product.stock)) {
                          toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                          setQty(Number(product.stock));
                        } else {
                          setQty(val);
                        }
                      }
                    }
                  }}
                  onBlur={() => {
                    const val = parseFloat(qtyInput);
                    if (isNaN(val) || val <= 0) {
                      setQtyInput(String(qty));
                    } else if (product.stock !== null && val > Number(product.stock)) {
                      setQty(Number(product.stock));
                      setQtyInput(String(product.stock));
                    }
                  }}
                  className="w-14 bg-transparent text-center font-bold font-mono outline-none tabular-nums disabled:opacity-50 text-foreground"
                  placeholder="1.0"
                />
                <span className="text-xs font-bold text-muted-foreground font-mono">{product.unit || "kg"}</span>
                <button
                  onClick={() => {
                    const isWeighted = (product.unit || "").toLowerCase().includes("kg") || (product.unit || "").toLowerCase() === "g";
                    const step = isWeighted ? 0.5 : 1;
                    if (product.stock !== null && qty + step > Number(product.stock)) {
                      toast.error(`Only ${product.stock} ${product.unit} available in stock`);
                      return;
                    }
                    const next = Math.round((qty + step) * 100) / 100;
                    setQty(next);
                    setQtyInput(String(next));
                  }}
                  aria-label="Increase"
                  disabled={isOutOfStock || (product.stock !== null && qty >= Number(product.stock))}
                  className="disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <Button
                className="flex-1 rounded-xl h-11 text-sm font-bold shadow-sm"
                disabled={isOutOfStock}
                onClick={() => {
                  const productWithVariant = {
                    ...product,
                    price: effectivePrice,
                    brand: product.brand ?? null,
                    warranty_period_months: product.warranty_period_months ?? null,
                  } as Product;
                  const res = add(
                    productWithVariant,
                    qty,
                    undefined,
                    activeBranch ? { id: activeBranch.id, name: activeBranch.name } : undefined
                  );
                  if (res?.added) {
                    const variantLabel = selectedVariant ? ` (${selectedVariant.size ? `Size: ${selectedVariant.size} ` : ""}${selectedVariant.color ? `· ${selectedVariant.color}` : ""})` : "";
                    toast.success(`Added ${qty} ${product.unit || "kg"} ${product.name}${variantLabel} to cart!`);
                  }
                }}
              >
                {isOutOfStock ? "Out of Stock" : `Add to cart · ${inr(effectivePrice * qty)}`}
              </Button>
            </div>

            {cartItem && (
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between text-xs animate-in fade-in duration-200">
                <span className="font-semibold text-foreground">
                  ✓ In your cart: <strong>{cartItem.qty} {product.unit}</strong> ({inr(cartItem.price * cartItem.qty)})
                </span>
                <Button asChild size="sm" variant="ghost" className="h-6 text-xs text-primary font-bold">
                  <Link to="/cart">View Cart →</Link>
                </Button>
              </div>
            )}

            {/* Subscribe & Save 5% Card */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-emerald-500 text-white text-xs font-bold">
                    %
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground">Subscribe &amp; Save 5%</span>
                    <span className="ml-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded-md">
                      Weekly Catch
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isOutOfStock}
                  className="rounded-xl h-8 text-xs font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10"
                  onClick={() => setSubscribeModalOpen(true)}
                >
                  Set Schedule
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Get this fresh cut delivered automatically every week with priority harbour dispatch. Pause or cancel anytime in your account.
              </p>
            </div>
          </div>

          {/* Subscribe & Save Modal */}
          <Dialog open={subscribeModalOpen} onOpenChange={setSubscribeModalOpen}>
            <DialogContent className="max-w-md rounded-3xl p-5 bg-card">
              <DialogHeader className="border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Subscribe to Weekly {product.name}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                      Automatic fresh catch dispatch at 5% discount.
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!subPhone || subPhone.length < 10) {
                    toast.error("Please enter a valid 10-digit phone number");
                    return;
                  }
                  if (!subAddress) {
                    toast.error("Please enter your delivery address");
                    return;
                  }

                  try {
                    setIsSubscribing(true);
                    const { data: session } = await supabase.auth.getSession();
                    const userId = session.session?.user?.id;

                    await createSubscription({
                      data: {
                        userId,
                        customerName: subName.trim() || (session.session?.user?.user_metadata?.["name"] as string | undefined) || "Customer",
                        customerPhone: subPhone.trim(),
                        customerEmail: session.session?.user?.email,
                        customerAddress: subAddress.trim(),
                        productId: product.id,
                        productName: product.name,
                        quantity: qty,
                        unit: product.unit || "kg",
                        cuttingStyle: subCutting,
                        frequency: subFrequency,
                        dayOfWeek: subDay,
                        preferredSlot: subSlot,
                        pricePerUnit: Number(product.price),
                      },
                    });

                    toast.success(`Subscribed to weekly ${product.name}!`);
                    setSubscribeModalOpen(false);
                    navigate({ to: "/account" });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to create subscription");
                  } finally {
                    setIsSubscribing(false);
                  }
                }}
                className="space-y-3 pt-2 text-xs"
              >
                <div className="p-2.5 rounded-xl bg-muted/20 border border-border flex items-center justify-between font-mono">
                  <div>
                    <p className="font-bold text-foreground">{product.name} ({qty} {product.unit || "kg"})</p>
                    <p className="text-[11px] text-muted-foreground">Standard: {inr(Number(product.price) * qty)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      5% Discount
                    </span>
                    <p className="font-extrabold text-sm text-foreground">
                      {inr(Math.round(Number(product.price) * qty * 0.95))}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Frequency</Label>
                    <select
                      value={subFrequency}
                      onChange={(e) => setSubFrequency(e.target.value as "daily" | "weekly" | "custom")}
                      className="w-full h-9 rounded-xl border border-border bg-background px-2 text-xs mt-1"
                    >
                      <option value="weekly">Weekly (Recommended)</option>
                      <option value="bi_weekly">Every 2 Weeks</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Delivery Day</Label>
                    <select
                      value={subDay}
                      onChange={(e) => setSubDay(e.target.value as "daily" | "weekly" | "custom")}
                      className="w-full h-9 rounded-xl border border-border bg-background px-2 text-xs mt-1 capitalize"
                    >
                      <option value="sunday">Sunday (Morning Catch)</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="monday">Monday</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Preferred Delivery Slot</Label>
                  <select
                    value={subSlot}
                    onChange={(e) => setSubSlot(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-2 text-xs mt-1"
                  >
                    <option value="07:00 AM - 09:00 AM (Early Catch)">07:00 AM - 09:00 AM (Early Catch)</option>
                    <option value="09:00 AM - 12:00 PM (Lunch Prep)">09:00 AM - 12:00 PM (Lunch Prep)</option>
                    <option value="04:00 PM - 07:00 PM (Evening Dinner)">04:00 PM - 07:00 PM (Evening Dinner)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Your Name</Label>
                    <Input
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="e.g. Ramesh"
                      className="rounded-xl h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Phone Number *</Label>
                    <Input
                      value={subPhone}
                      onChange={(e) => setSubPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="rounded-xl h-9 text-xs mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Delivery Address *</Label>
                  <Textarea
                    value={subAddress}
                    onChange={(e) => setSubAddress(e.target.value)}
                    placeholder="House/flat number, street name, pincode..."
                    rows={2}
                    className="rounded-xl text-xs mt-1"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9"
                    onClick={() => setSubscribeModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubscribing}
                    className="rounded-xl h-9 font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4"
                  >
                    {isSubscribing ? "Subscribing..." : "Confirm Subscription"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {product.calories != null && <Info label="Calories" value={`${product.calories} kcal`} />}
            {product.protein && <Info label="Protein" value={product.protein} />}
            {product.best_for && <Info label="Best for" value={product.best_for} />}
            {product.source_origin && <Info label="Origin" value={product.source_origin} />}
            {product.storage && <Info label="Storage" value={product.storage} />}
            {product.traceability && <Info label="Traceability" value={product.traceability} />}
          </dl>
        </div>
      </div>

      {/* Technical Specifications & Details (For Electronics, Appliances & Fashion) */}
      {product.specifications && Object.keys(product.specifications).length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <h2 className="text-base font-bold flex items-center gap-2 mb-3">
            ⚙️ Technical Specifications & Product Details
          </h2>
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
            {Object.entries(product.specifications).map(([key, val], idx) => (
              <div key={key} className={`flex items-center justify-between p-3 text-xs ${idx % 2 === 0 ? "bg-muted/20" : "bg-card"}`}>
                <span className="font-semibold text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-bold text-foreground text-right">{String(val)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Size Chart Modal */}
      <Dialog open={sizeChartOpen} onOpenChange={setSizeChartOpen}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">📏 Size Guide & Measurements</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Standard body fit guidelines in inches and centimeters for apparel.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/50 font-bold">
                  <th className="p-2">Size</th>
                  <th className="p-2">Chest</th>
                  <th className="p-2">Waist</th>
                  <th className="p-2">Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                <tr><td className="p-2 font-bold">S</td><td className="p-2">38" (96cm)</td><td className="p-2">32" (81cm)</td><td className="p-2">27" (68cm)</td></tr>
                <tr><td className="p-2 font-bold">M</td><td className="p-2">40" (101cm)</td><td className="p-2">34" (86cm)</td><td className="p-2">28" (71cm)</td></tr>
                <tr><td className="p-2 font-bold">L</td><td className="p-2">42" (106cm)</td><td className="p-2">36" (91cm)</td><td className="p-2">29" (74cm)</td></tr>
                <tr><td className="p-2 font-bold">XL</td><td className="p-2">44" (112cm)</td><td className="p-2">38" (96cm)</td><td className="p-2">30" (76cm)</td></tr>
                <tr><td className="p-2 font-bold">XXL</td><td className="p-2">46" (117cm)</td><td className="p-2">40" (101cm)</td><td className="p-2">31" (79cm)</td></tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Multi-Language Health & Culinary Intelligence */}
      <div className="mt-8">
        <ProductAiBenefitsCard product={product} />
      </div>

      {product.recipe_title && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-bold">{product.recipe_title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{product.recipe_steps}</p>
        </section>
      )}

      {/* Customer Reviews Section */}
      <ProductReviewsSection productId={product.id} productName={product.name} />

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function ProductReviewsSection({ productId, productName }: { productId: string; productName: string }) {
  const qc = useQueryClient();
  const [openReview, setOpenReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Please enter your name");
      if (!comment.trim()) throw new Error("Please enter a short review");

      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        product_name: productName,
        rating,
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, "") || null,
        comment: comment.trim(),
        active: true,
        verified: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review submitted! Thank you for your feedback.");
      setOpenReview(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit review"),
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + Number(r.rating), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Customer Reviews {avgRating && <span className="text-sm font-normal text-muted-foreground">({avgRating} ★ / {reviews.length} reviews)</span>}
          </h2>
          <p className="text-xs text-muted-foreground">Real feedback from verified seafood lovers.</p>
        </div>

        <Dialog open={openReview} onOpenChange={setOpenReview}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl shrink-0">
              <MessageSquare className="mr-1.5 size-3.5" /> Rate & Review
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Write a Review for {productName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label>Your Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-accent hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`size-6 ${
                          s <= rating ? "fill-accent text-accent" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rev-name">Name *</Label>
                  <Input
                    id="rev-name"
                    placeholder="Deepak"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rev-phone">Phone (Optional)</Label>
                  <Input
                    id="rev-phone"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="rev-comment">Review Comments *</Label>
                <Textarea
                  id="rev-comment"
                  placeholder="How was the freshness, taste, and cutting?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <Button
                className="w-full rounded-xl"
                disabled={submitReview.isPending || !name.trim() || !comment.trim()}
                onClick={() => submitReview.mutate()}
              >
                {submitReview.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border p-3 bg-muted/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs">{r.customer_name || "Seafood Customer"}</span>
                {r.verified && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                    Verified Buyer
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{formatIST(r.created_at)}</span>
            </div>

            <div className="flex items-center gap-1 text-accent">
              {[...Array(Number(r.rating || 5))].map((_, i) => (
                <Star key={i} className="size-3 fill-current" />
              ))}
            </div>

            <p className="text-xs text-foreground/90 leading-relaxed">{r.comment}</p>

            {r.admin_reply && (
              <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2 text-xs text-primary">
                <p className="font-semibold text-[11px]">Shop Owner Reply:</p>
                <p className="text-[11px] text-muted-foreground">{r.admin_reply}</p>
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No reviews yet. Be the first to try this fresh catch and leave a review!
          </p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
