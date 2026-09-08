import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Printer, MessageCircle, Phone, Search, Filter } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, ORDER_STATUSES, type OrderRow } from "@/lib/admin";
import { settingsQuery } from "@/lib/queries";
import { formatINR, formatIST } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders | Fish N Fresh Admin" },
      { name: "description", content: "Track, update and fulfil every Fish N Fresh seafood order in one place." },
      { property: "og:title", content: "Orders | Fish N Fresh Admin" },
      { property: "og:description", content: "Track, update and fulfil every Fish N Fresh seafood order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersAdmin,
});

function OrdersAdmin() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const { data: settings } = useQuery(settingsQuery);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (orders.data ?? []).filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (o.order_number ?? "").toLowerCase().includes(term) ||
      o.customer_name.toLowerCase().includes(term) ||
      o.customer_phone.includes(term)
    );
  });

  return (
    <AdminShell title="Orders" allow={["admin", "staff"]}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, customer or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className="rounded-full text-xs"
            onClick={() => setStatusFilter("all")}
          >
            All ({orders.data?.length ?? 0})
          </Button>
          {ORDER_STATUSES.map((s) => {
            const count = (orders.data ?? []).filter((o) => o.status === s).length;
            return (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                className="rounded-full text-xs capitalize whitespace-nowrap"
                onClick={() => setStatusFilter(s)}
              >
                {s.replace(/_/g, " ")} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((o) => (
          <Card key={o.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base">
                      #{o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                    </p>
                    <Badge variant="secondary" className="capitalize text-[11px]">
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{o.customer_phone}</span>
                    <a
                      href={`tel:${o.customer_phone}`}
                      className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-0.5"
                    >
                      <Phone className="size-3" /> Call
                    </a>
                    <a
                      href={`https://wa.me/91${o.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hi ${o.customer_name}, regarding your Fish N Fresh seafood order #${o.order_number ?? o.id.slice(0, 8)}...`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-0.5"
                    >
                      <MessageCircle className="size-3" /> WhatsApp
                    </a>
                    <span>·</span>
                    <span className="capitalize">{o.fulfillment_type}</span>
                    <span>·</span>
                    <span className="font-semibold">{o.payment_method.toUpperCase()}</span>
                  </div>

                  {o.customer_address && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      📍 {o.customer_address}
                    </p>
                  )}

                  {o.delivery_slot && (
                    <p className="mt-0.5 text-xs text-primary font-medium">
                      ⏰ Slot: {o.delivery_date ? `${o.delivery_date} · ` : ""}{o.delivery_slot}
                    </p>
                  )}

                  <div className="mt-2 rounded-xl bg-muted/50 p-2.5 text-xs space-y-1">
                    <p className="font-medium text-foreground">Items:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      {o.items.map((i, idx) => (
                        <li key={idx}>
                          <span className="font-medium text-foreground">{i.name}</span> × {i.qty} {i.unit || "kg"}
                          {(i as any).cut_preference && (
                            <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                              {(i as any).cut_preference}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {o.notes && (
                    <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
                      <strong>Note:</strong> {o.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0">
                  <div className="text-left sm:text-right">
                    <p className="font-bold font-display text-lg">{formatINR(Number(o.total))}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {formatIST(o.created_at)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 text-xs"
                      onClick={() => setPrintOrder(o)}
                    >
                      <Printer className="mr-1 size-3.5" /> Print Bill
                    </Button>

                    <Select value={o.status} onValueChange={(status) => update.mutate({ id: o.id, status })}>
                      <SelectTrigger className="w-36 h-8 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {o.complaint && (
                <div className="rounded-xl bg-destructive/10 p-3 text-sm">
                  <p className="font-semibold text-destructive">Customer Complaint</p>
                  <p className="text-destructive/80 text-xs mt-0.5">{o.complaint}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No orders match the current filter.
          </p>
        )}
      </div>

      {/* Printable Thermal Receipt Modal */}
      <Dialog open={Boolean(printOrder)} onOpenChange={(open) => !open && setPrintOrder(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Packing Slip / Receipt</span>
              <Button size="sm" onClick={() => window.print()} className="rounded-xl">
                <Printer className="mr-1.5 size-4" /> Print Now
              </Button>
            </DialogTitle>
          </DialogHeader>

          {printOrder && (
            <div id="thermal-receipt" className="border rounded-xl p-4 bg-white text-black font-mono text-xs space-y-3">
              <div className="text-center border-b pb-2">
                <h2 className="font-bold text-sm uppercase">{(settings as any)?.firm_name || "Fish N Fresh Seafood Hub"}</h2>
                {settings?.store_address && <p className="text-[10px] text-gray-600">{settings.store_address}</p>}
                {settings?.support_phone && <p className="text-[10px] text-gray-600">Ph: {settings.support_phone}</p>}
                {settings?.fssai_number && <p className="text-[10px] text-gray-600">FSSAI: {settings.fssai_number}</p>}
              </div>

              <div className="flex justify-between border-b pb-2">
                <div>
                  <p><strong>Order:</strong> #{printOrder.order_number ?? printOrder.id.slice(0, 8)}</p>
                  <p><strong>Date:</strong> {formatIST(printOrder.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="uppercase"><strong>{printOrder.payment_method}</strong></p>
                  <p className="capitalize">{printOrder.fulfillment_type}</p>
                </div>
              </div>

              <div className="border-b pb-2">
                <p><strong>Customer:</strong> {printOrder.customer_name}</p>
                <p><strong>Phone:</strong> {printOrder.customer_phone}</p>
                {printOrder.customer_address && <p><strong>Address:</strong> {printOrder.customer_address}</p>}
                {printOrder.delivery_slot && <p><strong>Slot:</strong> {printOrder.delivery_slot}</p>}
              </div>

              <div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-1">Item / Cut</th>
                      <th className="pb-1 text-center">Qty</th>
                      <th className="pb-1 text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printOrder.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-1">
                          <p className="font-bold">{it.name}</p>
                          {(it as any).cut_preference && (
                            <p className="text-[10px] text-gray-500">Cut: {(it as any).cut_preference}</p>
                          )}
                        </td>
                        <td className="py-1 text-center">{it.qty} {it.unit || "kg"}</td>
                        <td className="py-1 text-right font-bold">{formatINR(it.price * it.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-2 space-y-1 text-right">
                <p>Subtotal: {formatINR(printOrder.subtotal)}</p>
                {Number(printOrder.discount ?? 0) > 0 && <p className="text-green-700">Discount: -{formatINR(Number(printOrder.discount))}</p>}
                <p>Delivery: {Number(printOrder.delivery_fee) === 0 ? "FREE" : formatINR(Number(printOrder.delivery_fee))}</p>
                <p className="font-bold text-sm border-t pt-1">TOTAL: {formatINR(Number(printOrder.total))}</p>
              </div>

              {printOrder.notes && (
                <div className="border-t pt-2 text-[11px]">
                  <strong>Special Instructions:</strong> {printOrder.notes}
                </div>
              )}

              <div className="text-center border-t pt-2 text-[10px] text-gray-500">
                <p>Thank you for ordering fresh catch from Fish N Fresh!</p>
                <p>Daily Fresh · Lab Tested · Hygienically Cleaned</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
