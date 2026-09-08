import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUSES } from "@/lib/admin";

export const Route = createFileRoute("/track/$id")({
  head: () => ({
    meta: [
      { title: "Track Order — Fish N Fresh" },
      { name: "description", content: "Live status of your Fish N Fresh seafood delivery, step by step." },
      { property: "og:title", content: "Track Order — Fish N Fresh" },
      { property: "og:description", content: "Follow your seafood order from packing to your doorstep." },
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
  component: TrackPage,
});

const FLOW = ORDER_STATUSES.filter((s) => s !== "cancelled");

function TrackPage() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useQuery({
    queryKey: ["track", id],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, items, created_at, eta_minutes, delivery_note, driver_name, customer_address, fulfillment_type, payment_status",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Order not found or you need to sign in to view it.</p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const idx = FLOW.indexOf(order.status as (typeof FLOW)[number]);

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">#{order.order_number ?? order.id.slice(0, 8)}</h1>
        <Badge variant="secondary" className="capitalize">
          {String(order.status).replace(/_/g, " ")}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {new Date(order.created_at).toLocaleString("en-IN")} · {order.fulfillment_type}
      </p>

      {order.status === "cancelled" ? (
        <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm">This order was cancelled.</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {FLOW.map((step, i) => {
            const done = idx >= 0 && i <= idx;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-[11px] ${
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={`text-sm capitalize ${done ? "font-medium" : "text-muted-foreground"}`}>
                  {step.replace(/_/g, " ")}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-6 space-y-1 rounded-2xl border border-border bg-card p-4 text-sm">
        {order.eta_minutes && <p>Estimated arrival: ~{order.eta_minutes} minutes</p>}
        {order.driver_name && <p>Driver: {order.driver_name}</p>}
        {order.customer_address && <p className="text-muted-foreground">{order.customer_address}</p>}
        {order.delivery_note && <p className="mt-2">{order.delivery_note}</p>}
        <p className="mt-2 font-display text-lg font-bold">{inr(Number(order.total))}</p>
        <p className="text-xs text-muted-foreground">Payment: {order.payment_status}</p>
      </div>
    </AppShell>
  );
}
