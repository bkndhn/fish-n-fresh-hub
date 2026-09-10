/**
 * GSTIN-Compliant Tax Invoice Engine.
 * 
 * Complies with Indian Goods and Services Tax Act standards:
 * - HSN codes (0302 for Fresh Seafood, 0207 for Poultry/Meat, 9963 for Delivery)
 * - State Code / Place of Supply
 * - CGST / SGST breakdown
 * - Number to Indian Words conversion (Rupees ... Only)
 * - Printable Vector PDF output via browser print engine
 */

export interface InvoiceItem {
  name: string;
  hsnCode?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  gstPercent?: number;
  cuttingStyle?: string;
}

export interface TaxInvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  orderDate: string;
  placeOfSupply: string;
  stateCode: string;
  reverseCharge: boolean;

  // Seller details
  sellerTradeName: string;
  sellerLegalName: string;
  sellerGstin: string;
  sellerFssai: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail?: string;

  // Buyer details
  buyerName: string;
  buyerPhone: string;
  buyerAddress?: string;
  buyerGstin?: string;

  // Items & Financials
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  gstAmount: number;
  total: number;

  paymentMethod: string;
  paymentStatus: string;
  paymentRef?: string;
}

/**
 * Converts numbers to Indian English Words (Rupees Lakhs/Thousands/Hundreds/Paise).
 */
export function numberToIndianWords(num: number): string {
  if (num === 0) return "Rupees Zero Only";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n] ?? "";
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${b[tens] ?? ""}${ones > 0 ? " " + (a[ones] ?? "") : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundreds > 0) {
      res += `${a[hundreds] ?? ""} Hundred`;
      if (rest > 0) res += " and ";
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  const rounded = Math.round(num * 100) / 100;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let remaining = integerPart;
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;

  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;

  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  const hundreds = remaining;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertTwoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (hundreds > 0) parts.push(convertThreeDigits(hundreds));

  let words = `Rupees ${parts.join(" ")}`.trim();
  if (decimalPart > 0) {
    words += ` and ${convertTwoDigits(decimalPart)} Paise`;
  }
  words += " Only";

  return words;
}

/**
 * Builds the complete HTML string for the Tax Invoice document.
 */
export function generateTaxInvoiceHtml(data: TaxInvoiceData): string {
  const words = numberToIndianWords(data.total);

  // Derive tax calculations
  // In India: Fresh seafood (0302) & fresh meat (0207) unbranded raw is usually 0% GST.
  // Value-added / ready-to-cook items or delivery fee (9963) may have 5% GST (2.5% CGST + 2.5% SGST).
  const taxableAmount = Math.max(0, data.subtotal - data.discount);
  const cgstAmount = Math.round((data.gstAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((data.gstAmount / 2) * 100) / 100;

  const lineItemRows = data.items
    .map((item, idx) => {
      const hsn = item.hsnCode || "0302";
      const unit = item.unit || "kg";
      const qtyStr = typeof item.qty === "number" ? (item.qty % 1 === 0 ? item.qty.toString() : item.qty.toFixed(2)) : item.qty;
      const rateStr = item.unitPrice ? `₹${item.unitPrice.toFixed(2)}` : "-";
      const totalStr = `₹${item.totalPrice.toFixed(2)}`;
      const cutStr = item.cuttingStyle ? `<div style="font-size: 10px; color: #666; margin-top: 2px;">Style: ${item.cuttingStyle}</div>` : "";

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px 10px; text-align: center; color: #6b7280;">${idx + 1}</td>
          <td style="padding: 8px 10px;">
            <div style="font-weight: 600; color: #111827;">${item.name}</div>
            ${cutStr}
          </td>
          <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: #4b5563;">${hsn}</td>
          <td style="padding: 8px 10px; text-align: right; color: #374151;">${qtyStr} ${unit}</td>
          <td style="padding: 8px 10px; text-align: right; color: #374151;">${rateStr}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: #111827;">${totalStr}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Tax Invoice - ${data.invoiceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      color: #1f2937;
      line-height: 1.45;
      background: #f9fafb;
      padding: 20px 0;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .invoice-card {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .badge-tax-invoice {
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 6px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .party-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    .party-box {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 14px;
      background: #ffffff;
    }
    .party-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0369a1;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 1px solid #f0fdf4;
      padding-bottom: 4px;
    }
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11.5px;
    }
    table.invoice-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10.5px;
      letter-spacing: 0.3px;
      padding: 8px 10px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 24px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .words-box {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 4px 6px;
    }
    .summary-table tr.grand-total td {
      font-size: 14px;
      font-weight: 800;
      color: #0369a1;
      border-top: 2px solid #0284c7;
      border-bottom: 2px solid #0284c7;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .footer-terms {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sign-box {
      text-align: center;
      min-width: 180px;
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <span class="badge-tax-invoice">ORIGINAL FOR RECIPIENT &bull; TAX INVOICE</span>
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px;">${data.sellerTradeName}</h1>
        <div style="font-size: 12px; color: #475569; font-weight: 500;">${data.sellerLegalName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">FSSAI Lic No: <strong>${data.sellerFssai || "12423008000451"}</strong></div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 15px; font-weight: 800; color: #0369a1;">${data.invoiceNumber}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Date &amp; Time: <strong>${data.invoiceDate}</strong></div>
        <div style="font-size: 11px; color: #64748b;">Order Ref: <strong>#${data.orderNumber}</strong></div>
      </div>
    </div>

    <!-- Meta Details Bar -->
    <div class="meta-grid">
      <div>
        <div style="font-size: 11px; color: #64748b;">Place of Supply: <strong>${data.placeOfSupply} (State Code: ${data.stateCode})</strong></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Reverse Charge Applicable: <strong>${data.reverseCharge ? "Yes" : "No"}</strong></div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #64748b;">Payment Method: <strong style="text-transform: uppercase;">${data.paymentMethod}</strong></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Payment Status: <strong style="color: ${data.paymentStatus === 'paid' ? '#16a34a' : '#d97706'}; text-transform: uppercase;">${data.paymentStatus}</strong>${data.paymentRef ? ` (${data.paymentRef})` : ""}</div>
      </div>
    </div>

    <!-- Parties Grid (Billed By vs Billed To) -->
    <div class="party-grid">
      <div class="party-box">
        <div class="party-title">Supplier / Billed From</div>
        <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${data.sellerLegalName}</div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">${data.sellerAddress}</div>
        <div style="margin-top: 4px; font-size: 11px;">
          GSTIN: <strong style="font-family: monospace; color: #0f172a;">${data.sellerGstin}</strong>
        </div>
        <div style="font-size: 11px; color: #475569;">Contact: ${data.sellerPhone}${data.sellerEmail ? ` | ${data.sellerEmail}` : ""}</div>
      </div>

      <div class="party-box">
        <div class="party-title">Recipient / Billed To</div>
        <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${data.buyerName}</div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">${data.buyerAddress || "Counter Pickup / Store Delivery"}</div>
        <div style="margin-top: 4px; font-size: 11px; color: #475569;">
          Phone: <strong>${data.buyerPhone}</strong>
        </div>
        ${data.buyerGstin ? `<div style="font-size: 11px; color: #475569;">Buyer GSTIN: <strong>${data.buyerGstin}</strong></div>` : ""}
      </div>
    </div>

    <!-- Line Items Table -->
    <table class="invoice-table">
      <thead>
        <tr>
          <th style="width: 36px; text-align: center;">#</th>
          <th>Description of Goods / Item</th>
          <th style="width: 70px; text-align: center;">HSN Code</th>
          <th style="width: 85px; text-align: right;">Qty & Unit</th>
          <th style="width: 85px; text-align: right;">Rate (₹)</th>
          <th style="width: 95px; text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
      </tbody>
    </table>

    <!-- Financial Breakdown & Words -->
    <div class="summary-grid">
      <div>
        <div class="words-box">
          <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px;">Amount in Words:</div>
          <div style="font-size: 11.5px; font-weight: 600; color: #0f172a; line-height: 1.4;">${words}</div>
        </div>

        <div style="margin-top: 14px; font-size: 10.5px; color: #64748b;">
          <strong>Tax Note:</strong> Fresh raw unprocessed fish and poultry are exempt from GST under HSN 0302 / 0207. Delivery freight is classified under SAC 9963.
        </div>
      </div>

      <div>
        <table class="summary-table">
          <tr>
            <td style="color: #64748b;">Subtotal (Items)</td>
            <td style="text-align: right; font-weight: 600;">₹${data.subtotal.toFixed(2)}</td>
          </tr>
          ${data.discount > 0 ? `
          <tr>
            <td style="color: #16a34a;">Discount / FreshCash</td>
            <td style="text-align: right; color: #16a34a; font-weight: 600;">-₹${data.discount.toFixed(2)}</td>
          </tr>
          ` : ""}
          ${data.deliveryFee > 0 ? `
          <tr>
            <td style="color: #64748b;">Delivery & Handling</td>
            <td style="text-align: right; font-weight: 600;">₹${data.deliveryFee.toFixed(2)}</td>
          </tr>
          ` : ""}
          ${cgstAmount > 0 ? `
          <tr>
            <td style="color: #64748b;">Central GST (CGST)</td>
            <td style="text-align: right; font-weight: 600;">₹${cgstAmount.toFixed(2)}</td>
          </tr>
          ` : ""}
          ${sgstAmount > 0 ? `
          <tr>
            <td style="color: #64748b;">State GST (SGST)</td>
            <td style="text-align: right; font-weight: 600;">₹${sgstAmount.toFixed(2)}</td>
          </tr>
          ` : ""}
          <tr class="grand-total">
            <td>INVOICE TOTAL</td>
            <td style="text-align: right;">₹${data.total.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer Terms & Signatory -->
    <div class="footer-terms">
      <div style="max-width: 480px;">
        <div style="font-weight: 700; margin-bottom: 2px; color: #374151;">Terms & Conditions:</div>
        <div>1. Perishable goods once delivered in good condition cannot be returned unless reported within 60 mins.</div>
        <div>2. Certified that all particulars are true, and value indicated is actual price charged.</div>
        <div>3. Computer generated tax invoice; physical signature not mandatory under Rule 46 of CGST Rules 2017.</div>
      </div>
      <div class="sign-box">
        <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 30px;">For ${data.sellerLegalName}</div>
        <div style="border-top: 1px dashed #94a3b8; padding-top: 4px; font-size: 10px; color: #475569;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Open print window to directly print or save as vector PDF.
 */
export function printOrDownloadTaxInvoice(data: TaxInvoiceData): void {
  const html = generateTaxInvoiceHtml(data);
  const printWindow = window.open("", "_blank", "width=900,height=750");
  if (!printWindow) {
    alert("Please allow popups for this site to print or save the Tax Invoice PDF.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Trigger print after styles render
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };
}
