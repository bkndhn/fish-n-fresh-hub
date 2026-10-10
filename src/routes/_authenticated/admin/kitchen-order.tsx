import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export const Route = createFileRoute("/_authenticated/admin/kitchen-order")({
  head: () => ({
    meta: [
      { title: "Phone Kitchen Order | Fish N Fresh Admin" },
      { name: "description", content: "Place kitchen orders from your phone and share items on WhatsApp." },
      { property: "og:title", content: "Phone Kitchen Order | Fish N Fresh Admin" },
      { property: "og:description", content: "Place kitchen orders from your phone and share items on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitchenOrderPage,
});

type P = { id: string; name: string; price: number; unit: string | null; image_url: string | null };

function KitchenOrderPage() {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const products = useQuery({
    queryKey: ["kitchen-order", "products"],
    queryFn: async (): Promise<P[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, unit, image_url")
        .eq("is_available", true)
        .order("name")
        .limit(300);
      if (error) throw error;
      return (data ?? []) as P[];
    },
  });

  const list = useMemo(
    () => (products.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [products.data, q],
  );
  const lines = (products.data ?? []).filter((p) => cart[p.id] > 0);
  const total = lines.reduce((s, p) => s + p.price * cart[p.id], 0);
  const add = (id: string, d: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.round(((c[id] ?? 0) + d) * 100) / 100) }));

  const shareItem = (p: P) => {
    const qty = cart[p.id] || 1;
    const text = `🍽️ Kitchen: ${qty} ${p.unit ?? "×"} ${p.name} — ₹${p.price}/${p.unit ?? "item"}${note ? `\nNote: ${note}` : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const place = async () => {
    if (!lines.length) return toast.error("Add at least one item");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const subtotal = Math.round(total * 100) / 100;
    const { error } = await supabase.from("orders").insert({
      order_number: `KO-${Date.now().toString().slice(-6)}`,
      customer_name: name.trim() || "Kitchen order",
      customer_phone: "9999999999",
      fulfillment_type: "pos",
      status: "confirmed",
      payment_method: "pay_at_counter",
      payment_status: "pending",
      subtotal,
      total: subtotal,
      notes: note.trim() || "Phone kitchen order",
      created_by: u.user?.id ?? null,
      items: lines.map((p) => ({ product_id: p.id, name: p.name, price: p.price, qty: cart[p.id], unit: p.unit })),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sent to the Kitchen Bump Bar");
    setCart({});
    setNote("");
  };

  return (
    <AdminShell title="Phone Kitchen Order" allow={["admin", "manager", "staff", "cashier"]}>
      <div className="space-y-3 pb-40">
        <Input placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((p) => {
            const step = (p.unit ?? "").toLowerCase() === "kg" ? 0.25 : 1;
            return (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">₹{p.price}/{p.unit ?? "item"}</p>
                </div>
                <Button size="icon" variant="outline" aria-label={`Share ${p.name} on WhatsApp`} onClick={() => shareItem(p)}>
                  <WhatsAppIcon className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="outline" aria-label={`Less ${p.name}`} onClick={() => add(p.id, -step)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-bold">{cart[p.id] ?? 0}</span>
                <Button size="icon" aria-label={`More ${p.name}`} onClick={() => add(p.id, step)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 space-y-2 border-t bg-background p-3">
        <div className="flex gap-2">
          <Input placeholder="Name / token (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Cooking note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" disabled={busy || !lines.length} onClick={place}>
            Send to kitchen · {lines.length} items · ₹{total.toFixed(0)}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/admin/kitchen">Bump Bar</Link>
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
