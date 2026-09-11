import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { getStoreStatus } from "@/lib/storeSchedule";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Fish N Fresh" },
      { name: "description", content: "Review your seafood order before checkout." },
      { property: "og:title", content: "Your Cart — Fish N Fresh" },
      { property: "og:description", content: "Review your seafood order before checkout." },
    ],
  }),
  component: CartPage,
});

const CUT_OPTIONS = [
  "Curry Cut",
  "Biryani Cut",
  "Fillet / Boneless",
  "Whole Cleaned (Head On)",
  "Whole Cleaned (Head Off)",
  "Steaks / Slices",
];

function CartPage() {
  const { items, subtotal, setQty, setCutPreference, remove, clear } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const storeStatus = settings ? getStoreStatus(settings) : null;
  const freeOver = Number(settings?.free_delivery_over ?? 500);
  const progress = Math.min(100, (subtotal / freeOver) * 100);

  // Live omnichannel stock audit for cart items
  const cartStockAnalysis = items.map((item) => {
    const matched = (products as Product[]).find((p) => p.id === item.product_id);
    const availableStock = matched?.stock ?? 999;
    const isAvailable = matched?.is_available !== false;
    const isSoldOut = availableStock <= 0 || !isAvailable;
    const isExceedingStock = item.qty > availableStock;
    return {
      ...item,
      availableStock,
      isSoldOut,
      isExceedingStock,
    };
  });

  const hasOutOfStockItems = cartStockAnalysis.some((i) => i.isSoldOut || i.isExceedingStock);

  if (items.length === 0) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <h1 className="text-xl font-bold">Your cart is empty</h1>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/catalog">Browse seafood</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Your cart</h1>
      {subtotal < freeOver && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-3">
          <p className="text-sm">Add {inr(freeOver - subtotal)} more for free delivery</p>
          <Progress value={progress} className="mt-2" />
        </div>
      )}

      {/* Express Delivery Callout */}
      {((settings as any)?.express_delivery_enabled ?? true) && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="flex items-center gap-1.5 font-medium">
            <Zap className="size-3.5 fill-amber-500 text-amber-500" />
            Express 30–{(settings as any)?.express_sla_mins || 35} Mins Priority Dispatch available
          </span>
          <span className="font-mono font-bold text-[11px] text-amber-700 dark:text-amber-400">
            Ice-Packed
          </span>
        </div>
      )}
      {/* Depleted Stock Alert Banner */}
      {hasOutOfStockItems && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
          <div>
            <p className="font-bold">Items Out of Stock in Your Cart</p>
            <p className="mt-0.5 opacity-90">
              One or more items have sold out or exceed our fresh catch dock inventory. Please remove sold out items to proceed to checkout.
            </p>
          </div>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {cartStockAnalysis.map((item) => (
          <li
            key={item.product_id}
            className={`flex flex-col sm:flex-row gap-3 rounded-2xl border p-3 transition-colors ${
              item.isSoldOut
                ? "border-destructive/40 bg-destructive/5"
                : item.isExceedingStock
                ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                : "border-border bg-card"
            }`}
          >
            <div className="flex gap-3 items-center flex-1 min-w-0">
              {item.image_url && (
                <div className="relative size-20 rounded-xl overflow-hidden shrink-0">
                  <img src={item.image_url} alt={item.name} className="size-full object-cover" />
                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center p-1 text-center">
                      <span className="text-[9px] font-black uppercase text-destructive">OUT</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{item.name}</p>
                  {item.isSoldOut && (
                    <span className="rounded-md bg-destructive text-destructive-foreground text-[10px] font-extrabold px-1.5 py-0.5">
                      SOLD OUT
                    </span>
                  )}
                  {item.isExceedingStock && !item.isSoldOut && (
                    <span className="rounded-md bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                      Only {item.availableStock} in stock
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {inr(item.price)} / {item.unit}
                </p>
                
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Cut:</span>
                  <select
                    value={item.cut_preference || "Curry Cut"}
                    onChange={(e) => setCutPreference(item.product_id, e.target.value)}
                    className="h-6 rounded-lg border border-input bg-transparent px-1.5 text-[11px] text-foreground focus:outline-none"
                  >
                    {CUT_OPTIONS.map((c) => (
                      <option key={c} value={c} className="bg-background text-foreground">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border">
              <div className="flex items-center gap-1.5 rounded-xl border border-border px-2 py-1 bg-background/80">
                <button
                  onClick={() => {
                    const isWeighted = (item.unit || "").toLowerCase().includes("kg") || (item.unit || "").toLowerCase() === "g";
                    const step = isWeighted ? (item.qty <= 1 ? 0.25 : 0.5) : 1;
                    const next = Math.max(0, Math.round((item.qty - step) * 100) / 100);
                    setQty(item.product_id, next);
                  }}
                  aria-label="Decrease"
                  className="p-1 hover:text-primary transition-colors"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  defaultValue={item.qty}
                  key={`${item.product_id}-${item.qty}`}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val <= 0) {
                      e.target.value = String(item.qty);
                    } else if (val > item.availableStock) {
                      toast.error(`Only ${item.availableStock} ${item.unit} available in stock`);
                      setQty(item.product_id, item.availableStock);
                    } else {
                      setQty(item.product_id, Math.round(val * 100) / 100);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-12 bg-transparent text-center text-xs font-mono font-bold outline-none text-foreground"
                  title="Type custom quantity or weight"
                />
                <button
                  disabled={item.isSoldOut || item.qty >= item.availableStock}
                  onClick={() => {
                    const isWeighted = (item.unit || "").toLowerCase().includes("kg") || (item.unit || "").toLowerCase() === "g";
                    const step = isWeighted ? 0.5 : 1;
                    if (item.qty + step > item.availableStock) {
                      toast.error(`Only ${item.availableStock} ${item.unit} available in stock`);
                      return;
                    }
                    setQty(item.product_id, Math.round((item.qty + step) * 100) / 100);
                  }}
                  className="p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-colors"
                  aria-label="Increase"
                  title={item.isSoldOut ? "Item is sold out" : item.qty >= item.availableStock ? "Max stock reached" : "Increase quantity"}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <p className="font-display font-bold">{inr(item.price * item.qty)}</p>
              <button
                onClick={() => remove(item.product_id)}
                className="text-muted-foreground hover:text-destructive p-1"
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-display text-xl font-bold">{inr(subtotal)}</span>
      </div>

      {storeStatus && !storeStatus.canAcceptOrder && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{storeStatus.statusTitle}</p>
            <p className="mt-0.5 opacity-90">{storeStatus.statusDescription}</p>
            {storeStatus.isLunchBreak ? (
              <p className="mt-1 font-semibold">Orders resume today at {storeStatus.lunchEndFormatted}. You can continue browsing items in the meantime.</p>
            ) : (
              <p className="mt-1 font-semibold">Orders will reopen on {storeStatus.nextWorkingDate} at {storeStatus.openTimeFormatted}.</p>
            )}
          </div>
        </div>
      )}

      {storeStatus && !storeStatus.isOpen && storeStatus.canAcceptOrder && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-bold">{storeStatus.statusTitle} · Pre-Orders Open</p>
            <p className="mt-0.5 opacity-90">Pre-orders are accepted for delivery on <span className="font-bold underline">{storeStatus.nextWorkingDate}</span>.</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="rounded-xl gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
              <Trash2 className="size-3.5" />
              <span>Clear</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl max-w-md p-6 border-border/80 shadow-2xl">
            <AlertDialogHeader className="space-y-3">
              <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto sm:mx-0">
                <Trash2 className="size-6" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-bold text-foreground">
                  Clear your shopping cart?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to remove all {items.length} {items.length === 1 ? "item" : "items"} ({inr(subtotal)}) from your seafood cart? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2">
              <AlertDialogCancel className="rounded-xl h-10 text-xs font-semibold">
                Keep Items
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  clear();
                  toast.info("Shopping cart cleared");
                }}
                className="rounded-xl h-10 text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Yes, Clear Cart
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {hasOutOfStockItems ? (
          <Button disabled className="flex-1 rounded-xl opacity-75 bg-destructive hover:bg-destructive text-destructive-foreground">
            Remove Sold Out Items to Checkout
          </Button>
        ) : storeStatus && !storeStatus.canAcceptOrder ? (
          <Button disabled className="flex-1 rounded-xl opacity-60">
            Orders Paused · {storeStatus.statusTitle}
          </Button>
        ) : (
          <Button asChild className="flex-1 rounded-xl">
            <Link to="/checkout">
              {storeStatus && !storeStatus.isOpen ? "Proceed to Pre-Order" : "Checkout"}
            </Link>
          </Button>
        )}
      </div>
    </AppShell>
  );
}
