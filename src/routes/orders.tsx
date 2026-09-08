import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/queries";
import { lookupGuestOrder, type GuestOrder } from "@/lib/orders.functions";
import { CustomerDeliveryPinCard } from "@/components/CustomerDeliveryPinCard";

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
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
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
      ) : null}
    </AppShell>
  );
}

function MyOrders() {
  const { data: settings } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const { add } = useCart();
  const navigate = useNavigate();

  function handleReorder(items: any[]) {
    if (Array.isArray(items)) {
      items.forEach((it) => {
        add(
          {
            id: it.product_id || it.id,
            name: it.name,
            price: Number(it.price),
            unit: it.unit || "kg",
            image_url: it.image_url || null,
          } as any,
          Number(it.qty) || 1,
          it.cut_preference || "Curry Cut",
        );
      });
      toast.success("Items added to your cart!");
      navigate({ to: "/cart" });
    }
  }

  const { data: orders } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, items, created_at, payment_status, complaint")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitComplaint = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase.from("orders").update({ complaint: text }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Complaint raised successfully");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const [complainingId, setComplainingId] = useState<string | null>(null);
  const [complaintText, setComplaintText] = useState("");

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
      {orders.map((o) => {
        const isDelivered = o.status === "delivered";
        const windowHours = Number(settings?.complaint_window_hours ?? 24);
        const orderTime = new Date(o.created_at).getTime();
        const canComplain = isDelivered && Date.now() < orderTime + windowHours * 3600000;

        return (
          <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">#{o.order_number ?? o.id.slice(0, 8)}</p>
              <Badge variant="secondary" className="capitalize">
                {String(o.status).replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatIST(o.created_at)} ·{" "}
              {Array.isArray(o.items) ? o.items.length : 0} items · {o.payment_status}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display text-lg font-bold">{inr(Number(o.total))}</p>
              <div className="flex gap-2">
                {canComplain && !o.complaint && complainingId !== o.id && (
                  <Button size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => setComplainingId(o.id)}>
                    Issue with order?
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => handleReorder(o.items as any[])}
                >
                  <RotateCcw className="mr-1 size-3.5" /> Reorder
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to="/track/$id" params={{ id: o.id }}>
                    Track
                  </Link>
                </Button>
              </div>
            </div>

            {/* Secret Handover PIN for Active Orders */}
            {o.status !== "delivered" && o.status !== "cancelled" && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <CustomerDeliveryPinCard orderId={o.id} orderStatus={o.status} />
              </div>
            )}

            {o.complaint && (
              <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
                <p className="font-semibold text-destructive">Complaint raised</p>
                <p className="text-muted-foreground">{o.complaint}</p>
              </div>
            )}

            {complainingId === o.id && (
              <div className="mt-3 space-y-2">
                <Textarea 
                  placeholder="What went wrong with this order?" 
                  className="rounded-xl"
                  value={complaintText}
                  onChange={e => setComplaintText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setComplainingId(null)}>Cancel</Button>
                  <Button size="sm" variant="destructive" className="rounded-xl" disabled={submitComplaint.isPending || !complaintText.trim()} onClick={() => {
                    submitComplaint.mutate({ id: o.id, text: complaintText });
                    setComplainingId(null);
                    setComplaintText("");
                  }}>
                    Submit Complaint
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
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
      const found = (await lookup({ data: { reference, phone } })) as GuestOrder | null;
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
