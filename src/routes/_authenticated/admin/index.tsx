import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Package, ReceiptText, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCustomersQuery, adminOrdersQuery, adminProductsQuery } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Fish N Fresh" },
      { name: "description", content: "Live sales, orders and stock overview for the Fish N Fresh seafood store." },
      { property: "og:title", content: "Admin Dashboard | Fish N Fresh" },
      { property: "og:description", content: "Live sales, orders and stock overview for the Fish N Fresh seafood store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const orders = useQuery(adminOrdersQuery);
  const products = useQuery(adminProductsQuery);
  const customers = useQuery(adminCustomersQuery);

  const rows = orders.data ?? [];
  const revenue = rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const pending = rows.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const lowStock = (products.data ?? []).filter((p) => p.stock <= 5);

  const stats = [
    { label: "Revenue", value: formatINR(revenue), icon: IndianRupee },
    { label: "Orders", value: String(rows.length), icon: ReceiptText },
    { label: "Pending", value: String(pending), icon: Package },
    { label: "Customers", value: String((customers.data ?? []).length), icon: Users },
  ];

  return (
    <AdminShell title="Dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <s.icon className="size-5 text-primary" />
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.slice(0, 6).map((o) => (
              <Link
                key={o.id}
                to="/admin"
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.order_number ?? o.id.slice(0, 8)} · {o.payment_method.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINR(Number(o.total))}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {o.status}
                  </Badge>
                </div>
              </Link>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <Badge variant={p.stock === 0 ? "destructive" : "secondary"}>{p.stock} left</Badge>
              </div>
            ))}
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">All products well stocked.</p>}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
