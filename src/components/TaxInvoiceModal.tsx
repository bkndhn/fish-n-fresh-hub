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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-card">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                GSTIN Tax Invoice Preview
              </DialogTitle>
              <div className="text-xs text-muted-foreground font-mono">{invoiceNumber}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              <Printer className="size-3.5" /> Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Invoice Render Card */}
        <div className="rounded-xl border border-border/70 bg-background p-4 sm:p-6 text-foreground space-y-4 text-xs">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-1">
                Original for Recipient &bull; Tax Invoice
              </span>
              <div className="text-lg font-extrabold text-foreground">{invoiceData.sellerTradeName}</div>
              <div className="text-xs text-muted-foreground">{invoiceData.sellerLegalName}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                FSSAI Lic: <strong className="text-foreground">{invoiceData.sellerFssai}</strong>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary">{invoiceNumber}</div>
              <div className="text-muted-foreground text-[11px] mt-0.5">Date &amp; Time: <span className="font-semibold text-foreground">{invoiceDate}</span></div>
              <div className="text-muted-foreground text-[11px]">Ref: #{invoiceData.orderNumber}</div>
            </div>
          </div>

          {/* Supplier & Buyer Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/80 p-3 bg-muted/20">
              <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                Supplier / Billed From
              </div>
              <div className="font-semibold text-foreground">{invoiceData.sellerLegalName}</div>
              <div className="text-muted-foreground text-[11px]">{invoiceData.sellerAddress}</div>
              <div className="text-[11px] mt-1 font-mono">
                GSTIN: <strong className="text-foreground">{invoiceData.sellerGstin}</strong>
              </div>
              <div className="text-[11px] text-muted-foreground">Phone: {invoiceData.sellerPhone}</div>
            </div>

            <div className="rounded-lg border border-border/80 p-3 bg-muted/20">
              <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                Recipient / Billed To
              </div>
              <div className="font-semibold text-foreground">{invoiceData.buyerName}</div>
              <div className="text-muted-foreground text-[11px]">{invoiceData.buyerAddress}</div>
              <div className="text-[11px] mt-1">
                Phone: <strong className="text-foreground">{invoiceData.buyerPhone}</strong>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Place of Supply: {invoiceData.placeOfSupply} (33)
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="p-2.5 text-center w-8">#</th>
                  <th className="p-2.5">Item Description</th>
                  <th className="p-2.5 text-center w-20">HSN</th>
                  <th className="p-2.5 text-right w-24">Qty</th>
                  <th className="p-2.5 text-right w-24">Rate</th>
                  <th className="p-2.5 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {parsedItems.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="p-2.5 text-center text-muted-foreground">{i + 1}</td>
                    <td className="p-2.5">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      {item.cuttingStyle && (
                        <div className="text-[10px] text-muted-foreground">
                          Cut: {item.cuttingStyle}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[11px] text-muted-foreground">
                      {item.hsnCode}
                    </td>
                    <td className="p-2.5 text-right font-medium">
                      {item.qty} {item.unit}
                    </td>
                    <td className="p-2.5 text-right text-muted-foreground">
                      ₹{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-foreground">
                      ₹{item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Words */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-lg border border-dashed border-border p-3 bg-muted/10 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Amount in Words</div>
              <div className="text-xs font-semibold text-foreground leading-relaxed">
                {amountInWords}
              </div>
              <div className="text-[10px] text-muted-foreground pt-2">
                Reverse Charge: <strong>No</strong> &bull; Mode:{" "}
                <strong className="uppercase">{invoiceData.paymentMethod}</strong>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
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
                  <span>Delivery & Handling (SAC 9963)</span>
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
