import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supplierBalances, paymentReceiptText } from "@/lib/supplierDues";
import { sendDueReceipt } from "@/lib/supplierDues.functions";

export const Route = createFileRoute("/_authenticated/admin/supplier-dues")({
  head: () => ({
    meta: [
      { title: "Supplier Dues Radar | Fish N Fresh Admin" },
      { name: "description", content: "Track what you owe each supplier, record cash/UPI/credit payments and send WhatsApp receipts." },
      { property: "og:title", content: "Supplier Dues Radar | Fish N Fresh Admin" },
      { property: "og:description", content: "Supplier balances, due dates and WhatsApp payment receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DuesPage,
});

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const STATUS: Record<string, { label: string; v: "default" | "destructive" | "secondary" | "outline" }> = {
  overdue: { label: "Overdue", v: "destructive" }, due_soon: { label: "Due soon", v: "default" },
  open: { label: "Open", v: "outline" }, settled: { label: "Settled", v: "secondary" },
};

function DuesPage() {
  const qc = useQueryClient();
  const send = useServerFn(sendDueReceipt);
  const [f, setF] = useState({ supplier: "", phone: "", type: "bill", amount: "", method: "cash", ref: "", due: "", notes: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const { data: rows = [] } = useQuery({
    queryKey: ["supplier-dues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplier_dues").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const balances = useMemo(() => supplierBalances(rows), [rows]);
  const totalDue = balances.reduce((s, b) => s + Math.max(0, b.balance), 0);
  const overdue = balances.filter((b) => b.status === "overdue").reduce((s, b) => s + b.balance, 0);

  const save = useMutation({
    mutationFn: async () => {
      const amount = +f.amount;
      if (!f.supplier.trim() || !(amount > 0)) throw new Error("Enter supplier and amount");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("supplier_dues").insert({
        supplier_name: f.supplier.trim(), supplier_phone: f.phone || null, entry_type: f.type, amount,
        method: f.type === "payment" ? f.method : "credit", reference: f.ref || null,
        due_date: f.type === "bill" && f.due ? f.due : null, notes: f.notes || null, created_by: u.user?.id ?? null,
      });
      if (error) throw error;
      if (f.type === "payment" && f.phone) {
        const prev = balances.find((b) => b.supplier === f.supplier.trim());
        const msg = paymentReceiptText({ supplier: f.supplier.trim(), amount, method: f.method, balance: Math.max(0, (prev?.balance ?? 0) - amount), ref: f.ref });
        const r = await send({ data: { phone: f.phone, message: msg } });
        if (r.sent) toast.success("Receipt sent on WhatsApp");
        else if (r.fallbackUrl) window.open(r.fallbackUrl, "_blank");
      }
    },
    onSuccess: () => { toast.success("Saved"); setF((s) => ({ ...s, amount: "", ref: "", notes: "", due: "" })); qc.invalidateQueries({ queryKey: ["supplier-dues"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Supplier Dues">
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Supplier Dues Radar</h1>
          <p className="text-sm text-muted-foreground">Record supplier bills and payments. Balances and due dates update instantly.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Total you owe</p><p className="text-2xl font-bold">{inr(totalDue)}</p></div>
          <div className="rounded-3xl border bg-card p-5 shadow-sm"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-destructive">{inr(overdue)}</p></div>
        </div>

        <div className="grid gap-3 rounded-3xl border bg-card p-5 shadow-sm md:grid-cols-2">
          <div className="flex gap-2 md:col-span-2">
            {(["bill", "payment"] as const).map((t) => (
              <Button key={t} type="button" variant={f.type === t ? "default" : "outline"} onClick={() => setF((s) => ({ ...s, type: t }))}>
                {t === "bill" ? "New bill (I owe)" : "Record payment"}
              </Button>
            ))}
          </div>
          <label className="space-y-1 text-sm">Supplier
            <Input list="dues-suppliers" value={f.supplier} onChange={(e) => {
              const b = balances.find((x) => x.supplier === e.target.value);
              setF((s) => ({ ...s, supplier: e.target.value, phone: b?.phone ?? s.phone }));
            }} />
            <datalist id="dues-suppliers">{balances.map((b) => <option key={b.supplier} value={b.supplier} />)}</datalist>
          </label>
          <label className="space-y-1 text-sm">WhatsApp number<Input inputMode="tel" value={f.phone} onChange={set("phone")} /></label>
          <label className="space-y-1 text-sm">Amount (₹)<Input type="number" inputMode="decimal" value={f.amount} onChange={set("amount")} /></label>
          {f.type === "payment" ? (
            <label className="space-y-1 text-sm">Paid by
              <select className="h-10 w-full rounded-md border bg-background px-2" value={f.method} onChange={set("method")}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="credit">Credit adjustment</option>
              </select>
            </label>
          ) : (
            <label className="space-y-1 text-sm">Due date<Input type="date" value={f.due} onChange={set("due")} /></label>
          )}
          <label className="space-y-1 text-sm">Reference / bill no.<Input value={f.ref} onChange={set("ref")} /></label>
          <label className="space-y-1 text-sm">Notes<Input value={f.notes} onChange={set("notes")} /></label>
          <Button className="md:col-span-2" disabled={save.isPending} onClick={() => save.mutate()}>
            {f.type === "payment" ? "Save payment & send WhatsApp receipt" : "Save bill"}
          </Button>
        </div>

        <div className="space-y-2">
          {balances.length === 0 && <p className="text-sm text-muted-foreground">No supplier entries yet.</p>}
          {balances.map((b) => (
            <div key={b.supplier} className="flex items-center justify-between rounded-xl border bg-card p-3">
              <div>
                <p className="font-semibold">{b.supplier}</p>
                <p className="text-xs text-muted-foreground">Billed {inr(b.billed)} · Paid {inr(b.paid)}{b.nextDue ? ` · Due ${b.nextDue}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{inr(Math.max(0, b.balance))}</p>
                <Badge variant={STATUS[b.status]?.v ?? "outline"}>{STATUS[b.status]?.label ?? "Open"}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
