import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Products | Fish N Fresh Admin" },
      { name: "description", content: "Manage seafood catalogue pricing, stock levels and availability." },
      { property: "og:title", content: "Products | Fish N Fresh Admin" },
      { property: "og:description", content: "Manage seafood catalogue pricing, stock and availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const qc = useQueryClient();
  const products = useQuery(adminProductsQuery);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { price?: number; stock?: number; is_available?: boolean } }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Products" allow={["admin", "staff"]}>
      <div className="space-y-3">
        {(products.data ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category ?? "Uncategorised"} · {formatINR(Number(p.price))} / {p.unit}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                  <Input
                    type="number"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const price = Number(e.target.value);
                      if (price !== p.price) update.mutate({ id: p.id, patch: { price } });
                    }}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Stock</Label>
                  <Input
                    type="number"
                    defaultValue={p.stock}
                    onBlur={(e) => {
                      const stock = Number(e.target.value);
                      if (stock !== p.stock) update.mutate({ id: p.id, patch: { stock } });
                    }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">Live</Label>
                  <Switch
                    checked={p.is_available}
                    onCheckedChange={(is_available) => update.mutate({ id: p.id, patch: { is_available } })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
