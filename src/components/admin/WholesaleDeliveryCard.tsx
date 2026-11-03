import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OPTIONS = [
  { v: "pickup_only", label: "Pickup only", hint: "Retailers collect from the market" },
  { v: "free", label: "Free delivery", hint: "No charge for bulk orders" },
  { v: "charged", label: "Charge for delivery", hint: "Add a fixed charge per order" },
];

export function WholesaleDeliveryCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["wholesale-delivery-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, wholesale_delivery_mode, wholesale_delivery_fee")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [mode, setMode] = useState<string | null>(null);
  const [fee, setFee] = useState<string | null>(null);
  const curMode = mode ?? data?.wholesale_delivery_mode ?? "charged";
  const curFee = fee ?? String(data?.wholesale_delivery_fee ?? 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.id) throw new Error("Shop settings not found");
      const { error } = await supabase
        .from("store_settings")
        .update({ wholesale_delivery_mode: curMode, wholesale_delivery_fee: Math.max(0, Number(curFee) || 0) })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bulk delivery saved");
      qc.invalidateQueries({ queryKey: ["wholesale-delivery-settings"] });
      qc.invalidateQueries({ queryKey: ["store_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-4 rounded-3xl shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Delivery for bulk buyers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`rounded-2xl border p-3 text-left transition ${curMode === o.v ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
            >
              <p className="text-sm font-semibold">{o.label}</p>
              <p className="text-xs text-muted-foreground">{o.hint}</p>
            </button>
          ))}
        </div>
        {curMode === "charged" && (
          <div className="max-w-xs space-y-1">
            <Label>Delivery charge per bulk order (₹)</Label>
            <Input type="number" min="0" value={curFee} onChange={(e) => setFee(e.target.value)} />
            <p className="text-xs text-muted-foreground">Leave 0 to use the normal shop delivery charge.</p>
          </div>
        )}
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4" /> Save
        </Button>
      </CardContent>
    </Card>
  );
}
