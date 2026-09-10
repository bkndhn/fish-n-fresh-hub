import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Printer,
  FileText,
  Share2,
  Trash2,
  Download,
  Calendar,
  Clock,
  User,
  Phone,
  Banknote,
  QrCode,
  CreditCard,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatInvoiceDateTime } from "@/lib/format";
import { restoreOrderStock } from "@/lib/inventorySync";
import {
  getSavedPrinterConfig,
  sendEscPosToPrinter,
  buildPosReceiptEscPos,
  buildPosReceiptHtml,
  generatePosWhatsAppText,
  getPosWhatsAppShareUrl,
  type PosReceiptData,
  type PosReceiptItem,
} from "@/lib/thermalPrinter";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";

interface PosPastBillsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSettings?: any;
}

export function PosPastBillsModal({
  open,
  onOpenChange,
  storeSettings,
}: PosPastBillsModalProps) {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "all">("today");
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<any | null>(null);
  const [voidConfirmOrder, setVoidConfirmOrder] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  // Fetch POS orders
  const { data: posOrders = [], isLoading } = useQuery({
    queryKey: ["admin", "pos_past_bills_register"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, order_items(*)")
        .eq("fulfillment_type", "pos")
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open,
  });

  // Filter orders by date & search query
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return posOrders.filter((o) => {
      const oDate = (o.created_at || "").slice(0, 10);

      if (dateFilter === "today" && oDate !== todayStr) return false;
      if (dateFilter === "yesterday" && oDate !== yesterdayStr) return false;
      if (dateFilter === "week" && new Date(o.created_at) < weekAgo) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (o.order_number || o.id || "").toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_phone || "").includes(q)
      );
    });
  }, [posOrders, dateFilter, searchQuery]);

  // Financial summary of filtered orders
  const stats = useMemo(() => {
    let revenue = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;
    let split = 0;
    let activeCount = 0;
    let voidCount = 0;

    filteredOrders.forEach((o) => {
      if (o.status === "cancelled") {
        voidCount++;
        return;
      }
      activeCount++;
      const amt = Number(o.total || 0);
      revenue += amt;

      const method = (o.actual_payment_method || o.payment_method || "").toLowerCase();
      if (method === "cash") cash += amt;
      else if (method === "upi" || method === "upi_qr") upi += amt;
      else if (method === "card") card += amt;
      else if (method === "split") {
        split += amt;
        const b = o.pos_split_payments || {};
        cash += Number(b.cash || 0);
        upi += Number(b.upi || 0);
        card += Number(b.card || 0);
      } else {
        cash += amt;
      }
    });

    const aov = activeCount > 0 ? Math.round(revenue / activeCount) : 0;
    return { revenue, cash, upi, card, split, activeCount, voidCount, aov };
  }, [filteredOrders]);

  // Void / Cancel POS Bill Mutation
  const voidOrderMutation = useMutation({
    mutationFn: async ({ order, reason }: { order: any; reason: string }) => {
      // 1. Update order status to cancelled
      const { error: updateErr } = await (supabase as any)
        .from("orders")
        .update({
          status: "cancelled",
          cancellation_reason: reason || "Voided at POS counter",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateErr) throw updateErr;

      // 2. Atomically restore inventory stock
      await restoreOrderStock(order.id);
    },
    onSuccess: (_, { order }) => {
      toast.success(`Bill #${order.order_number || order.id.slice(0, 8)} voided. Stock restored!`);
      setVoidConfirmOrder(null);
      setVoidReason("");
      qc.invalidateQueries({ queryKey: ["admin", "pos_past_bills_register"] });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "pos-orders-today"] });
    },
    onError: (err: any) => {
      toast.error("Failed to void bill: " + err.message);
    },
  });

  // Anti-theft Reprint Receipt Action
  const handleReprintReceipt = async (order: any) => {
    try {
      setReprintingId(order.id);
      const reprintCount = Number(order.reprint_count || 0) + 1;

      // Increment reprint counter in database for audit trail
      await (supabase as any)
        .from("orders")
        .update({
          reprint_count: reprintCount,
          last_reprinted_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      const items: PosReceiptItem[] = (order.items || order.order_items || []).map((it: any) => ({
        name: it.name || it.product_name || "Seafood Item",
        weightKg: Number(it.qty || it.weight || 1),
        qty: Math.round(Number(it.qty || 1)),
        unitPrice: Number(it.price || it.unit_price || 0),
        totalPrice: Number(it.line_total || it.total_price || (it.price * it.qty) || 0),
        cuttingStyle: it.cutting_style || undefined,
      }));

      const dateStr = formatInvoiceDateTime(order.created_at, true);

      const receiptData: PosReceiptData = {
        receiptNo: order.order_number || order.id.slice(0, 8),
        date: dateStr,
        cashierName: order.pos_cashier_name || "Counter Staff",
        customerName: order.customer_name || "Walk-in Customer",
        customerPhone: order.customer_phone !== "9999999999" ? order.customer_phone : undefined,
        items,
        subtotal: Number(order.subtotal || order.total || 0),
        discount: Number(order.discount || 0),
        gstAmount: Number(order.gst_amount || 0),
        total: Number(order.total || 0),
        paymentMethod: order.payment_method || "cash",
        amountTendered: order.pos_amount_tendered ? Number(order.pos_amount_tendered) : undefined,
        changeDue: order.pos_change_due ? Number(order.pos_change_due) : undefined,
        upiRef: order.actual_payment_ref || undefined,
        storeName: storeSettings?.store_name || "Fish N Fresh Hub",
        storeAddress: storeSettings?.store_address || undefined,
        storePhone: storeSettings?.contact_phone || undefined,
        storeGstin: storeSettings?.gst_number || undefined,
        // Anti-theft watermark
        isReprint: true,
        reprintCount,
        reprintTimestamp: new Date().toLocaleTimeString("en-IN"),
        splitPayments: order.pos_split_payments || undefined,
      };

      const printerConfig = getSavedPrinterConfig();
      const escPosBytes = buildPosReceiptEscPos(receiptData, printerConfig);
      const fallbackHtml = buildPosReceiptHtml(receiptData, printerConfig);

      await sendEscPosToPrinter(escPosBytes, printerConfig, fallbackHtml);
      toast.success(`Reprinted Bill #${receiptData.receiptNo} (Reprint #${reprintCount})`);
      qc.invalidateQueries({ queryKey: ["admin", "pos_past_bills_register"] });
    } catch (err: any) {
      toast.error("Failed to reprint receipt: " + err.message);
    } finally {
      setReprintingId(null);
    }
  };

  // WhatsApp Deep Link Share
  const handleWhatsAppShare = (order: any) => {
    const phone = order.customer_phone || "";
    if (!phone || phone === "9999999999") {
      toast.info("Customer mobile number was not recorded for this bill. You can share with any phone number.");
    }

    const items: PosReceiptItem[] = (order.items || order.order_items || []).map((it: any) => ({
      name: it.name || "Seafood Item",
      weightKg: Number(it.qty || 1),
      unitPrice: Number(it.price || 0),
      totalPrice: Number(it.line_total || 0),
      cuttingStyle: it.cutting_style,
    }));

    const receiptData: PosReceiptData = {
      receiptNo: order.order_number || order.id.slice(0, 8),
      date: formatInvoiceDateTime(order.created_at, true),
      cashierName: order.pos_cashier_name || "Counter Staff",
      customerName: order.customer_name,
      customerPhone: phone,
      items,
      subtotal: Number(order.subtotal || order.total || 0),
      discount: Number(order.discount || 0),
      gstAmount: Number(order.gst_amount || 0),
      total: Number(order.total || 0),
      paymentMethod: order.actual_payment_method || order.payment_method || "cash",
      storeName: storeSettings?.store_name || "Fish N Fresh Hub",
      splitPayments: order.pos_split_payments || undefined,
    };

    const text = generatePosWhatsAppText(receiptData, order.id);
    const targetPhone = (phone && phone !== "9999999999") ? phone : "";
    const url = getPosWhatsAppShareUrl(targetPhone, text);
    window.open(url, "_blank");
  };

  // Export Filtered Register to CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      toast.info("No bills to export in current filter.");
      return;
    }

    const headers = [
      "Bill No",
      "Date & Time",
      "Customer Name",
      "Customer Phone",
      "Status",
      "Payment Mode",
      "Total (INR)",
      "Cash (INR)",
      "UPI (INR)",
      "Card (INR)",
      "Cashier",
      "Reprint Count",
    ];

    const rows = filteredOrders.map((o) => {
      const split = o.pos_split_payments || {};
      const method = (o.actual_payment_method || o.payment_method || "").toLowerCase();
      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;

      if (method === "cash") cashAmt = Number(o.total || 0);
      else if (method === "upi" || method === "upi_qr") upiAmt = Number(o.total || 0);
      else if (method === "card") cardAmt = Number(o.total || 0);
      else if (method === "split") {
        cashAmt = Number(split.cash || 0);
        upiAmt = Number(split.upi || 0);
        cardAmt = Number(split.card || 0);
      }

      return [
        `"${o.order_number || o.id}"`,
        `"${new Date(o.created_at).toLocaleString("en-IN")}"`,
        `"${(o.customer_name || "").replace(/"/g, '""')}"`,
        `"${(o.customer_phone || "").replace(/"/g, '""')}"`,
        o.status,
        method.toUpperCase(),
        o.total || 0,
        cashAmt,
        upiAmt,
        cardAmt,
        `"${(o.pos_cashier_name || "").replace(/"/g, '""')}"`,
        o.reprint_count || 0,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pos-sales-register-${dateFilter}-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredOrders.length} POS bills to CSV`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-border shadow-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <DialogHeader className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-5 pb-4 border-b border-border shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  POS Counter Sales Register &amp; Past Bills
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  View, reprint, WhatsApp share, void, or export past counter sales with anti-theft audit stamps.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs h-8"
                  onClick={handleExportCsv}
                >
                  <Download className="mr-1.5 size-3.5" /> Export Register (.csv)
                </Button>
              </div>
            </div>

            {/* Financial Summary Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3">
              <div className="rounded-xl bg-card border p-2.5 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">POS Revenue</span>
                <p className="text-base font-black text-primary font-mono">{formatINR(stats.revenue)}</p>
                <span className="text-[10px] text-muted-foreground">{stats.activeCount} bills · AOV {formatINR(stats.aov)}</span>
              </div>

              <div className="rounded-xl bg-card border p-2.5 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Banknote className="size-3 text-amber-500" /> Cash
                </span>
                <p className="text-sm font-bold text-foreground font-mono">{formatINR(stats.cash)}</p>
                <span className="text-[10px] text-muted-foreground">Drawer notes</span>
              </div>

              <div className="rounded-xl bg-card border p-2.5 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <QrCode className="size-3 text-emerald-500" /> UPI QR
                </span>
                <p className="text-sm font-bold text-foreground font-mono">{formatINR(stats.upi)}</p>
                <span className="text-[10px] text-muted-foreground">Direct Bank</span>
              </div>

              <div className="rounded-xl bg-card border p-2.5 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <CreditCard className="size-3 text-sky-500" /> Card / Split
                </span>
                <p className="text-sm font-bold text-foreground font-mono">{formatINR(stats.card + stats.split)}</p>
                <span className="text-[10px] text-muted-foreground">Terminal / Multi</span>
              </div>

              <div className="rounded-xl bg-card border p-2.5 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <XCircle className="size-3 text-destructive" /> Voided Bills
                </span>
                <p className="text-sm font-bold text-destructive font-mono">{stats.voidCount}</p>
                <span className="text-[10px] text-muted-foreground">Cancelled sales</span>
              </div>
            </div>
          </DialogHeader>

          {/* Search & Filter Toolbar */}
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by Bill No, Customer Name, Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(["today", "yesterday", "week", "all"] as const).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={dateFilter === d ? "default" : "outline"}
                  className="rounded-xl h-7 text-xs font-semibold uppercase px-2.5"
                  onClick={() => setDateFilter(d)}
                >
                  {d === "today" ? "Today" : d === "yesterday" ? "Yesterday" : d === "week" ? "Last 7 Days" : "All Time"}
                </Button>
              ))}
            </div>
          </div>

          {/* Bills List Table */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {isLoading && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading counter bills register...
              </div>
            )}

            {!isLoading && filteredOrders.length === 0 && (
              <div className="p-12 text-center rounded-2xl border border-dashed text-muted-foreground text-xs">
                No counter sales found matching your filter.
              </div>
            )}

            {filteredOrders.map((order) => {
              const isVoid = order.status === "cancelled";
              const method = (order.actual_payment_method || order.payment_method || "cash").toLowerCase();
              const itemsList: any[] = order.items || order.order_items || [];

              return (
                <Card
                  key={order.id}
                  className={`border transition-all rounded-2xl overflow-hidden ${
                    isVoid
                      ? "border-destructive/30 bg-destructive/5 opacity-75"
                      : "border-border/80 hover:border-primary/40 bg-card"
                  }`}
                >
                  <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left Details */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          #{order.order_number || order.id.slice(0, 8)}
                        </span>

                        {isVoid ? (
                          <Badge variant="destructive" className="text-[10px]">
                            VOIDED / CANCELLED
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            DELIVERED &amp; PAID
                          </Badge>
                        )}

                        <Badge variant="outline" className="text-[10px] uppercase font-mono font-semibold">
                          {method === "upi_qr" ? "UPI QR" : method}
                        </Badge>

                        {Number(order.reprint_count || 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Reprinted ×{order.reprint_count}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(order.created_at).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <User className="size-3 text-muted-foreground" />
                          {order.customer_name || "Walk-in"}
                          {order.customer_phone && order.customer_phone !== "9999999999" && (
                            <span className="font-mono text-muted-foreground">({order.customer_phone})</span>
                          )}
                        </span>
                        <span>•</span>
                        <span>Cashier: {order.pos_cashier_name || "Staff"}</span>
                      </div>

                      {/* Items Summary line */}
                      <p className="text-[11px] text-muted-foreground truncate">
                        {itemsList.map((it: any) => `${it.name} (${it.qty} ${it.unit || "kg"})`).join(", ")}
                      </p>
                    </div>

                    {/* Right Amount & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      <div className="text-left sm:text-right">
                        <p className={`text-base font-black font-mono ${isVoid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {formatINR(Number(order.total || 0))}
                        </p>
                        {order.pos_split_payments && (
                          <span className="text-[10px] text-primary font-mono block">
                            Cash ₹{order.pos_split_payments.cash || 0} · UPI ₹{order.pos_split_payments.upi || 0}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {/* 1. View Tax Invoice */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 rounded-xl text-xs"
                          onClick={() => setSelectedInvoiceOrder(order)}
                          title="View Official GST Tax Invoice"
                        >
                          <FileText className="size-3.5 mr-1" /> Invoice
                        </Button>

                        {/* 2. Reprint Thermal Receipt */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reprintingId === order.id}
                          className="h-8 px-2.5 rounded-xl text-xs text-primary border-primary/30 hover:bg-primary/10"
                          onClick={() => handleReprintReceipt(order)}
                          title="Reprint Thermal Receipt with Anti-Theft Watermark"
                        >
                          <Printer className="size-3.5 mr-1" />
                          {reprintingId === order.id ? "Printing..." : "Reprint"}
                        </Button>

                        {/* 3. WhatsApp Deep Link */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 rounded-xl text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => handleWhatsAppShare(order)}
                          title="Share Receipt on WhatsApp"
                        >
                          <Share2 className="size-3.5" />
                        </Button>

                        {/* 4. Void / Cancel Bill */}
                        {!isVoid && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setVoidConfirmOrder(order)}
                            title="Void Bill & Restore Inventory Stock"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tax Invoice Full Preview Modal */}
      {selectedInvoiceOrder && (
        <TaxInvoiceModal
          isOpen={!!selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
          order={selectedInvoiceOrder}
          settings={storeSettings}
        />
      )}

      {/* Void Confirmation Dialog with Inventory Restoration */}
      <AlertDialog open={!!voidConfirmOrder} onOpenChange={(open) => !open && setVoidConfirmOrder(null)}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive font-bold">
              <ShieldAlert className="size-5" />
              <AlertDialogTitle>Void / Cancel Counter Bill?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2">
              <p>
                Are you sure you want to void Bill <strong className="text-foreground">#{voidConfirmOrder?.order_number || voidConfirmOrder?.id?.slice(0, 8)}</strong> for <strong className="text-foreground">{formatINR(Number(voidConfirmOrder?.total || 0))}</strong>?
              </p>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
                ⚠️ All product inventory for this bill will be <strong>automatically restored</strong> back to real-time stock.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <Input
              placeholder="Reason for cancellation (e.g. customer returned item, wrong billing)..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="text-xs rounded-xl"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (voidConfirmOrder) {
                  voidOrderMutation.mutate({ order: voidConfirmOrder, reason: voidReason });
                }
              }}
              disabled={voidOrderMutation.isPending}
            >
              {voidOrderMutation.isPending ? "Voiding & Restoring Stock..." : "Confirm Void Bill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
