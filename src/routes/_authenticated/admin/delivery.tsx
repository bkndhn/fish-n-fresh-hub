import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Check, MessageCircle, Phone, Truck, Undo2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, ORDER_STATUSES, myRolesQuery, type OrderRow } from "@/lib/admin";
import { cancelAndRefundOrder } from "@/lib/refunds.functions";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Tracking | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Track every Fish N Fresh delivery status and send progress updates to customers on WhatsApp.",
      },
      { property: "og:title", content: "Delivery Tracking | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Follow each order from packing to doorstep and message customers with one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryTracking,
});

const FLOW = ORDER_STATUSES.filter((s) => s !== "cancelled");

const STATUS_MESSAGE: Record<string, string> = {
  confirmed: "we have confirmed your order",
  packed: "your order is packed and iced, ready to leave the shop",
  out_for_delivery: "your order is out for delivery and will reach you shortly",
  delivered: "your order has been delivered. Thank you for shopping with us!",
};

function defaultMessage(order: OrderRow) {
  const ref = order.order_number ?? order.id.slice(0, 8);
  const line = STATUS_MESSAGE[order.status] ?? `your order status is now ${order.status.replace(/_/g, " ")}`;
  return `Hi ${order.customer_name}, ${line}. Order ${ref} · ${formatINR(Number(order.total))} — Fish N Fresh`;
}

function DeliveryTracking() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState("");
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const roles = useQuery(myRolesQuery);
  const isAdmin = (roles.data ?? []).includes("admin");
  const refundFn = useServerFn(cancelAndRefundOrder);

  const refund = useMutation({
    mutationFn: async (vars: { orderId: string; reason: string; refund: boolean }) => {
      const res = await refundFn({
        data: {
          orderId: vars.orderId,
          reason: vars.reason,
          refund: vars.refund,
          environment: isPaymentsConfigured() ? getStripeEnvironment() : "sandbox",
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      setCancelReason("");
      toast.success(res.note);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  useEffect(() => {
    const channel = supabase
      .channel("admin-delivery-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const active = useMemo(
    () => (orders.data ?? []).filter((o) => o.status !== "cancelled"),
    [orders.data],
  );
  const selected = active.find((o) => o.id === selectedId) ?? active[0] ?? null;

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OrderRow> }) => {
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function sendWhatsApp(order: OrderRow) {
    const text = (message.trim() || defaultMessage(order)).slice(0, 900);
    const phone = order.customer_phone.replace(/\D/g, "");
    const to = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    update.mutate({ id: order.id, patch: { whatsapp_sent: true } as Partial<OrderRow> });
    setMessage("");
  }

  return (
    <AdminShell title="Delivery tracking" allow={["admin", "staff", "driver"]}>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {active.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setSelectedId(o.id);
                setMessage("");
                setEta("");
                setNote("");
              }}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected?.id === o.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {o.order_number ?? o.id.slice(0, 8)} · {o.customer_name}
                </span>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {o.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {o.fulfillment_type} · {formatINR(Number(o.total))}
              </p>
            </button>
          ))}
          {active.length === 0 && <p className="text-sm text-muted-foreground">No active orders.</p>}
        </div>

        {selected && (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">
                    {selected.order_number ?? selected.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer_name} · {selected.customer_phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.customer_address ?? "Pickup at store"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">{formatINR(Number(selected.total))}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.driver_name ? `Driver: ${selected.driver_name}` : "No driver assigned"}
                  </p>
                </div>
              </div>

              <ol className="space-y-2">
                {FLOW.map((step) => {
                  const idx = FLOW.indexOf(selected.status as (typeof FLOW)[number]);
                  const stepIdx = FLOW.indexOf(step);
                  const done = idx >= 0 && stepIdx <= idx;
                  return (
                    <li key={step} className="flex items-center gap-3">
                      <span
                        className={`flex size-6 items-center justify-center rounded-full text-[10px] ${
                          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <Check className="size-3" /> : stepIdx + 1}
                      </span>
                      <span className={`flex-1 text-sm capitalize ${done ? "font-medium" : "text-muted-foreground"}`}>
                        {step.replace(/_/g, " ")}
                      </span>
                      {!done && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => update.mutate({ id: selected.id, patch: { status: step } })}
                        >
                          Mark
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-sm font-medium">Delivery details</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="w-32"
                    inputMode="numeric"
                    placeholder={selected.eta_minutes ? `ETA ${selected.eta_minutes}m` : "ETA (min)"}
                    value={eta}
                    onChange={(e) => setEta(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                  <Input
                    className="min-w-[200px] flex-1"
                    placeholder={selected.delivery_note ?? "Note shown to the customer"}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      update.mutate({
                        id: selected.id,
                        patch: {
                          ...(eta ? { eta_minutes: Number(eta) } : {}),
                          ...(note ? { delivery_note: note } : {}),
                        } as Partial<OrderRow>,
                      });
                      setEta("");
                      setNote("");
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="size-4" /> Send update to customer
                </p>
                <Textarea
                  rows={3}
                  value={message}
                  placeholder={defaultMessage(selected)}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => sendWhatsApp(selected)}>
                    <MessageCircle className="mr-1.5 size-4" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${selected.customer_phone}`}>
                      <Phone className="mr-1.5 size-4" /> Call
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: selected.id, patch: { status: "out_for_delivery" } })}
                  >
                    <Truck className="mr-1.5 size-4" /> Dispatch now
                  </Button>
                </div>
                {selected.status !== "delivered" && (
                  <p className="text-xs text-muted-foreground">
                    Messages open WhatsApp with the text prefilled so you can review before sending.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
