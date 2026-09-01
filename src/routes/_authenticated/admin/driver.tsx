import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/driver")({
  head: () => ({
    meta: [
      { title: "Driver Map | Fish N Fresh Admin" },
      { name: "description", content: "Assign drivers and follow live delivery runs for pending seafood orders." },
      { property: "og:title", content: "Driver Map | Fish N Fresh Admin" },
      { property: "og:description", content: "Assign drivers and follow live delivery runs for pending orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverMap,
});

function DriverMap() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);

  useEffect(() => {
    const channel = supabase
      .channel("admin-driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const assign = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { driver_name?: string; status?: string } }) => {
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = (orders.data ?? []).filter(
    (o) => o.fulfillment_type !== "pickup" && !["delivered", "cancelled"].includes(o.status),
  );

  return (
    <AdminShell title="Driver map">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              title="Delivery area map"
              className="h-[420px] w-full border-0"
              loading="lazy"
              src="https://www.openstreetmap.org/export/embed.html?bbox=80.15%2C12.90%2C80.35%2C13.15&layer=mapnik"
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          {active.map((o) => (
            <Card key={o.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{o.customer_address ?? "No address"}</p>
                  </div>
                  <Badge variant="secondary">{o.status.replace(/_/g, " ")}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Driver name"
                    defaultValue={o.driver_name ?? ""}
                    onBlur={(e) => {
                      const driver_name = e.target.value.trim();
                      if (driver_name && driver_name !== o.driver_name) {
                        assign.mutate({ id: o.id, patch: { driver_name } });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => assign.mutate({ id: o.id, patch: { status: "out_for_delivery" } })}
                  >
                    Dispatch
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assign.mutate({ id: o.id, patch: { status: "delivered" } })}
                  >
                    Delivered
                  </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {o.location_lat && o.location_lng
                      ? `${o.location_lat.toFixed(4)}, ${o.location_lng.toFixed(4)}`
                      : "No GPS pin"}
                  </span>
                  <span>{formatINR(Number(o.total))}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {active.length === 0 && <p className="text-sm text-muted-foreground">No pending deliveries.</p>}
        </div>
      </div>
    </AdminShell>
  );
}
