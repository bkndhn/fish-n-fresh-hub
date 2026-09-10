import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MessageSquareWarning,
  MessageCircle,
  Phone,
  Mail,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminOrdersQuery, type OrderRow } from "@/lib/admin";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { formatINR, formatIST } from "@/lib/format";
import { cancelAndRefundOrder } from "@/lib/refunds.functions";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { restoreOrderStock } from "@/lib/inventorySync";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/complaints")({
  head: () => ({
    meta: [
      { title: "Customer Complaints | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Resolve customer feedback, issue apologies or refunds, and respond via WhatsApp, Call, or Email.",
      },
      { property: "og:title", content: "Customer Complaints | Fish N Fresh Admin" },
    ],
  }),
  component: ComplaintsAdmin,
});

export function ComplaintsAdmin() {
  const qc = useQueryClient();
  const orders = useQuery(adminOrdersQuery);
  const refundFn = useServerFn(cancelAndRefundOrder);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [customReplyOrder, setCustomReplyOrder] = useState<OrderRow | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [resolutionActionOrder, setResolutionActionOrder] = useState<OrderRow | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const updateComplaint = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<OrderRow> }) => {
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
      if (patch.status === "cancelled" || patch.payment_status === "refunded") {
        await restoreOrderStock(id);
      }
    },
    onSuccess: () => {
      toast.success("Complaint status updated");
      setResolutionActionOrder(null);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const res = await refundFn({
        data: {
          orderId,
          reason,
          refund: true,
          environment: isPaymentsConfigured() ? getStripeEnvironment() : "sandbox",
        },
      });
      if ("error" in res) throw new Error(res.error);
      await restoreOrderStock(orderId);
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.note || "Refund processed successfully");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allOrders = orders.data ?? [];
  const complaints = useMemo(() => {
    return allOrders.filter((o) => Boolean(o.complaint && o.complaint.trim() !== ""));
  }, [allOrders]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((o) => {
      const isResolved =
        o.delivery_note?.toLowerCase().includes("resolved") ||
        o.status === "cancelled" ||
        o.payment_status === "refunded";

      if (filter === "pending" && isResolved) return false;
      if (filter === "resolved" && !isResolved) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.includes(term) ||
        (o.order_number && o.order_number.toLowerCase().includes(term)) ||
        (o.complaint && o.complaint.toLowerCase().includes(term))
      );
    });
  }, [complaints, filter, search]);

  const pendingCount = useMemo(() => {
    return complaints.filter(
      (o) =>
        !o.delivery_note?.toLowerCase().includes("resolved") &&
        o.status !== "cancelled" &&
        o.payment_status !== "refunded"
    ).length;
  }, [complaints]);

  function getPreFilledWhatsAppReply(order: OrderRow) {
    const ref = order.order_number ?? order.id.slice(0, 8);
    return `Hi ${order.customer_name}, this is the store manager at Fish N Fresh. We received your note regarding order #${ref}: "${order.complaint?.slice(0, 100)}...". Quality is our top priority and we sincerely apologize for falling short. We would like to make this right for you immediately.`;
  }

  function getPreFilledEmailBody(order: OrderRow) {
    const ref = order.order_number ?? order.id.slice(0, 8);
    return encodeURIComponent(
      `Dear ${order.customer_name},\n\nWe are writing to follow up on your recent order #${ref}.\n\nYour feedback: "${order.complaint}"\n\nWe take quality and freshness very seriously. Please accept our sincere apologies for your experience.\n\nOur team is resolving this right away.\n\nWarm regards,\nFish N Fresh Management`
    );
  }

  return (
    <AdminShell title="Customer Complaints" allow={["admin", "manager", "support_staff", "staff"]}>
      {/* Header Overview & Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search complaints by customer, phone, or issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-9"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={filter === "pending" ? "default" : "outline"}
              className={`rounded-xl h-9 text-xs font-semibold ${
                pendingCount > 0 && filter !== "pending" ? "border-rose-500/30 text-rose-600" : ""
              }`}
              onClick={() => setFilter("pending")}
            >
              Pending ({pendingCount})
            </Button>
            <Button
              size="sm"
              variant={filter === "resolved" ? "default" : "outline"}
              className="rounded-xl h-9 text-xs"
              onClick={() => setFilter("resolved")}
            >
              Resolved ({complaints.length - pendingCount})
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className="rounded-xl h-9 text-xs"
              onClick={() => setFilter("all")}
            >
              All ({complaints.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {filteredComplaints.map((o) => {
          const isResolved =
            o.delivery_note?.toLowerCase().includes("resolved") ||
            o.status === "cancelled" ||
            o.payment_status === "refunded";

          const waUrl = getWhatsAppUrl(o.customer_phone, getPreFilledWhatsAppReply(o));
          const mailSubject = encodeURIComponent(`Fish N Fresh - Resolution for Order #${o.order_number ?? o.id.slice(0, 8)}`);
          const mailUrl = `mailto:${(o as any).customer_email || ""}?subject=${mailSubject}&body=${getPreFilledEmailBody(o)}`;

          return (
            <Card
              key={o.id}
              className={`border transition shadow-xs ${
                isResolved ? "border-border/60 bg-card/60 opacity-90" : "border-rose-500/30 bg-card shadow-sm"
              }`}
            >
              <CardContent className="space-y-4 pt-5 pb-5">
                {/* Header info */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-base text-foreground">
                        Order #{o.order_number ?? o.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={isResolved ? "secondary" : "destructive"}
                        className="capitalize text-[11px]"
                      >
                        {isResolved ? "Resolved" : "Action Needed"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatIST(o.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {o.customer_name} · <span className="text-muted-foreground">{o.customer_phone}</span>
                    </p>
                    {o.customer_address && (
                      <p className="text-xs text-muted-foreground truncate max-w-md">{o.customer_address}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-display font-bold text-base text-foreground">{formatINR(Number(o.total))}</p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {o.payment_method} · {o.payment_status}
                    </p>
                    {o.driver_name && (
                      <p className="text-[11px] text-muted-foreground">Delivered by: {o.driver_name}</p>
                    )}
                  </div>
                </div>

                {/* Complaint Text Callout */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Customer Issue Raised:</span>
                  </div>
                  <p className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                    "{o.complaint}"
                  </p>
                  {o.delivery_note && (
                    <div className="mt-2.5 pt-2 border-t border-rose-500/15 text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-500" />
                      <span>Resolution Note: {o.delivery_note}</span>
                    </div>
                  )}
                </div>

                {/* Ordered Items Preview */}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Order Items:</span>
                  {(o.items ?? []).map((it, idx) => (
                    <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">
                      {it.name} ({it.qty} {it.unit || "kg"})
                    </span>
                  ))}
                </div>

                {/* Multi-Channel Response & Resolution Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-border/50 pt-3">
                  <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                    {/* WhatsApp Deep Link Button */}
                    <Button
                      size="sm"
                      className="rounded-xl h-8.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs px-2"
                      asChild
                    >
                      <a href={waUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center">
                        <WhatsAppIcon className="mr-1 size-3.5" /> WhatsApp
                      </a>
                    </Button>

                    {/* Direct Call Button */}
                    <Button size="sm" variant="outline" className="rounded-xl h-8.5 text-xs font-semibold px-2" asChild>
                      <a href={`tel:${o.customer_phone}`} className="flex items-center justify-center">
                        <Phone className="mr-1 size-3.5 text-primary" /> Call
                      </a>
                    </Button>

                    {/* Email Response */}
                    <Button size="sm" variant="outline" className="rounded-xl h-8.5 text-xs font-semibold px-2" asChild>
                      <a href={mailUrl} className="flex items-center justify-center">
                        <Mail className="mr-1 size-3.5 text-blue-500" /> Email
                      </a>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 justify-end pt-1 sm:pt-0">
                    {/* 1-Click Status Update */}
                    {!isResolved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-initial rounded-xl h-8.5 text-xs font-bold border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => {
                          setResolutionActionOrder(o);
                          setResolutionNote("Resolved after customer consultation. Feedback acknowledged.");
                        }}
                      >
                        <CheckCircle2 className="mr-1.5 size-3.5" /> Resolve
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Resolved
                      </span>
                    )}

                    {/* 1-Click Refund / Credit */}
                    {o.payment_status !== "refunded" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 sm:flex-initial rounded-xl h-8.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Issue full refund of ${formatINR(Number(o.total))} for order #${o.order_number ?? o.id.slice(0, 8)}?`)) {
                            if (o.stripe_session_id) {
                              refund.mutate({ orderId: o.id, reason: o.complaint || "Customer complaint resolution" });
                            } else {
                              updateComplaint.mutate({
                                id: o.id,
                                patch: {
                                  payment_status: "refunded",
                                  refund_amount: Number(o.total),
                                  refunded_at: new Date().toISOString(),
                                  delivery_note: "Resolved with customer refund.",
                                },
                              });
                            }
                          }
                        }}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" /> Refund
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredComplaints.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto size-8 text-emerald-500 mb-2" />
              <p className="font-semibold text-foreground">No complaints found</p>
              <p className="text-xs mt-1">
                {filter === "pending"
                  ? "All reported issues have been successfully addressed and resolved!"
                  : "No complaints match your active search filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mark Resolved Note Modal */}
      <Dialog
        open={Boolean(resolutionActionOrder)}
        onOpenChange={(open) => !open && setResolutionActionOrder(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          {resolutionActionOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Mark Complaint as Resolved</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">
                  Order #{resolutionActionOrder.order_number ?? resolutionActionOrder.id.slice(0, 8)} · {resolutionActionOrder.customer_name}
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Resolution Notes / Action Taken</label>
                  <Textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="e.g. Spoke with customer on WhatsApp, sent replacement catch in next slot."
                    className="rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-1/3 rounded-xl"
                    onClick={() => setResolutionActionOrder(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => {
                      updateComplaint.mutate({
                        id: resolutionActionOrder.id,
                        patch: {
                          delivery_note: resolutionNote.trim() || "Resolved with customer.",
                        },
                      });
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 size-4" /> Save Resolution
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
export default ComplaintsAdmin;
