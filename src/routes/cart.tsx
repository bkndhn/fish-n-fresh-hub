import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";

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

function CartPage() {
  const { items, subtotal, setQty, remove, clear } = useCart();
  const { data: settings } = useQuery(settingsQuery);
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
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.product_id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
            {item.image_url && (
              <img src={item.image_url} alt={item.name} className="size-20 rounded-xl object-cover" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {inr(item.price)} / {item.unit}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border px-2 py-1">
                  <button onClick={() => setQty(item.product_id, item.qty - 1)} aria-label="Decrease">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                  <button onClick={() => setQty(item.product_id, item.qty + 1)} aria-label="Increase">
                    <Plus className="size-4" />
                  </button>
                </div>
                <button
                  onClick={() => remove(item.product_id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <p className="font-display font-bold">{inr(item.price * item.qty)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-display text-xl font-bold">{inr(subtotal)}</span>
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" className="rounded-xl" onClick={clear}>
          Clear
        </Button>
        <Button asChild className="flex-1 rounded-xl">
          <Link to="/checkout">Checkout</Link>
        </Button>
      </div>
    </AppShell>
  );
}
