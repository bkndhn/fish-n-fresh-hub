import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, ORDER_STATUSES } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders | Fish N Fresh Admin" },
      { name: "description", content: "Track, update and fulfil every Fish N Fresh seafood order in one place." },
      { property: "og:title", content: "Orders | Fish N Fresh Admin" },
      { property: "og:description", content: "Track, update and fulfil every Fish N Fresh seafood order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersAdmin,
});

function OrdersAdmin() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = orders.data ?? [];

  return (
    <AdminShell title="Orders">
      <div className="space-y-3">
        {rows.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold">
                  {o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.customer_phone} · {o.fulfillment_type} · {o.payment_method.toUpperCase()}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-semibold">{formatINR(Number(o.total))}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {new Date(o.created_at).toLocaleDateString()}
                  </Badge>
                </div>
                <Select value={o.status} onValueChange={(status) => update.mutate({ id: o.id, status })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
      </div>
    </AdminShell>
  );
}
