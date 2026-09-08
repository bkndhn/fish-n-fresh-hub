import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, MapPin, Phone, Truck, Compass, Route as RouteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myRolesQuery, ORDER_STATUSES, type OrderRow } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryRouteModal } from "@/components/DeliveryRouteModal";
import { getGoogleMapsDirUrl } from "@/lib/maps";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/crew")({
  head: () => ({
    meta: [
      { title: "My Deliveries | Fish N Fresh Crew" },
      {
        name: "description",
        content: "Fish N Fresh crew board: see the orders assigned to you and update their delivery status.",
      },
      { property: "og:title", content: "My Deliveries | Fish N Fresh Crew" },
      {
        property: "og:description",
        content: "See the orders assigned to you and keep customers updated as you deliver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrewBoard,
});

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "packed",
  packed: "out_for_delivery",
  out_for_delivery: "delivered",
};

function CrewBoard() {
  const qc = useQueryClient();
  const roles = useQuery(myRolesQuery);
  const isCrew = (roles.data ?? []).some((r) => r === "driver" || r === "staff" || r === "admin");
  const { data: settings } = useQuery(settingsQuery);
  const [routeModalOrder, setRouteModalOrder] = useState<OrderRow | null>(null);

  const myOrders = useQuery({
    queryKey: ["crew", "orders"],
    enabled: isCrew,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", uid)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const pastOrders = useQuery({
    queryKey: ["crew", "orders", "past"],
    enabled: isCrew,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", uid)
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  useEffect(() => {
    if (!isCrew) return;
    const channel = supabase
      .channel("crew-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["crew", "orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, isCrew]);

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        status?: string;
        cancel_reason?: string;
        eta_minutes?: number | null;
        delivery_note?: string | null;
      };
    }) => {
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["crew", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (roles.isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading your board…</div>;
  }

  if (!isCrew) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-xl font-bold">Crew access required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This account isn't set up as staff or a driver yet. Ask the store owner to add you.
        </p>
        <Button asChild variant="outline">
          <Link to="/orders">Go to my orders</Link>
        </Button>
      </div>
    );
  }

  const orders = myOrders.data ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <span className="ocean-gradient flex size-8 items-center justify-center rounded-xl text-primary-foreground">
            <Truck className="size-4" />
          </span>
          <span className="font-display font-bold">My deliveries</span>
          {(roles.data ?? []).includes("admin") && (
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <Link to="/admin">Admin console</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={(roles.data ?? []).includes("admin") ? "" : "ml-auto"}
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="mr-1.5 size-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {myOrders.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nothing assigned to you right now.
          </p>
        ) : (
          orders.map((o) => {
            const next = NEXT_STATUS[o.status];
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        #{o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center flex-wrap gap-1 mt-0.5">
                        <span>{o.customer_address ?? "No address"}</span>
                        {o.location_lat && o.location_lng && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            📍 Exact Pin
                          </span>
                        )}
                      </p>
                      {(o.delivery_date || o.delivery_slot) && (
                        <p className="text-xs font-medium text-primary">
                          {[
                            o.delivery_date
                              ? new Date(`${o.delivery_date}T00:00:00`).toLocaleDateString("en-IN", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })
                              : null,
                            o.delivery_slot,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {o.items.map((it, i) => (
                      <li key={i}>
                        {it.qty} × {it.name}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-2">
                    {next && (
                      <Button size="sm" onClick={() => update.mutate({ id: o.id, patch: { status: next } })}>
                        Mark {next.replace(/_/g, " ")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({ id: o.id, patch: { status: "cancelled", cancel_reason: "Unable to deliver" } })
                      }
                    >
                      Can't deliver
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a href={`tel:${o.customer_phone}`}>
                        <Phone className="mr-1.5 size-4" /> Call
                      </a>
                    </Button>

                    {/* Interactive Route Preview */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/25 text-primary hover:bg-primary/5"
                      onClick={() => setRouteModalOrder(o)}
                      title="Preview route on map with live ETA"
                    >
                      <RouteIcon className="mr-1.5 size-4 text-primary" /> Route
                    </Button>

                    {/* Turn-by-Turn GPS Navigation */}
                    <Button asChild size="sm" variant="outline" className="border-blue-500/30 text-blue-600 hover:bg-blue-500/10">
                      <a
                        href={getGoogleMapsDirUrl(
                          o.location_lat,
                          o.location_lng,
                          o.customer_address,
                          settings?.shop_lat,
                          settings?.shop_lng
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="Open turn-by-turn driving navigation in Google Maps"
                      >
                        <Compass className="mr-1.5 size-4 text-blue-500" /> Navigate
                      </a>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      placeholder="ETA min"
                      defaultValue={o.eta_minutes ?? ""}
                      className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-sm"
                      onBlur={(e) => {
                        const eta = e.target.value ? Number(e.target.value) : null;
                        if (eta !== o.eta_minutes) update.mutate({ id: o.id, patch: { eta_minutes: eta } });
                      }}
                    />
                    <input
                      placeholder="Note for the customer"
                      defaultValue={o.delivery_note ?? ""}
                      className="h-9 min-w-40 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                      onBlur={(e) => {
                        const note = e.target.value.trim() || null;
                        if (note !== o.delivery_note) update.mutate({ id: o.id, patch: { delivery_note: note } });
                      }}
                    />
                    <span className="text-sm font-semibold">{formatINR(Number(o.total))}</span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Statuses: {ORDER_STATUSES.join(" → ").replace(/_/g, " ")}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}

        {(pastOrders.data ?? []).length > 0 && (
          <section className="pt-4">
            <h2 className="mb-2 font-display text-sm font-bold">Past deliveries</h2>
            <div className="space-y-2">
              {(pastOrders.data ?? []).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                      {formatINR(Number(o.total))}
                    </p>
                  </div>
                  <Badge variant={o.status === "delivered" ? "secondary" : "outline"} className="capitalize">
                    {o.status}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Route & Turn-by-turn Navigation Modal */}
      <DeliveryRouteModal
        open={!!routeModalOrder}
        onOpenChange={(open) => {
          if (!open) setRouteModalOrder(null);
        }}
        orderId={routeModalOrder?.id}
        orderNumber={routeModalOrder?.order_number}
        customerName={routeModalOrder?.customer_name}
        customerPhone={routeModalOrder?.customer_phone}
        customerAddress={routeModalOrder?.customer_address}
        destinationLat={routeModalOrder?.location_lat ?? null}
        destinationLng={routeModalOrder?.location_lng ?? null}
        storeAddress={settings?.store_address ?? "Fish & Fresh Store"}
        storeLat={settings?.shop_lat ?? null}
        storeLng={settings?.shop_lng ?? null}
      />
    </div>
  );
}
