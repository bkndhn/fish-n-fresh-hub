import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { verifyOrderPaymentSession } from "@/lib/payments.functions";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/payment-status")({
  head: () => ({
    meta: [
      { title: "Payment Status — Fish N Fresh" },
      { name: "description", content: "Check the payment status of your Fish N Fresh seafood order." },
      { property: "og:title", content: "Payment Status — Fish N Fresh" },
      { property: "og:description", content: "Confirmation for your Fish N Fresh order payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { order?: string } =>
    typeof search["order"] === "string" ? { order: search["order"] as string } : {},
  component: PaymentStatus,
});

function PaymentStatus() {
  const { order } = Route.useSearch();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order-payment", order],
    enabled: Boolean(order),
    refetchInterval: (q) =>
      (q.state.data as { payment_status?: string } | undefined)?.payment_status === "paid" ? false : 2000,
    queryFn: async () => {
      if (!order) return null;

      // 1. Direct server-side Stripe verification
      try {
        const env = isPaymentsConfigured() ? getStripeEnvironment() : "sandbox";
        await verifyOrderPaymentSession({
          data: { orderId: order, environment: env },
        });
      } catch (err) {
        console.warn("Direct session verification note:", err);
      }

      // 2. Fetch updated order status
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_status, status, customer_name, customer_email")
        .eq("id", order)
        .maybeSingle();
      return data;
    },
  });

  const paid = data?.payment_status === "paid";


  return (
    <AppShell>
      <div className="mx-auto max-w-md py-12 text-center space-y-5">
        {paid ? (
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 animate-in zoom-in-75">
            <CheckCircle2 className="size-10" />
          </div>
        ) : (
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}

        <div>
          <h1 className="font-display text-2xl font-bold">
            {paid ? "Payment Received & Order Confirmed!" : isLoading ? "Verifying Payment with Stripe…" : "Confirming your payment"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {paid
              ? `Order #${data?.order_number ?? order?.slice(0, 8)} is confirmed. Your receipt has been generated with real store details.`
              : "This takes just a moment while Stripe authorizes your transaction."}
          </p>
        </div>

        {paid && data?.customer_email && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            📧 Confirmation & invoice receipt queued for <strong>{data.customer_email}</strong>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {order && (
            <Button asChild className="rounded-xl shadow-xs">
              <Link to="/track/$id" params={{ id: order }}>
                Track Live Delivery <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/account">My Account Portal</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
