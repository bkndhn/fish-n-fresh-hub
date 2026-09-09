import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Package,
  Truck,
  IndianRupee,
  MapPin,
  Wallet,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { inr, formatIST } from "@/lib/format";
import { useNavigate } from "@tanstack/react-router";

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
  items: { product_id?: string; name: string; price: number; qty: number; unit?: string }[];
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
  const [tab, setTab] = useState<"orders" | "payments" | "addresses" | "wallet">("orders");

  const ordersQ = useQuery({
    queryKey: ["account", "orders", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 30000,
    queryFn: async (): Promise<AccountOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, payment_method, fulfillment_type, total, subtotal, delivery_fee, discount, gst_amount, refund_amount, refunded_at, delivery_date, delivery_slot, delivered_at, created_at, items",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AccountOrder[];
    },
  });

  const addressesQ = useQuery({
    queryKey: ["account", "addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("id, label, address, is_default")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const walletQ = useQuery({
    queryKey: ["account", "wallet", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_wallets")
        .select("balance, referral_code, total_earned, total_redeemed")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return { wallet: data, txns: txns ?? [] };
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
          <h1 className="text-2xl font-bold">My account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.email} — your orders, deliveries and payments only.
          </p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard icon={Package} label="Orders" value={String(orders.length)} />
          <StatCard icon={Truck} label="In progress" value={String(active.length)} />
          <StatCard icon={IndianRupee} label="Total paid" value={inr(spent)} />
          <StatCard icon={RotateCcw} label="Refunded" value={inr(refunded)} />
        </section>

        <nav className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-muted/60 p-1">
          {(
            [
              ["orders", "Orders & delivery"],
              ["payments", "Payments"],
              ["addresses", "Addresses"],
              ["wallet", "Wallet"],
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
            {tab === "orders" && <OrdersTab orders={orders} />}
            {tab === "payments" && <PaymentsTab orders={orders} />}
            {tab === "addresses" && (
              <AddressesTab addresses={(addressesQ.data ?? []) as any[]} />
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

function OrdersTab({ orders }: { orders: AccountOrder[] }) {
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-bold">{inr(Number(o.total))}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => reorder(o.items)}
                >
                  <RotateCcw className="mr-1 size-3.5" /> Reorder
                </Button>
                <Button asChild size="sm" className="rounded-xl">
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

function PaymentsTab({ orders }: { orders: AccountOrder[] }) {
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
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="p-3 font-medium">#{o.order_number ?? o.id.slice(0, 8)}</td>
              <td className="p-3 text-muted-foreground">{formatIST(o.created_at)}</td>
              <td className="p-3 uppercase">{o.payment_method}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddressesTab({ addresses }: { addresses: any[] }) {
  if (!addresses.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No saved addresses yet — you can save one while placing your next order.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {addresses.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <p className="text-sm font-semibold">{a.label}</p>
            {a.is_default && (
              <Badge className="rounded-full border-0 bg-primary/15 text-primary">Default</Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{a.address}</p>
        </li>
      ))}
    </ul>
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
