import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/price-board")({
  component: PriceBoardPage,
});

type ProductRow = {
  id: string;
  name: string;
  unit: string;
  price: number;
  wholesale_price: number | null;
  unlimited_stock: boolean | null;
  stock: number;
  is_available: boolean;
};

type EditableRow = ProductRow & {
  _price: string;
  _wholesale: string;
  _stock: string;
  _available: boolean;
  _dirty: boolean;
};

function PriceBoardPage() {
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery<ProductRow[]>({
    queryKey: ["price_board_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit, price, wholesale_price, unlimited_stock, stock, is_available")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ProductRow[];
    },
    staleTime: 30_000,
  });

  const [rows, setRows] = useState<EditableRow[]>([]);

  useEffect(() => {
    setRows(
      products.map((p) => ({
        ...p,
        _price: String(p.price ?? 0),
        _wholesale: String(p.wholesale_price ?? ""),
        _stock: String(p.stock ?? 0),
        _available: Boolean(p.is_available),
        _dirty: false,
      }))
    );
  }, [products]);

  const updateRow = (id: string, field: Partial<EditableRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...field, _dirty: true } : r))
    );
  };

  const dirtyCount = rows.filter((r) => r._dirty).length;

  const { mutate: saveAll, isPending } = useMutation({
    mutationFn: async () => {
      const dirty = rows.filter((r) => r._dirty);
      if (dirty.length === 0) {
        toast.info("No changes to save.");
        return;
      }
      for (const r of dirty) {
        const baseUpdate = {
          price: parseFloat(r._price) || r.price,
          wholesale_price: r._wholesale !== "" ? parseFloat(r._wholesale) : null,
          is_available: r._available,
        };
        // Update stock separately only for tracked-stock products to keep the
        // Supabase typed client happy (avoids a broad Record<string,unknown> cast).
        if (!r.unlimited_stock) {
          const { error } = await supabase
            .from("products")
            .update({ ...baseUpdate, stock: parseFloat(r._stock) || 0 })
            .eq("id", r.id);
          if (error) throw new Error(`Failed to update ${r.name}: ${error.message}`);
        } else {
          const { error } = await supabase
            .from("products")
            .update(baseUpdate)
            .eq("id", r.id);
          if (error) throw new Error(`Failed to update ${r.name}: ${error.message}`);
        }
      }
    },
    onSuccess: () => {
      toast.success("✅ Prices updated and broadcasting live!", {
        description: `${dirtyCount} product${dirtyCount !== 1 ? "s" : ""} updated across Storefront, POS & Wholesale catalog.`,
        duration: 5000,
      });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["price_board_products"] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Failed to save prices");
    },
  });

  return (
    <AdminShell
      title="📋 Daily Price Board"
      allow={["admin", "manager", "inventory_manager"]}
      action={
        <Button onClick={() => saveAll()} disabled={isPending || isLoading || dirtyCount === 0}>
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Saving..." : dirtyCount > 0 ? `Save ${dirtyCount} Change${dirtyCount !== 1 ? "s" : ""}` : "Save & Broadcast"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="w-4 h-4 text-yellow-500" />
          Update today&apos;s mandi / market prices below. Changes go live across the entire platform instantly.
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading products…</p>}

        {!isLoading && rows.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No active products found.
            </CardContent>
          </Card>
        )}

        {!isLoading && rows.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                      <th className="text-left p-3 font-medium">Product</th>
                      <th className="text-left p-3 font-medium">Unit</th>
                      <th className="text-center p-3 font-medium">Retail ₹</th>
                      <th className="text-center p-3 font-medium">Wholesale ₹</th>
                      <th className="text-center p-3 font-medium">Stock Qty</th>
                      <th className="text-center p-3 font-medium">In Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b hover:bg-muted/20 transition-colors ${
                          row._dirty ? "bg-yellow-50/40 dark:bg-yellow-900/10" : ""
                        }`}
                      >
                        <td className="p-3 font-medium">
                          {row.name}
                          {row._dirty && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs text-yellow-600 border-yellow-400"
                            >
                              modified
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground capitalize">
                          {row.unit || "pcs"}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            className="w-24 text-center mx-auto"
                            value={row._price}
                            onChange={(e) => updateRow(row.id, { _price: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            className="w-24 text-center mx-auto"
                            value={row._wholesale}
                            placeholder="—"
                            onChange={(e) => updateRow(row.id, { _wholesale: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          {row.unlimited_stock ? (
                            <span className="text-muted-foreground text-xs text-center block">
                              ∞ Unlimited
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              className="w-24 text-center mx-auto"
                              value={row._stock}
                              onChange={(e) => updateRow(row.id, { _stock: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => updateRow(row.id, { _available: !row._available })}
                            className={`w-10 h-6 rounded-full transition-colors flex items-center mx-auto ${
                              row._available ? "bg-green-500" : "bg-muted border"
                            }`}
                            aria-label={row._available ? "In stock" : "Out of stock"}
                          >
                            <span
                              className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                row._available ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {dirtyCount > 0 && (
          <div className="flex justify-end pt-2">
            <Button onClick={() => saveAll()} disabled={isPending} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Broadcasting…" : `💾 Save ${dirtyCount} Change${dirtyCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
