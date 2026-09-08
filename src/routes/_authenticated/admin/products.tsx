import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Products | Fish N Fresh Admin" },
      { name: "description", content: "Manage seafood catalogue pricing, stock levels and availability." },
      { property: "og:title", content: "Products | Fish N Fresh Admin" },
      { property: "og:description", content: "Manage seafood catalogue pricing, stock and availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const qc = useQueryClient();
  const products = useQuery(adminProductsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    name_tamil: "",
    category: "",
    price: "",
    unit: "kg",
    stock: "25",
    gst_percent: "0",
    gst_included: false,
    is_available: true,
    allow_custom_qty: true,
    image_url: "",
    description: "",
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { price?: number; stock?: number; is_available?: boolean; gst_percent?: number; gst_included?: boolean; image_url?: string | null; allow_custom_qty?: boolean } }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      if (!newProduct.name.trim()) throw new Error("Product name is required");
      const priceNum = Number(newProduct.price);
      if (isNaN(priceNum) || priceNum <= 0) throw new Error("Valid price is required");

      const { error } = await supabase.from("products").insert({
        name: newProduct.name.trim(),
        name_tamil: newProduct.name_tamil.trim() || null,
        category: newProduct.category || (categories?.[0]?.name ?? "Sea Fish"),
        price: priceNum,
        unit: newProduct.unit || "kg",
        stock: Number(newProduct.stock) || 0,
        gst_percent: Number(newProduct.gst_percent) || 0,
        gst_included: newProduct.gst_included,
        is_available: newProduct.is_available,
        allow_custom_qty: newProduct.allow_custom_qty,
        image_url: newProduct.image_url || null,
        description: newProduct.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product created successfully!");
      setOpenAdd(false);
      setNewProduct({
        name: "",
        name_tamil: "",
        category: "",
        price: "",
        unit: "kg",
        stock: "25",
        gst_percent: "0",
        gst_included: false,
        is_available: true,
        allow_custom_qty: true,
        image_url: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (products.data ?? []).filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.name_tamil && p.name_tamil.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  return (
    <AdminShell title="Products" allow={["admin", "staff"]}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shrink-0">
              <Plus className="mr-2 size-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-name">Name (English) *</Label>
                  <Input
                    id="prod-name"
                    placeholder="e.g. Vanjaram / Seer Fish"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-tamil">Name (Tamil)</Label>
                  <Input
                    id="prod-tamil"
                    placeholder="e.g. வஞ்சிரம்"
                    value={newProduct.name_tamil}
                    onChange={(e) => setNewProduct({ ...newProduct, name_tamil: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="Sea Fish">Sea Fish</option>
                    <option value="Freshwater Fish">Freshwater Fish</option>
                    <option value="Prawns & Shrimp">Prawns & Shrimp</option>
                    <option value="Crabs">Crabs</option>
                    <option value="Squid & Octopus">Squid & Octopus</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-unit">Unit</Label>
                  <Input
                    id="prod-unit"
                    placeholder="kg, 500g, piece..."
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-price">Price (₹) *</Label>
                  <Input
                    id="prod-price"
                    type="number"
                    placeholder="450"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-stock">Stock</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    placeholder="25"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-gst">GST %</Label>
                  <Input
                    id="prod-gst"
                    type="number"
                    placeholder="0"
                    value={newProduct.gst_percent}
                    onChange={(e) => setNewProduct({ ...newProduct, gst_percent: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Product Image</Label>
                <ImageUpload
                  currentImage={newProduct.image_url}
                  onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-desc">Description</Label>
                <Textarea
                  id="prod-desc"
                  placeholder="Fresh daily catch, cleaned and cut to order..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.is_available}
                    onCheckedChange={(is_available) => setNewProduct({ ...newProduct, is_available })}
                  />
                  Live / Available
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.allow_custom_qty}
                    onCheckedChange={(allow_custom_qty) => setNewProduct({ ...newProduct, allow_custom_qty })}
                  />
                  Custom Qty
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.gst_included}
                    onCheckedChange={(gst_included) => setNewProduct({ ...newProduct, gst_included })}
                  />
                  GST Included
                </label>
              </div>

              <Button
                className="w-full rounded-xl"
                disabled={createProduct.isPending || !newProduct.name || !newProduct.price}
                onClick={() => createProduct.mutate()}
              >
                {createProduct.isPending ? "Creating..." : "Save Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {list.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ImageUpload 
                  currentImage={p.image_url} 
                  onUpload={(url) => update.mutate({ id: p.id, patch: { image_url: url } })} 
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  {p.name_tamil && <p className="text-xs text-muted-foreground">{p.name_tamil}</p>}
                  <p className="text-xs text-muted-foreground">
                    {p.category ?? "Uncategorised"} · {formatINR(Number(p.price))} / {p.unit}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                  <Input
                    type="number"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const price = Number(e.target.value);
                      if (price !== p.price) update.mutate({ id: p.id, patch: { price } });
                    }}
                  />
                </div>
                <div className="w-16">
                  <Label className="text-[10px] text-muted-foreground">GST %</Label>
                  <Input
                    type="number"
                    defaultValue={p.gst_percent ?? 0}
                    onBlur={(e) => {
                      const gst_percent = Number(e.target.value);
                      if (gst_percent !== p.gst_percent) update.mutate({ id: p.id, patch: { gst_percent } });
                    }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">GST Inc</Label>
                  <Switch
                    checked={p.gst_included ?? false}
                    onCheckedChange={(gst_included) => update.mutate({ id: p.id, patch: { gst_included } })}
                  />
                </div>
                <div className="w-16">
                  <Label className="text-[10px] text-muted-foreground">Stock</Label>
                  <Input
                    type="number"
                    defaultValue={p.stock}
                    onBlur={(e) => {
                      const stock = Number(e.target.value);
                      if (stock !== p.stock) update.mutate({ id: p.id, patch: { stock } });
                    }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">Live</Label>
                  <Switch
                    checked={p.is_available}
                    onCheckedChange={(is_available) => update.mutate({ id: p.id, patch: { is_available } })}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground text-center">Custom<br/>Qty</Label>
                  <Switch
                    checked={p.allow_custom_qty ?? true}
                    onCheckedChange={(allow_custom_qty) => update.mutate({ id: p.id, patch: { allow_custom_qty } })}
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this seafood item from your catalogue. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteProduct.mutate(p.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No products match your search." : "No products yet. Click 'Add Product' above to create one."}
          </p>
        )}
      </div>
    </AdminShell>
  );
}

