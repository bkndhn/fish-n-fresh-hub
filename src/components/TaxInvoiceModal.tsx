import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText } from "lucide-react";
import {
  type TaxInvoiceData,
  type InvoiceItem,
  numberToIndianWords,
  printOrDownloadTaxInvoice,
} from "@/lib/invoicePdf";
import { formatINR, formatInvoiceDateTime } from "@/lib/format";

interface TaxInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  settings: any;
}

export function TaxInvoiceModal({ isOpen, onClose, order, settings }: TaxInvoiceModalProps) {
  if (!order) return null;

  const invoiceNumber = `INV-${order.order_number || order.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = formatInvoiceDateTime(order.created_at || Date.now(), true);

  const parsedItems: InvoiceItem[] = Array.isArray(order.items)
    ? order.items.map((it: any) => ({
        name: it.name || it.product_name || "Seafood Item",
        hsnCode: it.hsn_code || "0302",
        qty: Number(it.qty || it.quantity || 1),
        unit: it.unit || "kg",
        unitPrice: Number(it.price || it.unit_price || 0),
        totalPrice: Number(it.line_total || (Number(it.price || 0) * Number(it.qty || 1))),
        cuttingStyle: it.cutting_style,
      }))
    : [];

  const invoiceData: TaxInvoiceData = {
    invoiceNumber,
    orderNumber: order.order_number || order.id.slice(0, 8),
    invoiceDate,
    orderDate: invoiceDate,
    placeOfSupply: "Tamil Nadu",
    stateCode: "33",
    reverseCharge: false,
    sellerTradeName: settings?.store_name || "Fish N Fresh Hub",
    sellerLegalName: settings?.gst_legal_name || settings?.store_name || "Fish N Fresh Hyperlocal Enterprise LLP",
    sellerGstin: settings?.gst_number || "33AAAAF0000A1Z5",
    sellerFssai: settings?.fssai_license_no || "12423008000451",
    sellerAddress: settings?.store_address || "No. 12, Harbour Bypass Road, Thoothukudi - 628001",
    sellerPhone: settings?.contact_phone || settings?.support_phone || "9843061919",
    sellerEmail: settings?.contact_email || "billing@fishnfresh.in",
    buyerName: order.customer_name || "Customer",
    buyerPhone: order.customer_phone || "-",
    buyerAddress: order.customer_address || "Store Pickup / Counter Delivery",
    items: parsedItems,
    subtotal: Number(order.subtotal || order.total || 0),
    discount: Number(order.discount || 0),
    deliveryFee: Number(order.delivery_fee || 0),
    gstAmount: Number(order.gst_amount || 0),
    total: Number(order.total || 0),
    paymentMethod: order.actual_payment_method || order.payment_method || "COD",
    paymentStatus: order.payment_status || "completed",
    paymentRef: order.actual_payment_ref || undefined,
  };

  const amountInWords = numberToIndianWords(invoiceData.total);

  const handlePrint = () => {
    printOrDownloadTaxInvoice(invoiceData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-card">
        <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-border pr-8 sm:pr-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-bold text-foreground truncate">
                GSTIN Tax Invoice Preview
              </DialogTitle>
              <div className="text-[11px] sm:text-xs text-muted-foreground font-mono truncate">{invoiceNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm h-8 px-3"
            >
              <Printer className="size-3.5" /> <span>Print / Save PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Invoice Render Card */}
        <div className="rounded-xl border border-border/70 bg-background p-3 sm:p-6 text-foreground space-y-4 text-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2.5 border-b border-border pb-3.5">
            <div className="min-w-0">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-1">
                Original for Recipient &bull; Tax Invoice
              </span>
              <div className="text-base sm:text-lg font-extrabold text-foreground leading-snug break-words">{invoiceData.sellerTradeName}</div>
              <div className="text-xs text-muted-foreground break-words">{invoiceData.sellerLegalName}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                FSSAI Lic: <strong className="text-foreground">{invoiceData.sellerFssai}</strong>
              </div>
            </div>
            <div className="w-full sm:w-auto text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
              <div className="text-sm sm:text-base font-bold text-primary break-all">{invoiceNumber}</div>
              <div className="text-muted-foreground text-[11px] mt-0.5">
                Date &amp; Time: <span className="font-semibold text-foreground">{invoiceDate}</span>
              </div>
              <div className="text-muted-foreground text-[11px]">Ref: #{invoiceData.orderNumber}</div>
            </div>
          </div>

          {/* Supplier & Buyer Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/80 p-3 bg-muted/20 min-w-0">
              <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                Supplier / Billed From
              </div>
              <div className="font-semibold text-foreground break-words">{invoiceData.sellerLegalName}</div>
              <div className="text-muted-foreground text-[11px] break-words">{invoiceData.sellerAddress}</div>
              <div className="text-[11px] mt-1 font-mono">
                GSTIN: <strong className="text-foreground">{invoiceData.sellerGstin}</strong>
              </div>
              <div className="text-[11px] text-muted-foreground">Phone: {invoiceData.sellerPhone}</div>
            </div>

            <div className="rounded-lg border border-border/80 p-3 bg-muted/20 min-w-0">
              <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                Recipient / Billed To
              </div>
              <div className="font-semibold text-foreground break-words">{invoiceData.buyerName}</div>
              <div className="text-muted-foreground text-[11px] break-words">{invoiceData.buyerAddress}</div>
              <div className="text-[11px] mt-1">
                Phone: <strong className="text-foreground">{invoiceData.buyerPhone}</strong>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Place of Supply: {invoiceData.placeOfSupply} (33)
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="p-2 sm:p-2.5 text-center w-7 hidden sm:table-cell">#</th>
                  <th className="p-2 sm:p-2.5">Item Description</th>
                  <th className="p-2 sm:p-2.5 text-center w-16 hidden sm:table-cell">HSN</th>
                  <th className="p-2 sm:p-2.5 text-right w-16 sm:w-20">Qty</th>
                  <th className="p-2 sm:p-2.5 text-right w-20 sm:w-24">Rate</th>
                  <th className="p-2 sm:p-2.5 text-right w-20 sm:w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {parsedItems.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="p-2 sm:p-2.5 text-center text-muted-foreground hidden sm:table-cell">{i + 1}</td>
                    <td className="p-2 sm:p-2.5">
                      <div className="font-semibold text-foreground leading-snug">{item.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        {item.cuttingStyle && <span>Cut: {item.cuttingStyle}</span>}
                        {item.cuttingStyle && <span className="sm:hidden">&bull;</span>}
                        <span className="font-mono sm:hidden">HSN: {item.hsnCode}</span>
                      </div>
                    </td>
                    <td className="p-2 sm:p-2.5 text-center font-mono text-[11px] text-muted-foreground hidden sm:table-cell">
                      {item.hsnCode}
                    </td>
                    <td className="p-2 sm:p-2.5 text-right font-medium whitespace-nowrap">
                      {item.qty} {item.unit}
                    </td>
                    <td className="p-2 sm:p-2.5 text-right text-muted-foreground whitespace-nowrap">
                      ₹{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="p-2 sm:p-2.5 text-right font-bold text-foreground whitespace-nowrap">
                      ₹{item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Words */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg border border-dashed border-border p-3 bg-muted/10 space-y-1.5 min-w-0">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Amount in Words</div>
              <div className="text-xs font-semibold text-foreground leading-relaxed break-words">
                {amountInWords}
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">
                Reverse Charge: <strong>No</strong> &bull; Mode:{" "}
                <strong className="uppercase">{invoiceData.paymentMethod}</strong>
              </div>
            </div>

            <div className="space-y-1.5 text-xs min-w-0">
              <div className="flex justify-between text-muted-foreground">
                <span>Items Subtotal</span>
                <span className="font-medium text-foreground">₹{invoiceData.subtotal.toFixed(2)}</span>
              </div>
              {invoiceData.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-medium">-₹{invoiceData.discount.toFixed(2)}</span>
                </div>
              )}
              {invoiceData.deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery &amp; Handling (SAC 9963)</span>
                  <span className="font-medium text-foreground">₹{invoiceData.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              {invoiceData.gstAmount > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST (2.5%)</span>
                    <span className="font-medium text-foreground">₹{(invoiceData.gstAmount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST (2.5%)</span>
                    <span className="font-medium text-foreground">₹{(invoiceData.gstAmount / 2).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm font-extrabold text-primary border-t-2 border-primary/40 pt-2 mt-1">
                <span>INVOICE TOTAL</span>
                <span>₹{invoiceData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
