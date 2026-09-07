import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, MessageCircle, Phone } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCustomersQuery } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Fish N Fresh Admin" },
    ],
  }),
  component: CustomersAdmin,
});

function CustomersAdmin() {
  const customers = useQuery(adminCustomersQuery);
  const rows = customers.data ?? [];

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Orders", "Lifetime Spend", "Last Order"];
    const csv = [
      headers.join(","),
      ...rows.map(c => `"${c.name}","${c.phone}",${c.orders},${c.spent},"${formatIST(c.last_order)}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <AdminShell title="Customers">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">All Customers ({rows.length})</h2>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCSV}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((c) => (
          <Card key={c.phone}>
            <CardContent className="flex items-center justify-between pt-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.orders > 1 ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Repeated</span>
                  ) : (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">New</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {c.phone} 
                  <a href={`https://wa.me/91${c.phone}`} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-700">
                    <MessageCircle className="size-3" />
                  </a>
                  <a href={`tel:${c.phone}`} className="text-blue-600 hover:text-blue-700">
                    <Phone className="size-3" />
                  </a>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Last order: {formatIST(c.last_order)}</p>
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
