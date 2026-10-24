import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { combo: "Combo offer", new_arrival: "New arrival", flash: "Flash deal" };
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Shows the active offer once per browser session after N seconds of use. Skipped on admin/staff pages. */
export function PromoPopup() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { add } = useCart();
  const skip = /^\/(admin|driver|staff|kitchen|auth)/.test(path);

  const { data } = useQuery({
    queryKey: ["active-promo-popup"],
    staleTime: 5 * 60_000,
    enabled: !skip,
    queryFn: async () => {
      const { data: p } = await supabase.from("promo_popups").select("*").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (!p) return null;
      let product: Product | null = null;
      if (p.product_id) {
        const { data: prod } = await supabase.from("products").select("*").eq("id", p.product_id).maybeSingle();
        product = (prod as unknown as Product) ?? null;
      }
      return { popup: p, product };
    },
  });

  useEffect(() => {
    if (skip || !data?.popup) return;
    const key = `promo_seen_${data.popup.id}_${data.popup.updated_at}`;
    if (sessionStorage.getItem(key)) return;
    const t = setTimeout(() => { setOpen(true); sessionStorage.setItem(key, "1"); }, data.popup.delay_seconds * 1000);
    return () => clearTimeout(t);
  }, [data, skip]);

  if (!data?.popup) return null;
  const { popup, product } = data;
  const prod = product as (Product & { combo_items?: string | null; combo_mrp?: number | null; is_available?: boolean }) | null;
  const canAdd = prod && prod.is_available !== false && Number(prod.stock ?? 1) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0">
        {prod?.image_url && <img src={prod.image_url} alt={prod.name} className="h-48 w-full object-cover" />}
        <div className="space-y-3 p-5">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {popup.badge || KIND_LABEL[popup.kind]}
          </span>
          <DialogTitle className="font-display text-2xl leading-tight">{popup.headline}</DialogTitle>
          {popup.subtext && <DialogDescription>{popup.subtext}</DialogDescription>}
          {prod && (
            <div className="rounded-2xl border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{prod.name}</p>
              {prod.combo_items && <p className="text-muted-foreground">{prod.combo_items}</p>}
              <p className="mt-1">
                <span className="text-lg font-bold">{inr(Number(prod.price))}</span>
                {Number(prod.combo_mrp ?? prod.old_price) > Number(prod.price) && (
                  <span className="ml-2 text-muted-foreground line-through">{inr(Number(prod.combo_mrp ?? prod.old_price))}</span>
                )}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Maybe later</Button>
            {canAdd && (
              <Button className="flex-1" onClick={() => { const r = add(prod as Product); if (r.added) toast.success("Added to cart"); setOpen(false); }}>
                Add to cart
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
