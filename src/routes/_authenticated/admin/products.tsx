import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, Edit, AlertTriangle, Zap, PackagePlus, CheckCircle2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery } from "@/lib/queries";
import type { Product } from "@/lib/types";
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

const UNIT_OPTIONS = ["kg", "g", "500g", "250g", "100g", "pc", "pack", "dozen", "tray", "custom"];

function ProductsAdmin() {
  const qc = useQueryClient();
  const products = useQuery(adminProductsQuery);
  const { data: categories } = useQuery(categoriesQuery);

  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [refillProduct, setRefillProduct] = useState<Product | null>(null);
  const [refillQty, setRefillQty] = useState<string>("10");
  const [makeLiveOnRefill, setMakeLiveOnRefill] = useState<boolean>(true);
  const [stockFilter, setStockFilter] = useState<"all" | "low">("all");

  const [newProduct, setNewProduct] = useState({
    name: "",
    name_tamil: "",
    category: "",
    customCategory: "",
    price: "",
    old_price: "",
    unit: "kg",
    customUnit: "",
    stock: "25",
    gst_percent: "0",
    gst_included: false,
    is_available: true,
    allow_custom_qty: true,
    image_url: "",
    description: "",
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
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

  const quickRefill = useMutation({
    mutationFn: async () => {
      if (!refillProduct) return;
      const addQty = Number(refillQty);
      if (isNaN(addQty) || addQty <= 0) throw new Error("Please enter a valid refill quantity");
      const newStock = Number(refillProduct.stock || 0) + addQty;
      const patch: any = { stock: newStock };
      if (makeLiveOnRefill) {
        patch.is_available = true;
      }
      const { error } = await supabase.from("products").update(patch).eq("id", refillProduct.id);
      if (error) throw error;
      return newStock;
    },
    onSuccess: (newStock) => {
      toast.success(`Refilled ${refillProduct?.name}! New stock: ${newStock} ${refillProduct?.unit}`);
      setRefillProduct(null);
      setRefillQty("10");
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

      const resolvedCat = newProduct.category === "__custom__" 
        ? newProduct.customCategory.trim() 
        : (newProduct.category || categories?.[0]?.name || "Sea Fish");

      const resolvedUnit = newProduct.unit === "custom" 
        ? newProduct.customUnit.trim() || "kg" 
        : newProduct.unit;

      const { error } = await supabase.from("products").insert({
        name: newProduct.name.trim(),
        name_tamil: newProduct.name_tamil.trim() || null,
        category: resolvedCat,
        price: priceNum,
        old_price: newProduct.old_price ? Number(newProduct.old_price) : null,
        unit: resolvedUnit,
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
        customCategory: "",
        price: "",
        old_price: "",
        unit: "kg",
        customUnit: "",
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

  const saveEditedProduct = useMutation({
    mutationFn: async () => {
      if (!editingProduct) return;
      if (!editingProduct.name.trim()) throw new Error("Product name is required");
      const priceNum = Number(editingProduct.price);
      if (isNaN(priceNum) || priceNum <= 0) throw new Error("Valid price is required");

      const resolvedCat = editingProduct.category === "__custom__" 
        ? (editingProduct.customCategory?.trim() || "Sea Fish") 
        : (editingProduct.category || "Sea Fish");

      const resolvedUnit = editingProduct.unit === "custom" 
        ? (editingProduct.customUnit?.trim() || "kg") 
        : editingProduct.unit;

      const { error } = await supabase.from("products").update({
        name: editingProduct.name.trim(),
        name_tamil: editingProduct.name_tamil?.trim() || null,
        category: resolvedCat,
        price: priceNum,
        old_price: editingProduct.old_price ? Number(editingProduct.old_price) : null,
        unit: resolvedUnit,
        stock: Number(editingProduct.stock) || 0,
        gst_percent: Number(editingProduct.gst_percent) || 0,
        gst_included: editingProduct.gst_included ?? false,
        is_available: editingProduct.is_available ?? true,
        allow_custom_qty: editingProduct.allow_custom_qty ?? true,
        image_url: editingProduct.image_url || null,
        description: editingProduct.description?.trim() || null,
      }).eq("id", editingProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated successfully!");
      setEditingProduct(null);
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

  const allProducts = products.data ?? [];
  const lowStockProducts = allProducts.filter((p) => (p.stock ?? 0) <= 5 || !p.is_available);

  const list = allProducts.filter((p) => {
    if (stockFilter === "low" && !((p.stock ?? 0) <= 5 || !p.is_available)) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.name_tamil && p.name_tamil.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  return (
    <AdminShell title="Products & Inventory" allow={["admin", "staff"]}>
      {/* Low Stock Warning Banner */}
      {lowStockProducts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Inventory Alert: {lowStockProducts.length} items low or out of stock
                </h3>
                <p className="text-xs text-muted-foreground">
                  Replenish these items to prevent checkout cart errors and maintain customer fulfillment
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={stockFilter === "low" ? "default" : "outline"}
              className="rounded-xl h-8 text-xs font-semibold border-amber-500/30 text-amber-700 dark:text-amber-300"
              onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
            >
              {stockFilter === "low" ? "Show All Products" : "Filter Depleted Items"}
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 pt-1">
            {lowStockProducts.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card p-2 text-xs shadow-2xs hover:border-amber-500/40"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="size-8 rounded-lg object-cover" />
                ) : (
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-[10px]">🐟</div>
                )}
                <div className="min-w-24 max-w-36">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {(p.stock ?? 0) <= 0 ? "Out of Stock" : `${p.stock} ${p.unit} left`}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 rounded-lg text-xs bg-amber-600 hover:bg-amber-500 text-white shrink-0 px-2.5"
                  onClick={() => {
                    setRefillProduct(p);
                    setRefillQty("10");
                  }}
                >
                  <Zap className="mr-1 size-3" /> Refill
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter Pills, and Add Product */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-9"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={stockFilter === "all" ? "default" : "outline"}
              className="rounded-xl h-9 text-xs"
              onClick={() => setStockFilter("all")}
            >
              All ({allProducts.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === "low" ? "default" : "outline"}
              className={`rounded-xl h-9 text-xs ${
                lowStockProducts.length > 0 && stockFilter !== "low"
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : ""
              }`}
              onClick={() => setStockFilter("low")}
            >
              Low Stock ({lowStockProducts.length})
            </Button>
          </div>
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shrink-0 h-9">
              <Plus className="mr-2 size-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Seafood Product</DialogTitle>
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
                    <option value="__custom__">+ Custom Category...</option>
                  </select>
                  {newProduct.category === "__custom__" && (
                    <Input
                      placeholder="Type custom category name..."
                      value={newProduct.customCategory}
                      onChange={(e) => setNewProduct({ ...newProduct, customCategory: e.target.value })}
                      className="mt-1"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prod-unit">Price / Stock Unit</Label>
                  <select
                    id="prod-unit"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u === "custom" ? "Custom Unit..." : u}
                      </option>
                    ))}
                  </select>
                  {newProduct.unit === "custom" && (
                    <Input
                      placeholder="e.g. 250g, bunch, tray..."
                      value={newProduct.customUnit}
                      onChange={(e) => setNewProduct({ ...newProduct, customUnit: e.target.value })}
                      className="mt-1"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-price">Selling Price (₹) *</Label>
                  <Input
                    id="prod-price"
                    type="number"
                    placeholder="450"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-old-price">MRP (₹)</Label>
                  <Input
                    id="prod-old-price"
                    type="number"
                    placeholder="500"
                    value={newProduct.old_price}
                    onChange={(e) => setNewProduct({ ...newProduct, old_price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-stock">Stock ({newProduct.unit === "custom" ? newProduct.customUnit || "units" : newProduct.unit})</Label>
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

              {Number(newProduct.old_price) > Number(newProduct.price) && Number(newProduct.price) > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>
                    Discount: <strong>{Math.round(((Number(newProduct.old_price) - Number(newProduct.price)) / Number(newProduct.old_price)) * 100)}% OFF</strong>
                  </span>
                  <span>
                    Customer saves <strong>{formatINR(Number(newProduct.old_price) - Number(newProduct.price))}</strong>
                  </span>
                </div>
              )}

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
                  Live
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
                  GST Inc
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
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                    <span>{p.category ?? "Uncategorised"}</span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">{formatINR(Number(p.price))} / {p.unit}</span>
                    {p.old_price && Number(p.old_price) > Number(p.price) && (
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                        MRP: <span className="line-through">{formatINR(Number(p.old_price))}</span> ({Math.round(((Number(p.old_price) - Number(p.price)) / Number(p.old_price)) * 100)}% off)
                      </span>
                    )}
                    <span>·</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        (p.stock ?? 0) <= 0 || !p.is_available
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : (p.stock ?? 0) <= 5
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          (p.stock ?? 0) <= 0 || !p.is_available
                            ? "bg-rose-500"
                            : (p.stock ?? 0) <= 5
                            ? "bg-amber-500 animate-pulse"
                            : "bg-emerald-500"
                        }`}
                      />
                      {(p.stock ?? 0) <= 0
                        ? "Out of Stock"
                        : !p.is_available
                        ? `Paused (${p.stock} ${p.unit})`
                        : (p.stock ?? 0) <= 5
                        ? `Low Stock: ${p.stock} ${p.unit}`
                        : `Stock: ${p.stock} ${p.unit}`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Price (₹)</Label>
                  <Input
                    type="number"
                    defaultValue={p.price}
                    onBlur={(e) => {
                      const price = Number(e.target.value);
                      if (price !== p.price) update.mutate({ id: p.id, patch: { price } });
                    }}
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[10px] text-muted-foreground">Stock ({p.unit})</Label>
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

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-amber-500/30"
                    title="Quick Refill Stock"
                    onClick={() => {
                      setRefillProduct(p);
                      setRefillQty("10");
                    }}
                  >
                    <Zap className="size-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-lg text-primary hover:bg-primary/10"
                    title="Edit full product details"
                    onClick={() => {
                      const isStandardUnit = UNIT_OPTIONS.includes(p.unit);
                      setEditingProduct({
                        ...p,
                        unit: isStandardUnit ? p.unit : "custom",
                        customUnit: isStandardUnit ? "" : p.unit,
                        customCategory: "",
                      });
                    }}
                  >
                    <Edit className="size-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive">
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

      {/* Full Edit Product Dialog */}
      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product: {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Name (English) *</Label>
                  <Input
                    id="edit-name"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tamil">Name (Tamil)</Label>
                  <Input
                    id="edit-tamil"
                    value={editingProduct.name_tamil ?? ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name_tamil: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  >
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
                    <option value="__custom__">+ Custom Category...</option>
                  </select>
                  {editingProduct.category === "__custom__" && (
                    <Input
                      placeholder="Type custom category name..."
                      value={editingProduct.customCategory ?? ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, customCategory: e.target.value })}
                      className="mt-1"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-unit">Price / Stock Unit</Label>
                  <select
                    id="edit-unit"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u === "custom" ? "Custom Unit..." : u}
                      </option>
                    ))}
                  </select>
                  {editingProduct.unit === "custom" && (
                    <Input
                      placeholder="e.g. 250g, bunch, tray..."
                      value={editingProduct.customUnit ?? ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, customUnit: e.target.value })}
                      className="mt-1"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price">Selling Price (₹) *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-old-price">MRP (₹)</Label>
                  <Input
                    id="edit-old-price"
                    type="number"
                    placeholder="Optional"
                    value={editingProduct.old_price ?? ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, old_price: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-gst">GST %</Label>
                  <Input
                    id="edit-gst"
                    type="number"
                    value={editingProduct.gst_percent ?? 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, gst_percent: Number(e.target.value) })}
                  />
                </div>
              </div>

              {Number(editingProduct.old_price) > Number(editingProduct.price) && Number(editingProduct.price) > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>
                    Discount: <strong>{Math.round(((Number(editingProduct.old_price) - Number(editingProduct.price)) / Number(editingProduct.old_price)) * 100)}% OFF</strong>
                  </span>
                  <span>
                    Customer saves <strong>{formatINR(Number(editingProduct.old_price) - Number(editingProduct.price))}</strong>
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Product Image</Label>
                <ImageUpload
                  currentImage={editingProduct.image_url}
                  onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={editingProduct.description ?? ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.is_available}
                    onCheckedChange={(is_available) => setEditingProduct({ ...editingProduct, is_available })}
                  />
                  Live
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.allow_custom_qty ?? true}
                    onCheckedChange={(allow_custom_qty) => setEditingProduct({ ...editingProduct, allow_custom_qty })}
                  />
                  Custom Qty
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.gst_included ?? false}
                    onCheckedChange={(gst_included) => setEditingProduct({ ...editingProduct, gst_included })}
                  />
                  GST Inc
                </label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  disabled={saveEditedProduct.isPending || !editingProduct.name}
                  onClick={() => saveEditedProduct.mutate()}
                >
                  {saveEditedProduct.isPending ? "Saving..." : "Update Product"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Refill Modal */}
      <Dialog open={Boolean(refillProduct)} onOpenChange={(open) => !open && setRefillProduct(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          {refillProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackagePlus className="size-5 text-amber-500" /> Quick Stock Refill
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  {refillProduct.image_url ? (
                    <img
                      src={refillProduct.image_url}
                      alt={refillProduct.name}
                      className="size-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-12 rounded-lg bg-muted flex items-center justify-center text-xl">🐟</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{refillProduct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Current Stock:{" "}
                      <span className="font-bold text-foreground">
                        {refillProduct.stock} {refillProduct.unit}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Select Refill Preset (+{refillProduct.unit})</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["5", "10", "25", "50"].map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={refillQty === preset ? "default" : "outline"}
                        className="h-9 rounded-xl text-xs font-semibold"
                        onClick={() => setRefillQty(preset)}
                      >
                        +{preset} {refillProduct.unit}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-refill-qty" className="text-xs">
                    Or Enter Custom Quantity (+{refillProduct.unit})
                  </Label>
                  <Input
                    id="custom-refill-qty"
                    type="number"
                    min="1"
                    placeholder="e.g. 15"
                    value={refillQty}
                    onChange={(e) => setRefillQty(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Calculation Preview */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Updated Stock Total:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {Number(refillProduct.stock || 0)} + {Number(refillQty) || 0} ={" "}
                    {Number(refillProduct.stock || 0) + (Number(refillQty) || 0)} {refillProduct.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">Mark product available (Live)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ensure customers can immediately purchase this item
                    </p>
                  </div>
                  <Switch
                    checked={makeLiveOnRefill}
                    onCheckedChange={setMakeLiveOnRefill}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-1/3 rounded-xl"
                    onClick={() => setRefillProduct(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white"
                    disabled={quickRefill.isPending || !refillQty || Number(refillQty) <= 0}
                    onClick={() => quickRefill.mutate()}
                  >
                    <Zap className="mr-1.5 size-4" />
                    {quickRefill.isPending ? "Refilling..." : `Confirm Refill (+${refillQty} ${refillProduct.unit})`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

