import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

type Item = { product_id?: string; id?: string; name: string; price: number; qty: number; unit?: string; image_url?: string | null; cut_preference?: string | null };

/** Shows the signed-in customer's last order with a one-tap reorder. Hidden for guests. */
export function RepeatLastOrder({ title }: { title: string }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const { data: order } = useQuery({
    queryKey: ["home-last-order"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, items, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const items = (Array.isArray(order?.items) ? order.items : []) as unknown as Item[];
  if (!order || !items.length) return null;

  const reorder = () => {
    items.forEach((it) =>
      add(
        { id: it.product_id || it.id, name: it.name, price: Number(it.price), unit: it.unit || "kg", image_url: it.image_url ?? null } as unknown as Parameters<typeof add>[0],
        Number(it.qty) || 1,
        it.cut_preference || "Curry Cut",
      ),
    );
    toast.success("Last order added to cart");
    navigate({ to: "/cart" });
  };

  return (
    <section className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold">{title || "Order again"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {items.slice(0, 3).map((i) => i.name).join(", ")}{items.length > 3 ? ` +${items.length - 3}` : ""} · ₹{Number(order.total).toFixed(0)}
          </p>
        </div>
        <Button size="sm" onClick={reorder} className="shrink-0 rounded-xl"><RotateCcw className="mr-1 size-3.5" />Reorder</Button>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
        {items.slice(0, 6).map((i, k) => (
          <div key={k} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-card px-2 py-1 text-[11px] shadow-xs">
            {i.image_url && <img src={i.image_url} alt={i.name} className="size-6 rounded-md object-cover" loading="lazy" />}
            <span className="font-medium">{i.name}</span>
            <span className="text-muted-foreground">× {i.qty}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
