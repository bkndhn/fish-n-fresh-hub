import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2, AlertTriangle, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import { getStoreStatus } from "@/lib/storeSchedule";

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
  const storeStatus = settings ? getStoreStatus(settings) : null;
  const freeOver = Number(settings?.free_delivery_over ?? 500);
  const progress = Math.min(100, (subtotal / freeOver) * 100);

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
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.product_id} className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex gap-3 items-center flex-1 min-w-0">
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className="size-20 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{item.name}</p>
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
              <div className="flex items-center gap-3 rounded-lg border border-border px-2 py-1">
                <button onClick={() => setQty(item.product_id, item.qty - 1)} aria-label="Decrease">
                  <Minus className="size-4" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                <button onClick={() => setQty(item.product_id, item.qty + 1)} aria-label="Increase">
                  <Plus className="size-4" />
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
            <p className="mt-1 font-semibold">Orders will reopen on {storeStatus.nextWorkingDate} at {storeStatus.openTimeFormatted}.</p>
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
        <Button variant="outline" className="rounded-xl" onClick={clear}>
          Clear
        </Button>
        {storeStatus && !storeStatus.canAcceptOrder ? (
          <Button disabled className="flex-1 rounded-xl opacity-60">
            Orders Paused · Store Closed
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
