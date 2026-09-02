import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

  const { data, isLoading } = useQuery({
    queryKey: ["order-payment", order],
    enabled: Boolean(order),
    refetchInterval: (q) =>
      (q.state.data as { payment_status?: string } | undefined)?.payment_status === "paid" ? false : 3000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_status, status")
        .eq("id", order!)
        .maybeSingle();
      return data;
    },
  });

  const paid = data?.payment_status === "paid";

  return (
    <AppShell>
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold">
          {isLoading ? "Checking payment…" : paid ? "Payment received" : "Confirming your payment"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {paid
            ? `Order ${data?.order_number ?? ""} is confirmed. We'll pack it fresh and deliver soon.`
            : "This can take a few seconds. This page updates automatically."}
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/orders">View my orders</Link>
        </Button>
      </div>
    </AppShell>
  );
}
