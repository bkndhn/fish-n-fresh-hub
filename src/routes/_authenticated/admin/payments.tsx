import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import {
  listWebhookEndpoints,
  saveWebhookEndpoint,
  deleteWebhookEndpoint,
  testWebhookEndpoint,
  type WebhookEndpointRow,
} from "@/lib/webhooks.functions";

const EVENT_OPTIONS = [
  { key: "payment.succeeded", label: "Payment successful" },
  { key: "payment.failed", label: "Payment failed" },
  { key: "order.created", label: "New order placed" },
  { key: "order.status_changed", label: "Order status changed" },
];

function WebhookManager() {
  const list = useServerFn(listWebhookEndpoints);
  const save = useServerFn(saveWebhookEndpoint);
  const remove = useServerFn(deleteWebhookEndpoint);
  const ping = useServerFn(testWebhookEndpoint);

  const q = useQuery<WebhookEndpointRow[]>({
    queryKey: ["webhook-endpoints"],
    queryFn: () => list({ data: undefined } as never),
  });

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(EVENT_OPTIONS.map((e) => e.key));
  const [active, setActive] = useState(true);

  const inboundUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/payments/webhook?env=live`
      : "https://fishnfresh.lovable.app/api/public/payments/webhook?env=live";

  const saveMut = useMutation({
    mutationFn: () => save({ data: { label, url, events, is_active: active } }),
    onSuccess: () => {
      toast.success("Webhook saved");
      setLabel("");
      setUrl("");
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pingMut = useMutation({
    mutationFn: (id: string) => ping({ data: { id } }),
    onSuccess: (r: { ok: boolean; status: number; durationMs: number; error?: string }) => {
      if (r.ok) toast.success(`Test delivered · HTTP ${r.status} in ${r.durationMs}ms`);
      else toast.error(`Test failed · ${r.error ?? `HTTP ${r.status}`}`);
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook removed");
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-8 space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h3 className="font-display text-lg font-bold">Payment provider webhook</h3>
          <p className="text-sm text-muted-foreground">
            Paste this address into your payment provider so paid orders are confirmed automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{inboundUrl}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(inboundUrl);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Events to enable: checkout.session.completed, checkout.session.async_payment_succeeded,
            checkout.session.async_payment_failed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-display text-lg font-bold">Send app events elsewhere</h3>
          <p className="text-sm text-muted-foreground">
            Add any address (Zapier, Make, your accounting tool) and we post a signed update whenever these
            things happen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Accounting sync" />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {EVENT_OPTIONS.map((ev) => (
              <label key={ev.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={events.includes(ev.key)}
                  onCheckedChange={(c) =>
                    setEvents((prev) => (c ? [...prev, ev.key] : prev.filter((k) => k !== ev.key)))
                  }
                />
                {ev.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} /> Active
            </label>
            <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? "Saving..." : "Add webhook"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(q.data ?? []).map((w) => (
        <Card key={w.id}>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-40 flex-1">
              <p className="text-sm font-semibold">{w.label}</p>
              <p className="truncate text-xs text-muted-foreground">{w.url}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {w.events.join(", ")}
                {w.last_delivered_at ? ` · last ${formatIST(w.last_delivered_at)} (HTTP ${w.last_status})` : ""}
              </p>
            </div>
            <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Paused"}</Badge>
            <Button size="sm" variant="outline" disabled={pingMut.isPending} onClick={() => pingMut.mutate(w.id)}>
              Test ping
            </Button>
            <Button size="sm" variant="destructive" onClick={() => delMut.mutate(w.id)}>
              Remove
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const PAYMENT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "order_no", label: "Order #", width: 16 },
  { key: "date", label: "Date & Time", width: 22 },
  { key: "customer_name", label: "Customer Name", width: 22 },
  { key: "customer_phone", label: "Customer Phone", width: 16 },
  { key: "method", label: "Payment Method", width: 16 },
  { key: "status", label: "Payment Status", width: 14 },
  { key: "total", label: "Billed Total", width: 14, type: "currency" },
  { key: "refunded", label: "Refunded", width: 14, type: "currency" },
  { key: "net", label: "Net Collected", width: 14, type: "currency" },
];

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Refunds | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Audit every Fish N Fresh order payment: paid, unpaid, refunded amounts and the outstanding balance.",
      },
      { property: "og:title", content: "Payments & Refunds | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Payment status, refund history and balance for every order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsReport,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "refunded", label: "Refunded" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function paymentState(o: { payment_status: string; refund_amount?: number | null }) {
  if (Number(o.refund_amount ?? 0) > 0) return "refunded";
  if (o.payment_status === "paid") return "paid";
  return "unpaid";
}

function PaymentsReport() {
  const orders = useQuery(adminOrdersQuery());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = orders.data ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((o) => {
      const state = paymentState(o);
      if (filter !== "all" && state !== filter) return false;
      if (!term) return true;
      return (
        (o.order_number ?? "").toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.includes(term)
      );
    });
  }, [orders.data, filter, q]);

  const totals = useMemo(() => {
    let billed = 0;
    let collected = 0;
    let refunded = 0;
    for (const o of rows) {
      const total = Number(o.total);
      const refund = Number(o.refund_amount ?? 0);
      if (o.status !== "cancelled") billed += total;
      if (o.payment_status === "paid") collected += total;
      refunded += refund;
    }
    return { billed, collected, refunded, net: collected - refunded };
  }, [rows]);

  const exportData = useMemo(() => {
    return rows.map((o) => {
      const refund = Number(o.refund_amount ?? 0);
      const netCollected = o.payment_status === "paid" ? Number(o.total) - refund : 0;
      return {
        order_no: o.order_number ?? o.id.slice(0, 8),
        date: formatIST(o.created_at),
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        method: o.payment_method?.toUpperCase() || "CASH",
        status: paymentState(o).toUpperCase(),
        total: Number(o.total) || 0,
        refunded: refund,
        net: netCollected,
      };
    });
  }, [rows]);

  return (
    <AdminShell title="Payments & refunds" allow={["admin", "manager"]}>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Billed", value: totals.billed },
          { label: "Collected", value: totals.collected },
          { label: "Refunded", value: totals.refunded },
          { label: "Net revenue", value: totals.net },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="font-display text-xl font-bold">{formatINR(k.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <Input
          className="h-9 w-full sm:w-56"
          placeholder="Search order, name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="ml-auto">
          <ExportDropdown
            options={{
              data: exportData,
              columns: PAYMENT_EXPORT_COLUMNS,
              filename: "payments-audit-ledger",
              title: "Payments & Refunds Audit Ledger",
              subtitle: `Total Collected: ${formatINR(totals.collected)} | Net: ${formatINR(totals.net)}`,
            }}
            buttonLabel="Export Payments"
          />
        </div>
      </div>

      {orders.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading payments...</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No orders match this view.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((o) => {
            const refund = Number(o.refund_amount ?? 0);
            const balance = o.payment_status === "paid" ? Number(o.total) - refund : Number(o.total);
            const state = paymentState(o);
            return (
              <Card key={o.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold">
                      {o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("en-IN")}
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                        {o.payment_method === "card" ? "💳 Card / Stripe" : o.payment_method === "upi" ? "📱 UPI" : o.payment_method === "cash" ? "💵 Cash / COD" : o.payment_method.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={state === "paid" ? "default" : state === "refunded" ? "destructive" : "secondary"}
                    className="capitalize"
                  >
                    {state}
                  </Badge>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatINR(Number(o.total))}</p>
                    {refund > 0 && (
                      <p className="text-xs text-destructive">
                        Refunded {formatINR(refund)}
                        {o.refunded_at ? ` · ${formatIST(o.refunded_at)}` : ""}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {o.payment_status === "paid" ? "Balance" : "Due"} {formatINR(balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
