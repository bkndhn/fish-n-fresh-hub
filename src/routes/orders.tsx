import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { ordersByPhoneQuery } from "@/lib/queries";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — Fish N Fresh" },
      { name: "description", content: "Track your Fish N Fresh seafood orders by phone number." },
      { property: "og:title", content: "My Orders — Fish N Fresh" },
      { property: "og:description", content: "Track your seafood orders and reorder favourites." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("fnf_phone") ?? "";
  });
  const { data: orders } = useQuery(ordersByPhoneQuery(phone));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">My orders</h1>
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="Enter your 10-digit phone number"
        inputMode="numeric"
        className="mt-3 rounded-xl"
      />
      <ul className="mt-5 space-y-3">
        {(orders ?? []).map((o) => (
          <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">#{o.order_number ?? o.id.slice(0, 8)}</p>
              <Badge variant="secondary">{o.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(o.created_at).toLocaleString("en-IN")} ·{" "}
              {Array.isArray(o.items) ? o.items.length : 0} items
            </p>
            <p className="mt-2 font-display text-lg font-bold">{inr(Number(o.total))}</p>
          </li>
        ))}
      </ul>
      {phone.length >= 10 && (orders ?? []).length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No orders for this number yet.</p>
      )}
    </AppShell>
  );
}
