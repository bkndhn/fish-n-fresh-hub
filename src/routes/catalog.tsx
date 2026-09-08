import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { categoriesQuery, productsQuery } from "@/lib/queries";

type Search = { category?: string | undefined };

export const Route = createFileRoute("/catalog")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    category: typeof search['category'] === "string" ? (search['category'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Seafood Catalog — Fish N Fresh" },
      {
        name: "description",
        content: "Browse fresh fish, prawns, crab and squid by category. Search in English or Tamil.",
      },
      { property: "og:title", content: "Seafood Catalog — Fish N Fresh" },
      { property: "og:description", content: "Browse and order fresh seafood by category." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/catalog" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "price-asc" | "price-desc">("name");
  const { data: products } = useQuery(productsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const filtered = (products ?? [])
    .filter((p) => (category ? p.category === category : true))
    .filter((p) =>
      q
        ? `${p.name} ${p.name_tamil ?? ""}`.toLowerCase().includes(q.toLowerCase())
        : true,
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? Number(a.price) - Number(b.price)
        : sort === "price-desc"
          ? Number(b.price) - Number(a.price)
          : a.name.localeCompare(b.name),
    );

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Catalog</h1>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search seafood…"
        className="mt-3 rounded-xl"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={category ? "outline" : "default"}
          className="rounded-full"
          onClick={() => navigate({ search: {} })}
        >
          All
        </Button>
        {(categories ?? []).map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={category === c.name ? "default" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => navigate({ search: { category: c.name } })}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 text-xs">
        {(["name", "price-asc", "price-desc"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-full border px-3 py-1 ${sort === s ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {s === "name" ? "A–Z" : s === "price-asc" ? "Price ↑" : "Price ↓"}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold text-base">Can't find what you're looking for?</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Looking for a specific catch (e.g. Lobster, Tiger Prawns, Sea Bass)? Let us know and our harbour team will source it fresh for you!
          </p>
          <RequestFishDialog defaultQuery={q} />
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border p-4 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="font-semibold text-sm">Looking for a specific fish not listed?</p>
            <p className="text-xs text-muted-foreground">Request any seasonal or rare catch and we'll get it for you.</p>
          </div>
          <RequestFishDialog />
        </div>
      )}
    </AppShell>
  );
}

function RequestFishDialog({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState(defaultQuery);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || phone.length < 10) {
      toast.error("Please enter the fish name and your 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("product_requests").insert({
        product_name: productName.trim(),
        customer_name: name.trim() || null,
        customer_phone: phone.replace(/\D/g, ""),
        notes: notes.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Request received! We'll message you when this catch arrives.");
      setOpen(false);
      setProductName("");
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl shrink-0">
          Request Special Catch
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Fish Variety</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="req-prod">Fish / Seafood Name *</Label>
            <Input
              id="req-prod"
              required
              placeholder="e.g. Mud Crab, Lobster, White Pomfret..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="req-name">Your Name</Label>
              <Input
                id="req-name"
                placeholder="Ravi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="req-phone">Phone *</Label>
              <Input
                id="req-phone"
                required
                inputMode="numeric"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="req-notes">Quantity or Specific Cut Requirement</Label>
            <Input
              id="req-notes"
              placeholder="e.g. Need ~2kg for Sunday lunch, curry cut"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
