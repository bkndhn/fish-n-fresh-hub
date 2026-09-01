import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCustomersQuery } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Fish N Fresh Admin" },
      { name: "description", content: "See top seafood buyers, order counts and lifetime spend." },
      { property: "og:title", content: "Customers | Fish N Fresh Admin" },
      { property: "og:description", content: "See top seafood buyers, order counts and lifetime spend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersAdmin,
});

function CustomersAdmin() {
  const customers = useQuery(adminCustomersQuery);
  const rows = customers.data ?? [];

  return (
    <AdminShell title="Customers">
      <div className="space-y-3">
        {rows.map((c) => (
          <Card key={c.phone}>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.phone} · last order {new Date(c.last_order).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatINR(c.spent)}</p>
                <p className="text-xs text-muted-foreground">{c.orders} orders</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}
      </div>
    </AdminShell>
  );
}
