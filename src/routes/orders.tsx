import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { lookupGuestOrder, type GuestOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — Fish N Fresh" },
      { name: "description", content: "See your Fish N Fresh order history and track live delivery status." },
      { property: "og:title", content: "My Orders — Fish N Fresh" },
      { property: "og:description", content: "Track your seafood orders and reorder favourites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading } = useSessionUser();

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My orders</h1>
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : user ? (
        <MyOrders />
      ) : (
        <GuestLookup />
      )}
    </AppShell>
  );
}

function MyOrders() {
  const { data: orders } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, items, created_at, payment_status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!orders?.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">No orders yet.</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/catalog">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="mt-5 space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">#{o.order_number ?? o.id.slice(0, 8)}</p>
            <Badge variant="secondary" className="capitalize">
              {String(o.status).replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(o.created_at).toLocaleString("en-IN")} ·{" "}
            {Array.isArray(o.items) ? o.items.length : 0} items · {o.payment_status}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <p className="font-display text-lg font-bold">{inr(Number(o.total))}</p>
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link to="/track/$id" params={{ id: o.id }}>
                Track
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GuestLookup() {
  const lookup = useServerFn(lookupGuestOrder);
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem("fnf_phone") ?? ""),
  );
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [busy, setBusy] = useState(false);

  async function find() {
    setBusy(true);
    try {
      const found = await lookup({ data: { reference, phone } });
      setOrder(found);
      if (!found) toast.error("No order found for those details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Sign in to see your full order history, or look up a single order below.
      </p>
      <Button asChild variant="outline" className="rounded-xl">
        <Link to="/auth">Sign in</Link>
      </Button>
      <Input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Order number"
        className="rounded-xl"
      />
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="Phone used on the order"
        inputMode="numeric"
        className="rounded-xl"
      />
      <Button className="w-full rounded-xl" disabled={busy} onClick={find}>
        {busy ? "Looking up…" : "Find my order"}
      </Button>

      {order && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">#{order.order_number ?? order.id.slice(0, 8)}</p>
            <Badge variant="secondary" className="capitalize">
              {order.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("en-IN")}
          </p>
          <p className="mt-2 font-display text-lg font-bold">{inr(Number(order.total))}</p>
          {order.eta_minutes && (
            <p className="mt-1 text-sm text-muted-foreground">ETA ~{order.eta_minutes} min</p>
          )}
          {order.delivery_note && <p className="mt-1 text-sm">{order.delivery_note}</p>}
        </div>
      )}
    </div>
  );
}
