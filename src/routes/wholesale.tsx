import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { applyForWholesale, getMyWholesaleAccount } from "@/lib/wholesale.functions";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/wholesale")({
  head: () => ({
    meta: [
      { title: "Bulk & Trade Orders | Fish N Fresh" },
      {
        name: "description",
        content:
          "Shops, hotels and caterers can order in bulk at trade rates with quantity slabs, pickup or delivery, and live order tracking.",
      },
      { property: "og:title", content: "Bulk & Trade Orders | Fish N Fresh" },
      {
        property: "og:description",
        content: "Apply for a trade account and buy in bulk at wholesale rates with quantity slabs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WholesalePage,
});

function WholesalePage() {
  const qc = useQueryClient();
  const { salesMode } = useCart();

  const fetchStatus = useServerFn(getMyWholesaleAccount);
  const apply = useServerFn(applyForWholesale);
  const status = useQuery({ queryKey: ["wholesale", "me"], queryFn: () => fetchStatus() });

  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
  });

  const submit = useMutation({
    mutationFn: async () => apply({ data: form }),
    onSuccess: () => {
      toast.success("Application sent — we'll confirm your trade rates shortly");
      qc.invalidateQueries({ queryKey: ["wholesale", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const account = status.data?.account ?? null;

  if (salesMode === "retail") {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10 text-center">
          <h1 className="text-2xl font-semibold">Bulk orders are not open right now</h1>
          <p className="text-sm text-muted-foreground">
            This shop is currently selling to customers only. Browse the catalogue to place a regular order.
          </p>
          <Button asChild className="rounded-xl">
            <Link to="/catalog">Browse catalogue</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Buying in bulk?</h1>
          <p className="text-sm text-muted-foreground">
            Shops, hotels and caterers get trade rates that drop further as the quantity goes up. Apply once — once
            approved, the bulk rate shows automatically while you shop.
          </p>
        </div>

        {/* Live Bulk Savings Preview */}
        {!account && (
          <WholesalePreview />
        )}

        {status.isLoading ? (

          <p className="text-sm text-muted-foreground">Checking your account…</p>
        ) : account ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {account.business_name}
                <Badge variant={account.status === "approved" ? "default" : "secondary"}>{account.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {account.status === "approved" ? (
                <p>
                  Your trade rates are active
                  {account.extra_discount_percent > 0
                    ? `, with an extra ${account.extra_discount_percent}% off on top of the bulk slabs`
                    : ""}
                  . Bulk prices appear in your cart automatically.
                </p>
              ) : account.status === "pending" ? (
                <p>Your application is under review. We'll switch on your bulk rates once it's approved.</p>
              ) : (
                <p>This account isn't active for trade rates right now. Contact the store for help.</p>
              )}
              <Button asChild size="sm">
                <Link to="/catalog">Start your bulk order</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Apply for trade rates</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shop / business name</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Contact person</Label>
                  <Input
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Email (optional)</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GSTIN (optional)</Label>
                  <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shop address</Label>
                <Textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? "Sending…" : "Apply for trade rates"}
              </Button>
              <p className="text-xs text-muted-foreground">
                You need to be signed in to apply. <Link to="/auth" className="underline">Sign in</Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function WholesalePreview() {
  const { data: previewItems } = useQuery({
    queryKey: ["wholesale-preview"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("products")
        .select("name, price, wholesale_price, wholesale_min_qty, unit")
        .eq("is_available", true)
        .not("wholesale_price", "is", null)
        .limit(3);
      return data || [];
    }
  });

  if (!previewItems || previewItems.length === 0) return null;

  return (
    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
      <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">Live Trade Savings Preview</h3>
      <div className="space-y-2">
        {previewItems.map((item, idx) => {
          const retailPrice = Number(item.price);
          const wholesalePrice = Number(item.wholesale_price);
          const savings = Math.round(((retailPrice - wholesalePrice) / retailPrice) * 100);
          
          return (
            <div key={idx} className="flex items-center justify-between bg-card p-2 rounded-xl border shadow-xs text-xs">
              <div className="font-semibold">{item.name}</div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground line-through text-[10px]">₹{retailPrice}/{item.unit}</span>
                  <span className="font-bold text-emerald-600">₹{wholesalePrice}/{item.unit}</span>
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 shrink-0">
                  Save {savings}%
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        * Example rates shown. Actual discounts vary by volume slab and business profile.
      </p>
    </div>
  );
}
