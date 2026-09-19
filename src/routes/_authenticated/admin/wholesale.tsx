import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listWholesaleAccounts,
  listWholesalePrices,
  saveWholesalePrice,
  updateWholesaleAccount,
  type WholesalePriceRow,
} from "@/lib/wholesale.functions";
import { parseTiers, type WholesaleTier } from "@/lib/wholesale";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/wholesale")({
  head: () => ({
    meta: [
      { title: "Wholesale Rates | Store Admin" },
      {
        name: "description",
        content: "Set bulk rates and quantity slabs for trade buyers, and approve shop accounts that order in bulk.",
      },
      { property: "og:title", content: "Wholesale Rates | Store Admin" },
      {
        property: "og:description",
        content: "Manage the bulk price list and trade buyer accounts for your store.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminWholesale,
});

function AdminWholesale() {
  return (
    <AdminShell title="Wholesale rates" allow={["admin", "manager"]}>
      <Tabs defaultValue="prices">
        <TabsList className="mb-4">
          <TabsTrigger value="prices">Bulk price list</TabsTrigger>
          <TabsTrigger value="accounts">Trade buyers</TabsTrigger>
        </TabsList>
        <TabsContent value="prices">
          <PriceList />
        </TabsContent>
        <TabsContent value="accounts">
          <Accounts />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function PriceList() {
  const fetchPrices = useServerFn(listWholesalePrices);
  const prices = useQuery({ queryKey: ["admin", "wholesale", "prices"], queryFn: () => fetchPrices() });
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = prices.data ?? [];
    return q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
  }, [prices.data, search]);

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items"
        className="max-w-sm"
      />
      {prices.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading items…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items found.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <PriceRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRow({ row }: { row: WholesalePriceRow }) {
  const qc = useQueryClient();
  const save = useServerFn(saveWholesalePrice);
  const [flat, setFlat] = useState(row.wholesale_price == null ? "" : String(row.wholesale_price));
  const [minQty, setMinQty] = useState(String(row.wholesale_min_qty ?? 0));
  const [tiers, setTiers] = useState<WholesaleTier[]>(parseTiers(row.wholesale_tiers));

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          productId: row.id,
          wholesale_price: flat.trim() === "" ? null : Number(flat),
          wholesale_min_qty: Number(minQty) || 0,
          tiers,
        },
      }),
    onSuccess: () => {
      toast.success(`${row.name} rates saved`);
      qc.invalidateQueries({ queryKey: ["admin", "wholesale", "prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setTier = (index: number, patch: Partial<WholesaleTier>) =>
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">
              Retail {formatINR(Number(row.price))} / {row.unit}
              {row.category ? ` · ${row.category}` : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Bulk rate (per {row.unit})</Label>
            <Input
              inputMode="decimal"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              placeholder="Leave blank for retail rate"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Minimum bulk quantity</Label>
            <Input inputMode="decimal" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Quantity slabs</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTiers((prev) => [...prev, { min_qty: 0, price: Number(row.price) }].slice(0, 6))}
            >
              <Plus className="mr-1 h-4 w-4" /> Add slab
            </Button>
          </div>
          {tiers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No slabs yet — bulk rate above applies.</p>
          ) : (
            tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={String(tier.min_qty)}
                  onChange={(e) => setTier(i, { min_qty: Number(e.target.value) || 0 })}
                  placeholder="From qty"
                  className="w-28"
                />
                <span className="text-xs text-muted-foreground">{row.unit} and above →</span>
                <Input
                  inputMode="decimal"
                  value={String(tier.price)}
                  onChange={(e) => setTier(i, { price: Number(e.target.value) || 0 })}
                  placeholder="Price"
                  className="w-28"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Accounts() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listWholesaleAccounts);
  const update = useServerFn(updateWholesaleAccount);
  const accounts = useQuery({ queryKey: ["admin", "wholesale", "accounts"], queryFn: () => fetchAccounts() });

  const mutation = useMutation({
    mutationFn: async (input: { id: string; status?: string; extra_discount_percent?: number }) =>
      update({ data: input }),
    onSuccess: () => {
      toast.success("Trade account updated");
      qc.invalidateQueries({ queryKey: ["admin", "wholesale", "accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (accounts.isLoading) return <p className="text-sm text-muted-foreground">Loading trade buyers…</p>;
  const list = accounts.data ?? [];
  if (list.length === 0)
    return <p className="text-sm text-muted-foreground">No shops have applied for bulk rates yet.</p>;

  return (
    <div className="grid gap-3">
      {list.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {a.business_name}
              <Badge variant={a.status === "approved" ? "default" : "secondary"}>{a.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {a.contact_name ? `${a.contact_name} · ` : ""}
              {a.phone}
              {a.gstin ? ` · GSTIN ${a.gstin}` : ""}
            </p>
            {a.address ? <p className="text-xs text-muted-foreground">{a.address}</p> : null}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Extra discount %</Label>
                <Input
                  className="w-28"
                  inputMode="decimal"
                  defaultValue={String(a.extra_discount_percent ?? 0)}
                  onBlur={(e) =>
                    mutation.mutate({ id: a.id, extra_discount_percent: Number(e.target.value) || 0 })
                  }
                />
              </div>
              {a.status !== "approved" ? (
                <Button size="sm" onClick={() => mutation.mutate({ id: a.id, status: "approved" })}>
                  Approve
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => mutation.mutate({ id: a.id, status: "suspended" })}
                >
                  Suspend
                </Button>
              )}
              {a.status !== "rejected" ? (
                <Button size="sm" variant="ghost" onClick={() => mutation.mutate({ id: a.id, status: "rejected" })}>
                  Reject
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
