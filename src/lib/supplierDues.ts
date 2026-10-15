export type DueEntry = {
  supplier_name: string;
  supplier_phone: string | null;
  entry_type: string;
  amount: number;
  due_date: string | null;
  created_at: string;
};

export type SupplierBalance = {
  supplier: string;
  phone: string | null;
  billed: number;
  paid: number;
  balance: number;
  nextDue: string | null;
  status: "settled" | "overdue" | "due_soon" | "open";
};

/** Groups ledger rows per supplier. Balance = bills − payments. Overdue when a due date has passed with balance left; due soon within 3 days. */
export function supplierBalances(rows: DueEntry[], today = new Date().toISOString().slice(0, 10)): SupplierBalance[] {
  const map = new Map<string, SupplierBalance>();
  for (const r of rows) {
    const key = r.supplier_name.trim();
    const b = map.get(key) ?? { supplier: key, phone: null, billed: 0, paid: 0, balance: 0, nextDue: null, status: "open" as const };
    if (r.supplier_phone) b.phone = r.supplier_phone;
    if (r.entry_type === "bill") {
      b.billed += Number(r.amount);
      if (r.due_date && (!b.nextDue || r.due_date < b.nextDue)) b.nextDue = r.due_date;
    } else b.paid += Number(r.amount);
    map.set(key, b);
  }
  const soon = new Date(new Date(today).getTime() + 3 * 86400000).toISOString().slice(0, 10);
  return [...map.values()].map((b) => {
    const balance = Math.round((b.billed - b.paid) * 100) / 100;
    let status: SupplierBalance["status"] = "open";
    if (balance <= 0) status = "settled";
    else if (b.nextDue && b.nextDue < today) status = "overdue";
    else if (b.nextDue && b.nextDue <= soon) status = "due_soon";
    return { ...b, balance, status };
  }).sort((a, b) => b.balance - a.balance);
}

export function paymentReceiptText(p: { supplier: string; amount: number; method: string; balance: number; ref?: string; shop?: string }) {
  return `Payment receipt\nTo: ${p.supplier}\nPaid: ₹${p.amount.toLocaleString("en-IN")} via ${p.method.toUpperCase()}${p.ref ? ` (Ref ${p.ref})` : ""}\nBalance due: ₹${p.balance.toLocaleString("en-IN")}\nDate: ${new Date().toLocaleDateString("en-IN")}\n— ${p.shop ?? "Fish N Fresh"}`;
}
