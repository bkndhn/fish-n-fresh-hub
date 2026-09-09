import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, Edit, AlertTriangle, Zap, PackagePlus, CheckCircle2, X, CheckSquare, Square, Layers, ArrowUpCircle, Eye, EyeOff, Sparkles, Star, Flame } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { formatINR, formatStockDisplay, formatStockUnitLabel } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { ProductAiBenefitsCard } from "@/components/ProductAiBenefitsCard";
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

const getRefillPresets = (unit: string) => {
  const u = (unit || "").toLowerCase();
  if (u === "kg") return ["5", "10", "25", "50"];
  if (u === "g" || u === "gram" || u === "grams") return ["100", "250", "500", "1000"];
  if (u === "pc" || u === "piece" || u === "pcs" || u === "pieces") return ["10", "25", "50", "100"];
  return ["5", "10", "20", "50"];
};

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
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "featured" | "bestseller">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [aiProduct, setAiProduct] = useState<Product | null>(null);

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
    low_stock_threshold: "5",
    gst_percent: "0",
    gst_included: false,
    is_available: true,
    is_featured: false,
    is_bestseller: false,
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
      toast.success(`Refilled ${refillProduct?.name}! New stock: ${formatStockDisplay(newStock, refillProduct?.unit)}`);
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
        low_stock_threshold: Number(newProduct.low_stock_threshold) || 5,
        gst_percent: Number(newProduct.gst_percent) || 0,
        gst_included: newProduct.gst_included,
        is_available: newProduct.is_available,
        allow_custom_qty: newProduct.allow_custom_qty,
        image_url: newProduct.image_url || null,
        description: newProduct.description.trim() || null,
      } as any);
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
        low_stock_threshold: "5",
        gst_percent: "0",
        gst_included: false,
        is_available: true,
        allow_custom_qty: true,
        is_featured: false,
        is_bestseller: false,
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
        low_stock_threshold: Number(editingProduct.low_stock_threshold) || 5,
        gst_percent: Number(editingProduct.gst_percent) || 0,
        gst_included: editingProduct.gst_included ?? false,
        is_available: editingProduct.is_available ?? true,
        allow_custom_qty: editingProduct.allow_custom_qty ?? true,
        image_url: editingProduct.image_url || null,
        description: editingProduct.description?.trim() || null,
      } as any).eq("id", editingProduct.id);
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

  const getThreshold = (p: Product) => {
    if (typeof p.low_stock_threshold === "number" && !isNaN(p.low_stock_threshold)) {
      return p.low_stock_threshold;
    }
    const u = (p.unit || "").toLowerCase();
    if (u.endsWith("g") && u !== "g") return 10;
    return 5;
  };

  const lowStockProducts = allProducts.filter((p) => (p.stock ?? 0) <= getThreshold(p) || !p.is_available);
  const featuredProducts = allProducts.filter((p) => p.is_featured);
  const bestSellerProducts = allProducts.filter((p) => p.is_bestseller);

  const list = allProducts.filter((p) => {
    if (stockFilter === "low" && !((p.stock ?? 0) <= getThreshold(p) || !p.is_available)) return false;
    if (stockFilter === "featured" && !p.is_featured) return false;
    if (stockFilter === "bestseller" && !p.is_bestseller) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.name_tamil && p.name_tamil.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedProductIds.length === list.length && list.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(list.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkLive = async (is_available: boolean) => {
    if (selectedProductIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_available })
        .in("id", selectedProductIds);
      if (error) throw error;
      toast.success(`${selectedProductIds.length} products marked ${is_available ? "Live" : "Paused"}`);
      setSelectedProductIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkFeatured = async (is_featured: boolean) => {
    if (selectedProductIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_featured })
        .in("id", selectedProductIds);
      if (error) throw error;
      toast.success(`${selectedProductIds.length} products ${is_featured ? "marked as Featured" : "unmarked from Featured"}`);
      setSelectedProductIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkBestSeller = async (is_bestseller: boolean) => {
    if (selectedProductIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const { error } = await (supabase.from("products") as any)
        .update({ is_bestseller })
        .in("id", selectedProductIds);
      if (error) throw error;
      toast.success(`${selectedProductIds.length} products ${is_bestseller ? "marked as Best Sellers" : "unmarked from Best Sellers"}`);
      setSelectedProductIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkRefill = async (amount = 10) => {
    if (selectedProductIds.length === 0) return;
    setBulkProcessing(true);
    try {
      for (const id of selectedProductIds) {
        const prod = allProducts.find((p) => p.id === id);
        const curr = Number(prod?.stock || 0);
        await supabase.from("products").update({ stock: curr + amount, is_available: true }).eq("id", id);
      }
      toast.success(`Refilled +${amount} to ${selectedProductIds.length} products`);
      setSelectedProductIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", selectedProductIds);
      if (error) throw error;
      toast.success(`Deleted ${selectedProductIds.length} products`);
      setSelectedProductIds([]);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <AdminShell title="Products & Inventory" allow={["admin", "staff"]}>
      {/* Low Stock Warning Banner */}
      {lowStockProducts.length > 0 && (
        <div className="mb-4 rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-card to-card p-3.5 sm:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-600 dark:text-amber-400 shadow-2xs">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>Inventory Alert</span>
                  <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.2 text-[11px]">
                    {lowStockProducts.length} depleted
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  Items below 5 units or paused from sale
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={stockFilter === "low" ? "default" : "outline"}
              className="rounded-xl h-7.5 text-xs font-bold self-start sm:self-auto border-amber-500/40 text-amber-700 dark:text-amber-300"
              onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
            >
              {stockFilter === "low" ? "Show All Items" : "View Depleted Only"}
            </Button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/80 bg-background/90 p-2 text-xs shadow-2xs hover:border-amber-500/50"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="size-9 rounded-xl object-cover" />
                ) : (
                  <div className="size-9 rounded-xl bg-muted flex items-center justify-center text-xs">🐟</div>
                )}
                <div className="min-w-20 max-w-32">
                  <p className="font-bold truncate text-[11px] leading-tight">{p.name}</p>
                  <p className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                    {(p.stock ?? 0) <= 0 ? "0 left" : `${p.stock} ${p.unit} left`}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shrink-0 px-2.5 shadow-2xs"
                  onClick={() => {
                    setRefillProduct(p);
                    setRefillQty("10");
                  }}
                >
                  <Zap className="mr-1 size-3 fill-current" /> Refill
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter Pills, and Add Product */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 rounded-xl h-10 bg-card text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Button
              size="sm"
              variant={stockFilter === "all" ? "default" : "outline"}
              className="rounded-xl h-9 text-xs font-semibold shrink-0"
              onClick={() => setStockFilter("all")}
            >
              All ({allProducts.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === "featured" ? "default" : "outline"}
              className={`rounded-xl h-9 text-xs font-semibold shrink-0 ${
                stockFilter === "featured"
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              }`}
              onClick={() => setStockFilter("featured")}
            >
              ⭐ Featured ({featuredProducts.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === "bestseller" ? "default" : "outline"}
              className={`rounded-xl h-9 text-xs font-semibold shrink-0 ${
                stockFilter === "bestseller"
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
              }`}
              onClick={() => setStockFilter("bestseller")}
            >
              🔥 Best Sellers ({bestSellerProducts.length})
            </Button>
            <Button
              size="sm"
              variant={stockFilter === "low" ? "default" : "outline"}
              className={`rounded-xl h-9 text-xs font-semibold shrink-0 ${
                lowStockProducts.length > 0 && stockFilter !== "low"
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                  : ""
              }`}
              onClick={() => setStockFilter("low")}
            >
              ⚠️ Low Stock ({lowStockProducts.length})
            </Button>
          </div>

          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shrink-0 h-9 font-bold shadow-xs">
                <Plus className="mr-1.5 size-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
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

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                  <Label htmlFor="prod-stock">Stock ({formatStockUnitLabel(newProduct.unit === "custom" ? newProduct.customUnit || "units" : newProduct.unit)})</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    placeholder="25"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-threshold">Alert At Qty</Label>
                  <Input
                    id="prod-threshold"
                    type="number"
                    placeholder="5"
                    value={newProduct.low_stock_threshold}
                    onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-border/80 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.is_available}
                    onCheckedChange={(is_available) => setNewProduct({ ...newProduct, is_available })}
                  />
                  <span>Store Live</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-amber-700 dark:text-amber-300">
                  <Switch
                    checked={newProduct.is_featured}
                    onCheckedChange={(is_featured) => setNewProduct({ ...newProduct, is_featured })}
                  />
                  <span>⭐ Featured</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-rose-700 dark:text-rose-300">
                  <Switch
                    checked={newProduct.is_bestseller}
                    onCheckedChange={(is_bestseller) => setNewProduct({ ...newProduct, is_bestseller })}
                  />
                  <span>🔥 Best Seller</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.allow_custom_qty}
                    onCheckedChange={(allow_custom_qty) => setNewProduct({ ...newProduct, allow_custom_qty })}
                  />
                  <span>Custom Qty</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.gst_included}
                    onCheckedChange={(gst_included) => setNewProduct({ ...newProduct, gst_included })}
                  />
                  <span>GST Inc</span>
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
      </div>

      {/* Bulk Action Toolbar & Multi-Select Bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="h-8 rounded-xl text-xs font-bold gap-1.5 hover:bg-muted"
          >
            {selectedProductIds.length === list.length && list.length > 0 ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
            <span>
              {selectedProductIds.length > 0
                ? `${selectedProductIds.length} of ${list.length} selected`
                : "Select All"}
            </span>
          </Button>

          {selectedProductIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProductIds([])}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {selectedProductIds.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleBulkLive(true)}
            >
              <Eye className="size-3.5" /> Mark Live
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-muted-foreground hover:bg-muted"
              onClick={() => handleBulkLive(false)}
            >
              <EyeOff className="size-3.5" /> Pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => handleBulkRefill(10)}
            >
              <Zap className="size-3.5 fill-current" /> +10 Stock All
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => handleBulkFeatured(true)}
            >
              <Star className="size-3.5 fill-amber-500 text-amber-500" /> Feature All
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkProcessing}
              className="h-8 rounded-xl text-xs font-semibold gap-1 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              onClick={() => handleBulkBestSeller(true)}
            >
              <Flame className="size-3.5 fill-rose-500 text-rose-500" /> Best Seller All
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkProcessing}
                  className="h-8 rounded-xl text-xs font-semibold gap-1"
                >
                  <Trash2 className="size-3.5" /> Delete ({selectedProductIds.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedProductIds.length} Products?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedProductIds.length} selected items from your seafood catalog. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleBulkDelete}
                  >
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {list.map((p) => {
          const threshold = getThreshold(p);
          const isLow = (p.stock ?? 0) <= threshold;
          const isOut = (p.stock ?? 0) <= 0;
          const isSelected = selectedProductIds.includes(p.id);
          const discountPercent =
            p.old_price && Number(p.old_price) > Number(p.price)
              ? Math.round(((Number(p.old_price) - Number(p.price)) / Number(p.old_price)) * 100)
              : 0;

          return (
            <Card
              key={p.id}
              className={`overflow-hidden transition shadow-xs hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary/30 bg-primary/[0.02]"
                  : "border-border/80"
              }`}
            >
              <CardContent className="p-3.5 sm:p-5 flex flex-col gap-3.5">
                {/* Upper Tier: Select Checkbox + Product Thumbnail + Full Name + Badges */}
                <div className="flex items-start gap-2.5 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => toggleSelectOne(p.id)}
                    className="mt-1 p-1 text-muted-foreground hover:text-primary transition shrink-0"
                    title={isSelected ? "Deselect product" : "Select product for bulk action"}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-5 text-primary" />
                    ) : (
                      <Square className="size-5 text-muted-foreground/60" />
                    )}
                  </button>

                  <ImageUpload
                    currentImage={p.image_url}
                    compact={true}
                    onUpload={(url) => update.mutate({ id: p.id, patch: { image_url: url } })}
                  />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div className="min-w-0 pr-1">
                        <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                          {p.name}
                        </h4>
                        {p.name_tamil && (
                          <p className="text-xs text-muted-foreground font-medium">{p.name_tamil}</p>
                        )}
                      </div>

                      {/* Stock Status Badge with proper unit formatting */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border shrink-0 ${
                          isOut || !p.is_available
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : isLow
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isOut || !p.is_available
                              ? "bg-rose-500"
                              : isLow
                              ? "bg-amber-500 animate-pulse"
                              : "bg-emerald-500"
                          }`}
                        />
                        {isOut
                          ? "Out of Stock"
                          : !p.is_available
                          ? `Paused (${formatStockDisplay(p.stock, p.unit)})`
                          : isLow
                          ? `Low: ${formatStockDisplay(p.stock, p.unit)}`
                          : formatStockDisplay(p.stock, p.unit)}
                      </span>
                    </div>

                    {/* Category & Pricing & Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {p.category ?? "Seafood"}
                      </span>

                      <span className="font-extrabold text-foreground text-sm sm:text-base">
                        {formatINR(Number(p.price))} <span className="text-xs font-normal text-muted-foreground">/ {p.unit}</span>
                      </span>

                      {discountPercent > 0 && (
                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          MRP: <span className="line-through">{formatINR(Number(p.old_price))}</span> ({discountPercent}% OFF)
                        </span>
                      )}

                      {/* 1-Click Featured Toggle */}
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: p.id, patch: { is_featured: !p.is_featured } })}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition border cursor-pointer ${
                          p.is_featured
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-2xs hover:bg-amber-500/25"
                            : "bg-muted/60 text-muted-foreground border-border hover:border-amber-400/50 hover:text-amber-600 dark:hover:text-amber-400"
                        }`}
                        title={p.is_featured ? "Featured on Customer Home (Click to unfeature)" : "Click to feature on Customer Home"}
                      >
                        <Star className={`size-3 ${p.is_featured ? "fill-amber-500 text-amber-500" : ""}`} />
                        {p.is_featured ? "Featured" : "+ Feature"}
                      </button>

                      {/* 1-Click Best Seller Toggle */}
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: p.id, patch: { is_bestseller: !p.is_bestseller } })}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition border cursor-pointer ${
                          p.is_bestseller
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-2xs hover:bg-rose-500/25"
                            : "bg-muted/60 text-muted-foreground border-border hover:border-rose-400/50 hover:text-rose-600 dark:hover:text-rose-400"
                        }`}
                        title={p.is_bestseller ? "Marked as Best Seller (Click to remove)" : "Click to mark as Best Seller"}
                      >
                        <Flame className={`size-3 ${p.is_bestseller ? "fill-rose-500 text-rose-500" : ""}`} />
                        {p.is_bestseller ? "Best Seller" : "+ Best Seller"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Middle Tier: Thumb-friendly Quick Values & Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-2xl bg-muted/40 p-2.5 border border-border/60">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selling Price (₹)</Label>
                    <Input
                      type="number"
                      defaultValue={p.price}
                      className="h-8 rounded-xl text-xs font-bold bg-background"
                      onBlur={(e) => {
                        const price = Number(e.target.value);
                        if (price !== p.price) update.mutate({ id: p.id, patch: { price } });
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Stock ({formatStockUnitLabel(p.unit)})
                    </Label>
                    <Input
                      type="number"
                      defaultValue={p.stock}
                      className="h-8 rounded-xl text-xs font-bold bg-background"
                      onBlur={(e) => {
                        const stock = Number(e.target.value);
                        if (stock !== p.stock) update.mutate({ id: p.id, patch: { stock } });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between px-2 sm:justify-center sm:gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Store Live</p>
                      <p className="text-[10px] text-muted-foreground">{p.is_available ? "Active" : "Hidden"}</p>
                    </div>
                    <Switch
                      checked={p.is_available}
                      onCheckedChange={(is_available) => update.mutate({ id: p.id, patch: { is_available } })}
                    />
                  </div>

                  <div className="flex items-center justify-between px-2 sm:justify-center sm:gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custom Qty</p>
                      <p className="text-[10px] text-muted-foreground">{p.allow_custom_qty ?? true ? "Allowed" : "Fixed"}</p>
                    </div>
                    <Switch
                      checked={p.allow_custom_qty ?? true}
                      onCheckedChange={(allow_custom_qty) => update.mutate({ id: p.id, patch: { allow_custom_qty } })}
                    />
                  </div>
                </div>

                {/* Bottom Tier: Native Action Bar */}
                <div className="flex items-center gap-2 pt-0.5">
                  {/* Quick Refill Button */}
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                    onClick={() => {
                      setRefillProduct(p);
                      setRefillQty("10");
                    }}
                  >
                    <Zap className="mr-1.5 size-3.5 fill-current" /> Quick Refill
                  </Button>

                  {/* Edit Details */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs font-semibold"
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
                    <Edit className="mr-1.5 size-3.5" /> Edit
                  </Button>

                  {/* AI Marine Health & Culinary Intelligence */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-2.5 text-primary border-primary/30 hover:bg-primary/10"
                    title="View / Pre-cache Multi-Language AI Profile"
                    onClick={() => setAiProduct(p)}
                  >
                    <Sparkles className="size-3.5" />
                  </Button>

                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently remove this product from the catalogue. This cannot be undone.
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
          );
        })}
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

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                  <Label htmlFor="edit-stock">Stock ({formatStockUnitLabel(editingProduct.unit === "custom" ? editingProduct.customUnit || "units" : editingProduct.unit)})</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-threshold">Alert At Qty</Label>
                  <Input
                    id="edit-threshold"
                    type="number"
                    value={editingProduct.low_stock_threshold ?? 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, low_stock_threshold: Number(e.target.value) })}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-border/80 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.is_available}
                    onCheckedChange={(is_available) => setEditingProduct({ ...editingProduct, is_available })}
                  />
                  <span>Store Live</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-amber-700 dark:text-amber-300">
                  <Switch
                    checked={editingProduct.is_featured ?? false}
                    onCheckedChange={(is_featured) => setEditingProduct({ ...editingProduct, is_featured })}
                  />
                  <span>⭐ Featured</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-rose-700 dark:text-rose-300">
                  <Switch
                    checked={editingProduct.is_bestseller ?? false}
                    onCheckedChange={(is_bestseller) => setEditingProduct({ ...editingProduct, is_bestseller })}
                  />
                  <span>🔥 Best Seller</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.allow_custom_qty ?? true}
                    onCheckedChange={(allow_custom_qty) => setEditingProduct({ ...editingProduct, allow_custom_qty })}
                  />
                  <span>Custom Qty</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.gst_included ?? false}
                    onCheckedChange={(gst_included) => setEditingProduct({ ...editingProduct, gst_included })}
                  />
                  <span>GST Inc</span>
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
                        {formatStockDisplay(refillProduct.stock, refillProduct.unit)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    Select Refill Preset (+{formatStockUnitLabel(refillProduct.unit)})
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {getRefillPresets(refillProduct.unit).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant={refillQty === preset ? "default" : "outline"}
                        className="h-9 rounded-xl text-xs font-semibold"
                        onClick={() => setRefillQty(preset)}
                      >
                        +{preset} {formatStockUnitLabel(refillProduct.unit)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-refill-qty" className="text-xs">
                    Or Enter Custom Quantity (+{formatStockUnitLabel(refillProduct.unit)})
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
                    {formatStockDisplay(refillProduct.stock, refillProduct.unit)} + {refillQty || 0} ={" "}
                    {formatStockDisplay(
                      Number(refillProduct.stock || 0) + (Number(refillQty) || 0),
                      refillProduct.unit
                    )}
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
                    {quickRefill.isPending
                      ? "Refilling..."
                      : `Confirm Refill (+${refillQty} ${formatStockUnitLabel(refillProduct.unit)})`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Profile Inspector Dialog */}
      <Dialog open={Boolean(aiProduct)} onOpenChange={(open) => !open && setAiProduct(null)}>
        <DialogContent className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Marine Nutrition & Culinary Intelligence: {aiProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {aiProduct && (
            <div className="mt-2">
              <ProductAiBenefitsCard product={aiProduct} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

