import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Sales, product, payment and delivery performance reports for the Fish N Fresh store.",
      },
      { property: "og:title", content: "Reports | Fish N Fresh Admin" },
      { property: "og:description", content: "Revenue, best sellers, payment mix and fulfilment stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reports,
});

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All time" },
] as const;

function Reports() {
  const orders = useQuery(adminOrdersQuery);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");

  const rows = useMemo(() => {
    const all = orders.data ?? [];
    if (range === "all") return all;
    const cutoff = Date.now() - Number(range) * 86400000;
    return all.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }, [orders.data, range]);

  const paid = rows.filter((o) => o.status !== "cancelled");
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const aov = paid.length ? revenue / paid.length : 0;
  const delivered = rows.filter((o) => o.status === "delivered").length;
  const cancelled = rows.length - paid.length;

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of rows) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byPayment = useMemo(() => {
    const m = new Map<string, { count: number; value: number }>();
    for (const o of paid) {
      const cur = m.get(o.payment_method) ?? { count: 0, value: 0 };
      m.set(o.payment_method, { count: cur.count + 1, value: cur.value + Number(o.total) });
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [paid]);

  const topProducts = useMemo(() => {
    const m = new Map<string, { qty: number; value: number }>();
    for (const o of paid) {
      for (const it of o.items ?? []) {
        const cur = m.get(it.name) ?? { qty: 0, value: 0 };
        m.set(it.name, { qty: cur.qty + Number(it.qty), value: cur.value + Number(it.qty) * Number(it.price) });
      }
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 10);
  }, [paid]);

  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of paid) {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + Number(o.total));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [paid]);

  const peak = Math.max(1, ...daily.map(([, v]) => v));

  function exportCsv() {
    const header = "order,date,customer,phone,status,payment,total\n";
    const body = rows
      .map((o) =>
        [
          o.order_number ?? o.id.slice(0, 8),
          formatIST(o.created_at),
          o.customer_name.replace(/,/g, " "),
          o.customer_phone,
          o.status,
          o.payment_method,
          o.total,
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `fishnfresh-orders-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Reports">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.key}
            size="sm"
            variant={range === r.key ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto rounded-xl" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Revenue", value: formatINR(revenue) },
          { label: "Orders", value: String(rows.length) },
          { label: "Average order", value: formatINR(Math.round(aov)) },
          { label: "Delivered / cancelled", value: `${delivered} / ${cancelled}` },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-display text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <p className="text-sm font-semibold">Daily revenue</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {daily.map(([day, value]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1" title={`${day}: ${formatINR(value)}`}>
                <div className="w-full rounded-t bg-primary" style={{ height: `${(value / peak) * 100}%` }} />
                <span className="text-[9px] text-muted-foreground">{day.slice(5)}</span>
              </div>
            ))}
            {daily.length === 0 && <p className="text-sm text-muted-foreground">No orders in this range.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold">Orders by status</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {byStatus.map(([status, count]) => (
                <li key={status} className="flex justify-between capitalize">
                  <span>{status.replace(/_/g, " ")}</span>
                  <span className="font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold">Payment mix</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {byPayment.map(([method, v]) => (
                <li key={method} className="flex justify-between uppercase">
                  <span>{method}</span>
                  <span className="font-medium">
                    {v.count} · {formatINR(v.value)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-semibold">Top products</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {topProducts.map(([name, v]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 font-medium">
                    {v.qty} · {formatINR(v.value)}
                  </span>
                </li>
              ))}
              {topProducts.length === 0 && <li className="text-muted-foreground">No sales yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
