import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Package,
  Truck,
  IndianRupee,
  MapPin,
  Wallet,
  RotateCcw,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  FileText,
  KeyRound,
  ShieldCheck,
  Home,
  Briefcase,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { inr, formatIST } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "My Account — Fish N Fresh" },
      {
        name: "description",
        content:
          "Your Fish N Fresh account: order history, live delivery status, payments, refunds, saved addresses and FreshCash wallet.",
      },
      { property: "og:title", content: "My Account — Fish N Fresh" },
      {
        property: "og:description",
        content: "Track your seafood orders, payments and rewards in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

type AccountOrder = {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string;
  payment_method: string;
  fulfillment_type: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  gst_amount: number;
  refund_amount: number | null;
  refunded_at: string | null;
  delivery_date: string | null;
  delivery_slot: string | null;
  delivered_at: string | null;
  created_at: string;
  delivery_pin?: string | null;
  items: { product_id?: string; name: string; price: number; qty: number; unit?: string; cutting_style?: string }[];
};

const STATUS_STEPS = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(s: string) {
  if (s === "delivered") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (s === "cancelled") return "bg-destructive/15 text-destructive";
  if (s === "out_for_delivery") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

function AccountPage() {
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [tab, setTab] = useState<"orders" | "payments" | "addresses" | "wallet">("orders");
  const [invoiceOrder, setInvoiceOrder] = useState<AccountOrder | null>(null);

  // 1. Strict Customer-Scoped Orders Query
  const ordersQ = useQuery({
    queryKey: ["account", "orders", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
    queryFn: async (): Promise<AccountOrder[]> => {
      if (!user?.id) return [];
      const storedPhone = typeof window !== "undefined" ? localStorage.getItem("fnf_phone") : null;
      const userPhone = (user.user_metadata as any)?.phone || storedPhone;

      let query = supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, payment_method, fulfillment_type, total, subtotal, delivery_fee, discount, gst_amount, refund_amount, refunded_at, delivery_date, delivery_slot, delivered_at, created_at, items",
        );

      const conditions = [`user_id.eq.${user.id}`, `created_by.eq.${user.id}`];
      if (user.email) {
        conditions.push(`customer_email.eq.${user.email}`);
      }
      if (userPhone && userPhone.length >= 10) {
        conditions.push(`customer_phone.eq.${userPhone.replace(/\D/g, "")}`);
      }

      query = query.or(conditions.join(","));
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as AccountOrder[];
    },
  });

  // 2. Strict Customer-Scoped Addresses Query
  const addressesQ = useQuery({
    queryKey: ["account", "addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id, label, address, is_default, lat, lng")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Strict Customer-Scoped Wallet Query
  const walletQ = useQuery({
    queryKey: ["account", "wallet", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return { wallet: null, txns: [] };
      const { data } = await (supabase as any)
        .from("customer_wallets")
        .select("balance, referral_code, total_earned, total_redeemed")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: txnRows } = await (supabase as any)
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .eq("wallet_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      return { wallet: data, txns: txnRows ?? [] };
    },
  });

  const orders = ordersQ.data ?? [];
  const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const paid = orders.filter((o) => o.payment_status === "paid");
  const spent = paid.reduce((s, o) => s + Number(o.total) - Number(o.refund_amount ?? 0), 0);
  const refunded = orders.reduce((s, o) => s + Number(o.refund_amount ?? 0), 0);

  return (
    <AppShell>
      <div className="pb-24">
        <header className="mt-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Customer Portal</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.email} — your personal orders, live deliveries and past payments only.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" /> Isolated Customer Session
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard icon={Package} label="My Orders" value={String(orders.length)} />
          <StatCard icon={Truck} label="In Progress" value={String(active.length)} />
          <StatCard icon={IndianRupee} label="Total Paid" value={inr(spent)} />
          <StatCard icon={RotateCcw} label="Refunded" value={inr(refunded)} />
        </section>

        <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-muted/60 p-1">
          {(
            [
              ["orders", "Orders & Delivery"],
              ["payments", "Past Payments"],
              ["addresses", "Saved Addresses"],
              ["wallet", "FreshCash Wallet"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                tab === key ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {ordersQ.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading your account…</p>
        ) : (
          <div className="mt-4">
            {tab === "orders" && (
              <OrdersTab orders={orders} onOpenInvoice={(o) => setInvoiceOrder(o)} />
            )}
            {tab === "payments" && (
              <PaymentsTab orders={orders} onOpenInvoice={(o) => setInvoiceOrder(o)} />
            )}
            {tab === "addresses" && (
              <AddressesTab
                addresses={(addressesQ.data ?? []) as any[]}
                userId={user?.id}
                onRefresh={() => addressesQ.refetch()}
              />
            )}
            {tab === "wallet" && (
              <WalletTab
                wallet={walletQ.data?.wallet as any}
                txns={(walletQ.data?.txns ?? []) as any[]}
              />
            )}
          </div>
        )}
      </div>

      {invoiceOrder && (
        <TaxInvoiceModal
          isOpen={Boolean(invoiceOrder)}
          onClose={() => setInvoiceOrder(null)}
          order={invoiceOrder}
          settings={settings}
        />
      )}
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-lg font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function OrdersTab({
  orders,
  onOpenInvoice,
}: {
  orders: AccountOrder[];
  onOpenInvoice: (o: AccountOrder) => void;
}) {
  const { add } = useCart();
  const navigate = useNavigate();

  function reorder(items: AccountOrder["items"]) {
    if (!Array.isArray(items) || !items.length) return;
    items.forEach((it) =>
      add(
        {
          id: it.product_id || "",
          name: it.name,
          price: Number(it.price),
          unit: it.unit || "kg",
          image_url: null,
        } as any,
        Number(it.qty) || 1,
      ),
    );
    toast.success("Items added to your cart");
    navigate({ to: "/cart" });
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-14 text-center">
        <p className="text-sm text-muted-foreground">You have not placed an order yet.</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/catalog">Browse today's catch</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const step = STATUS_STEPS.indexOf(o.status);
        return (
          <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">#{o.order_number ?? o.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">{formatIST(o.created_at)}</p>
              </div>
              <Badge className={`rounded-full border-0 ${statusTone(o.status)}`}>
                {statusLabel(o.status)}
              </Badge>
            </div>

            {o.status !== "cancelled" && (
              <div className="mt-3 flex gap-1">
                {STATUS_STEPS.map((s, i) => (
                  <span
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= step ? "bg-primary" : "bg-muted"
                    }`}
                    title={statusLabel(s)}
                  />
                ))}
              </div>
            )}

            <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
              {(o.items ?? []).map((i) => `${i.name} × ${i.qty}`).join(", ")}
            </p>

            {(o.delivery_date || o.delivery_slot) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Slot: {o.delivery_date ?? ""} {o.delivery_slot ?? ""}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
              <div>
                <p className="text-base font-bold">{inr(Number(o.total))}</p>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                  {o.payment_method === "card" ? "💳 Card / Stripe" : o.payment_method === "upi" ? "📱 UPI" : "💵 Cash / COD"} · {o.payment_status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8 text-xs font-semibold"
                  onClick={() => onOpenInvoice(o)}
                >
                  <FileText className="mr-1 size-3.5" /> Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-8 text-xs"
                  onClick={() => reorder(o.items)}
                >
                  <RotateCcw className="mr-1 size-3.5" /> Reorder
                </Button>
                <Button asChild size="sm" className="rounded-xl h-8 text-xs font-semibold">
                  <Link to="/track/$id" params={{ id: o.id }}>
                    Track <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PaymentsTab({
  orders,
  onOpenInvoice,
}: {
  orders: AccountOrder[];
  onOpenInvoice: (o: AccountOrder) => void;
}) {
  if (!orders.length) {
    return <p className="text-sm text-muted-foreground">No payments yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="p-3 font-semibold">Order</th>
            <th className="p-3 font-semibold">Date</th>
            <th className="p-3 font-semibold">Method</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 text-right font-semibold">Amount</th>
            <th className="p-3 text-right font-semibold">Refunded</th>
            <th className="p-3 text-center font-semibold">Invoice</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="p-3 font-medium">#{o.order_number ?? o.id.slice(0, 8)}</td>
              <td className="p-3 text-muted-foreground">{formatIST(o.created_at)}</td>
              <td className="p-3 uppercase">
                {o.payment_method === "card" ? "💳 Card / Stripe" : o.payment_method === "upi" ? "📱 UPI" : "💵 COD"}
              </td>
              <td className="p-3">
                <Badge
                  className={`rounded-full border-0 ${
                    o.payment_status === "paid"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : o.payment_status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {statusLabel(o.payment_status)}
                </Badge>
              </td>
              <td className="p-3 text-right font-semibold">{inr(Number(o.total))}</td>
              <td className="p-3 text-right text-muted-foreground">
                {Number(o.refund_amount ?? 0) > 0 ? inr(Number(o.refund_amount)) : "—"}
              </td>
              <td className="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => onOpenInvoice(o)}
                >
                  <FileText className="size-3.5 mr-1" /> View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddressesTab({
  addresses,
  userId,
  onRefresh,
}: {
  addresses: any[];
  userId?: string | undefined;
  onRefresh: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("Home");
  const [addressText, setAddressText] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Please sign in to save an address");
      return;
    }
    if (!addressText.trim()) {
      toast.error("Address is required");
      return;
    }

    try {
      setSaving(true);
      if (isDefault) {
        // Demote previous default
        await supabase
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("user_id", userId);
      }

      const { error } = await supabase.from("customer_addresses").insert({
        user_id: userId,
        label,
        address: addressText.trim(),
        is_default: isDefault,
      });

      if (error) throw error;
      toast.success("New address saved!");
      setModalOpen(false);
      setAddressText("");
      setIsDefault(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this address?")) return;
    try {
      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId!);
      if (error) throw error;
      toast.success("Address removed");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove address");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await supabase.from("customer_addresses").update({ is_default: false }).eq("user_id", userId!);
      await supabase.from("customer_addresses").update({ is_default: true }).eq("id", id).eq("user_id", userId!);
      toast.success("Default address updated");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Could not set default");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Delivery Addresses</h3>
          <p className="text-xs text-muted-foreground">Manage your home, office, and doorstep delivery locations.</p>
        </div>
        <Button size="sm" className="rounded-xl gap-1" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" /> Add Address
        </Button>
      </div>

      {!addresses.length ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-2">
          <MapPin className="size-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm font-semibold text-foreground">No saved addresses yet</p>
          <p className="text-xs text-muted-foreground">Add your home or office address for 1-tap checkout.</p>
          <Button size="sm" variant="outline" className="rounded-xl mt-2" onClick={() => setModalOpen(true)}>
            <Plus className="size-3.5 mr-1" /> Add Address Now
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {a.label === "Home" ? <Home className="size-3.5" /> : a.label === "Work" ? <Briefcase className="size-3.5" /> : <MapPin className="size-3.5" />}
                  </span>
                  <p className="text-sm font-bold text-foreground">{a.label}</p>
                  {a.is_default && (
                    <Badge className="rounded-full border-0 bg-primary/15 text-primary text-[10px]">Default</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground max-w-xl pl-8 leading-relaxed">{a.address}</p>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {!a.is_default && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => handleSetDefault(a.id)}>
                    Set Default
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add Address Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Delivery Address</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="addr-label">Address Tag</Label>
              <div className="flex gap-2 mt-1.5">
                {["Home", "Work", "Other"].map((lbl) => (
                  <Button
                    key={lbl}
                    type="button"
                    size="sm"
                    variant={label === lbl ? "default" : "outline"}
                    className="rounded-xl flex-1 text-xs"
                    onClick={() => setLabel(lbl)}
                  >
                    {lbl}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="addr-text">Complete Doorstep Address *</Label>
              <textarea
                id="addr-text"
                required
                rows={3}
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Door No, Building Name, Street, Landmark, Pincode (e.g. 14, Beach Road, Kasimedu, Chennai - 600013)"
                className="mt-1 flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="addr-default"
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-4 rounded accent-primary"
              />
              <Label htmlFor="addr-default" className="text-xs cursor-pointer">
                Set as my primary default delivery address
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-xl font-bold">
                {saving ? "Saving..." : "Save Address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WalletTab({ wallet, txns }: { wallet: any; txns: any[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="size-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">FreshCash balance</span>
        </div>
        <p className="mt-2 text-3xl font-bold">{inr(Number(wallet?.balance ?? 0))}</p>
        {wallet?.referral_code && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your referral code: <span className="font-mono font-bold">{wallet.referral_code}</span>
          </p>
        )}
      </div>

      {txns.length > 0 && (
        <ul className="space-y-2">
          {txns.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div>
                <p className="text-xs font-semibold">{t.description || t.type}</p>
                <p className="text-[11px] text-muted-foreground">{formatIST(t.created_at)}</p>
              </div>
              <p
                className={`text-sm font-bold ${
                  Number(t.amount) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                {Number(t.amount) >= 0 ? "+" : ""}
                {inr(Number(t.amount))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
