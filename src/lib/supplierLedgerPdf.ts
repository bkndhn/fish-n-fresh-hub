/**
 * Supplier Account Statement & Outstanding Ledger PDF Engine
 * Generates print-ready vector PDF statements with debit/credit running balances,
 * bill-wise aging breakdown, and settlement details.
 */

export interface SupplierLedgerEntry {
  date: string;
  referenceNo: string;
  description: string;
  type: "inward_catch" | "payment";
  debit: number; // Purchases (Increases balance due)
  credit: number; // Payments made (Decreases balance due)
  runningBalance: number;
  paymentMethod?: string | null | undefined;
  paymentRef?: string | null | undefined;
}

export interface SupplierOutstandingBill {
  referenceNo: string;
  inwardDate: string;
  itemsSummary: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: "unpaid" | "partial" | "settled";
  ageDays: number;
}

export interface SupplierStatementData {
  storeName: string;
  storeAddress?: string | null | undefined;
  storePhone?: string | null | undefined;
  storeEmail?: string | null | undefined;
  storeGstin?: string | null | undefined;
  storeFssai?: string | null | undefined;

  supplierName: string;
  supplierHarbour?: string | null | undefined;
  supplierContact?: string | null | undefined;
  supplierPhone: string;
  supplierEmail?: string | null | undefined;
  supplierGstin?: string | null | undefined;
  supplierUpiId?: string | null | undefined;

  fromDate: string;
  toDate: string;
  generatedAt: string;

  totalPurchases: number; // Total Debits
  totalPayments: number; // Total Credits
  closingBalanceDue: number; // Net Payable

  ledgerEntries: SupplierLedgerEntry[];
  outstandingBills: SupplierOutstandingBill[];
}

export function buildSupplierStatementHtml(data: SupplierStatementData): string {
  const formatCurrency = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Supplier Statement - ${data.supplierName}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      color: #1e293b;
      background: #ffffff;
      padding: 20px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .store-brand h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0369a1;
      letter-spacing: -0.5px;
    }
    .store-brand p {
      color: #64748b;
      font-size: 11px;
    }
    .statement-badge {
      text-align: right;
    }
    .statement-title {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .period-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      margin-top: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .meta-card h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .meta-card .name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-card .sub {
      font-size: 11px;
      color: #475569;
    }
    .summary-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .kpi-box.debit {
      background: #fff7ed;
      border-color: #ffedd5;
    }
    .kpi-box.credit {
      background: #f0fdf4;
      border-color: #dcfce7;
    }
    .kpi-box.balance {
      background: #eff6ff;
      border-color: #dbeafe;
    }
    .kpi-box .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi-box .value {
      font-size: 16px;
      font-weight: 800;
      margin-top: 2px;
    }
    .kpi-box.debit .value { color: #c2410c; }
    .kpi-box.credit .value { color: #15803d; }
    .kpi-box.balance .value { color: #1d4ed8; }

    .section-header {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td {
      padding: 7px 8px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-partial { background: #fef3c7; color: #92400e; }
    .badge-unpaid { background: #fee2e2; color: #991b1b; }

    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
      color: #94a3b8;
    }
    .signatures {
      display: flex;
      gap: 40px;
    }
    .sign-box {
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 5px;
      width: 130px;
      color: #475569;
      font-weight: 600;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="store-brand">
      <h1>${data.storeName}</h1>
      <p>${data.storeAddress || "Harbour Road, Kasimedu, Chennai"}</p>
      ${data.storeGstin ? `<p><strong>GSTIN:</strong> ${data.storeGstin} · <strong>FSSAI:</strong> ${data.storeFssai || "1242300000000"}</p>` : ""}
      <p><strong>Contact:</strong> ${data.storePhone || "9843061919"} ${data.storeEmail ? `· ${data.storeEmail}` : ""}</p>
    </div>
    <div class="statement-badge">
      <div class="statement-title">Supplier Ledger Statement</div>
      <div class="period-badge">${data.fromDate} to ${data.toDate}</div>
      <p style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Generated on ${data.generatedAt}</p>
    </div>
  </div>

  <!-- Parties Info -->
  <div class="meta-grid">
    <div class="meta-card">
      <h3>Supplier Account Details</h3>
      <div class="name">${data.supplierName}</div>
      ${data.supplierContact ? `<div class="sub">Contact Person: ${data.supplierContact}</div>` : ""}
      ${data.supplierHarbour ? `<div class="sub">Harbour / Jetty: ${data.supplierHarbour}</div>` : ""}
      <div class="sub">Phone: ${data.supplierPhone}</div>
      ${data.supplierGstin ? `<div class="sub">GSTIN: ${data.supplierGstin}</div>` : ""}
      ${data.supplierUpiId ? `<div class="sub"><strong>VPA / UPI:</strong> ${data.supplierUpiId}</div>` : ""}
    </div>

    <div class="meta-card">
      <h3>Account Position & Settlement</h3>
      <div class="sub">Statement Period: <strong>${data.fromDate} to ${data.toDate}</strong></div>
      <div class="sub">Total Purchases (Debits): <strong>${formatCurrency(data.totalPurchases)}</strong></div>
      <div class="sub">Total Payments Disbursed: <strong>${formatCurrency(data.totalPayments)}</strong></div>
      <div style="margin-top: 6px; font-size: 13px; font-weight: 800; color: #1d4ed8;">
        Closing Balance Due: ${formatCurrency(data.closingBalanceDue)}
      </div>
    </div>
  </div>

  <!-- Summary KPI Boxes -->
  <div class="summary-strip">
    <div class="kpi-box debit">
      <div class="label">Total Inward Purchases</div>
      <div class="value">${formatCurrency(data.totalPurchases)}</div>
    </div>
    <div class="kpi-box credit">
      <div class="label">Total Payments Made</div>
      <div class="value">${formatCurrency(data.totalPayments)}</div>
    </div>
    <div class="kpi-box balance">
      <div class="label">Net Outstanding Balance Due</div>
      <div class="value">${formatCurrency(data.closingBalanceDue)}</div>
    </div>
  </div>

  <!-- Outstanding Bill-Wise Breakdown -->
  <div class="section-header">
    <span>1. Outstanding Bill-Wise Aging Breakdown</span>
    <span style="font-size: 10px; color: #64748b;">${data.outstandingBills.length} Bill(s) Listed</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Voucher #</th>
        <th>Date</th>
        <th>Catch Itemization</th>
        <th class="right">Bill Amount</th>
        <th class="right">Paid So Far</th>
        <th class="right">Balance Due</th>
        <th class="center">Aging</th>
        <th class="center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.outstandingBills.map((b) => `
        <tr>
          <td style="font-weight: 700;">#${b.referenceNo}</td>
          <td>${b.inwardDate}</td>
          <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.itemsSummary}</td>
          <td class="right">${formatCurrency(b.totalAmount)}</td>
          <td class="right" style="color: #15803d;">${formatCurrency(b.paidAmount)}</td>
          <td class="right" style="font-weight: 700; color: #b91c1c;">${formatCurrency(b.balanceDue)}</td>
          <td class="center font-mono">${b.ageDays} days</td>
          <td class="center">
            <span class="badge ${b.status === "settled" ? "badge-paid" : b.status === "partial" ? "badge-partial" : "badge-unpaid"}">
              ${b.status}
            </span>
          </td>
        </tr>
      `).join("")}
      ${data.outstandingBills.length === 0 ? `
        <tr>
          <td colspan="8" class="center" style="padding: 15px; color: #64748b;">
            All inward catch bills are fully settled! Zero outstanding dues.
          </td>
        </tr>
      ` : ""}
    </tbody>
  </table>

  <!-- Chronological Running Ledger -->
  <div class="section-header">
    <span>2. Detailed Transaction & Running Ledger</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Ref / Voucher</th>
        <th>Particulars / Description</th>
        <th>Payment Mode</th>
        <th class="right">Debit (Purchases ₹)</th>
        <th class="right">Credit (Disbursed ₹)</th>
        <th class="right">Closing Balance (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${data.ledgerEntries.map((e) => `
        <tr>
          <td>${e.date}</td>
          <td style="font-weight: 700;">#${e.referenceNo}</td>
          <td>${e.description}</td>
          <td>${e.paymentMethod ? e.paymentMethod.toUpperCase() : "—"} ${e.paymentRef ? `(${e.paymentRef})` : ""}</td>
          <td class="right" style="color: ${e.debit > 0 ? "#c2410c" : "#64748b"}; font-weight: ${e.debit > 0 ? "700" : "normal"}">
            ${e.debit > 0 ? formatCurrency(e.debit) : "—"}
          </td>
          <td class="right" style="color: ${e.credit > 0 ? "#15803d" : "#64748b"}; font-weight: ${e.credit > 0 ? "700" : "normal"}">
            ${e.credit > 0 ? formatCurrency(e.credit) : "—"}
          </td>
          <td class="right" style="font-weight: 700;">${formatCurrency(e.runningBalance)}</td>
        </tr>
      `).join("")}
      ${data.ledgerEntries.length === 0 ? `
        <tr>
          <td colspan="7" class="center" style="padding: 15px; color: #64748b;">
            No transactions found for this statement period.
          </td>
        </tr>
      ` : ""}
    </tbody>
  </table>

  <!-- Footer & Signatures -->
  <div class="footer">
    <div>
      <p>This is a computer-generated statement of account issued by ${data.storeName}.</p>
      <p>Please reconcile with your books and notify any discrepancies within 7 days.</p>
    </div>
    <div class="signatures">
      <div class="sign-box">Prepared By</div>
      <div class="sign-box">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>
  `;
}

export function printSupplierLedgerPdf(data: SupplierStatementData): void {
  const html = buildSupplierStatementHtml(data);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to download/print supplier ledger PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}
