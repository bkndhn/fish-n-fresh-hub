import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type InventoryBatch = Database["public"]["Tables"]["inventory_batches"]["Row"];

export function InventoryLedgerModal({
  product,
  open,
  onOpenChange,
  branchId,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string | null;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  
  // New batch form
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState("");
  const [expiry, setExpiry] = useState(format(new Date(Date.now() + 86400000 * 7), "yyyy-MM-dd"));
  
  const { data: batches, isLoading } = useQuery({
    queryKey: ["inventory_batches", product?.id, branchId],
    queryFn: async () => {
      if (!product) return [];
      let q = supabase
        .from("inventory_batches")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false });
      
      if (branchId) q = q.eq("branch_id", branchId);
      
      const { data, error } = await q;
      if (error) throw error;
      return data as InventoryBatch[];
    },
    enabled: !!product && open,
  });

  const addBatch = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No product");
      const { error } = await supabase.from("inventory_batches").insert({
        product_id: product.id,
        product_name: product.name,
        branch_id: branchId,
        initial_quantity: Number(qty),
        current_quantity: Number(qty),
        supplier_name: supplier,
        expiry_date: new Date(expiry).toISOString(),
        catch_date: new Date().toISOString(),
        catch_harbour: "Local",
        quality_grade: "A",
        cold_chain_temp_celsius: 4,
        batch_number: `BCH-${Date.now()}`
      });
      if (error) throw error;
      
      // Also update total stock on product
      const totalStock = (product.stock || 0) + Number(qty);
      const { error: pErr } = await supabase.from("products").update({
        stock: totalStock,
        cost_price: cost ? Number(cost) : product.cost_price,
      }).eq("id", product.id);
      
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      toast.success("Stock added to ledger");
      qc.invalidateQueries({ queryKey: ["inventory_batches"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setAdding(false);
      setQty("");
      setSupplier("");
      setCost("");
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Inventory Ledger: {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div className="bg-muted p-3 rounded-lg border flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Current Stock</p>
                <p className="text-xl font-bold">{product.stock || 0} {product.unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Cost Price</p>
                <p className="text-xl font-bold">₹{product.cost_price || 0}</p>
              </div>
            </div>
            {!adding && (
              <Button onClick={() => setAdding(true)}>+ Add New Stock</Button>
            )}
          </div>

          {adding && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
              <h4 className="font-semibold text-sm">Log New Incoming Stock</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label>Quantity ({product.unit})</Label>
                  <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 50" />
                </div>
                <div className="space-y-1">
                  <Label>Unit Cost (₹)</Label>
                  <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="e.g. 120" />
                </div>
                <div className="space-y-1">
                  <Label>Supplier / Source</Label>
                  <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Farm Fresh Co" />
                </div>
                <div className="space-y-1">
                  <Label>Expiry Date</Label>
                  <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                <Button onClick={() => addBatch.mutate()} disabled={!qty || addBatch.isPending}>
                  {addBatch.isPending ? "Saving..." : "Save to Ledger"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-3">Batch History</h4>
            {isLoading ? (
              <div className="text-center p-4 text-muted-foreground">Loading ledger...</div>
            ) : batches?.length === 0 ? (
              <div className="text-center p-8 bg-muted/30 rounded-xl border border-dashed">
                No inventory batches logged yet.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date Added</th>
                      <th className="px-4 py-2 font-medium">Supplier</th>
                      <th className="px-4 py-2 font-medium">Initial Qty</th>
                      <th className="px-4 py-2 font-medium">Current Qty</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batches?.map(b => {
                      const isExpired = new Date(b.expiry_date) < new Date();
                      const isDead = b.current_quantity === 0;
                      return (
                        <tr key={b.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3">{format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</td>
                          <td className="px-4 py-3">{b.supplier_name || "—"}</td>
                          <td className="px-4 py-3">{b.initial_quantity}</td>
                          <td className="px-4 py-3 font-semibold">{b.current_quantity}</td>
                          <td className="px-4 py-3">
                            {isDead ? (
                              <span className="px-2 py-1 rounded-md bg-muted text-[10px] font-bold">Depleted</span>
                            ) : isExpired ? (
                              <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-600 text-[10px] font-bold">Expired</span>
                            ) : (
                              <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">Active</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
