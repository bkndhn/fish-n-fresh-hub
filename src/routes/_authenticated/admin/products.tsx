import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, Edit, AlertTriangle, Zap, PackagePlus, CheckCircle2, X, CheckSquare, Square, Layers, ArrowUpCircle, Eye, EyeOff, Sparkles, Star, Flame, Camera, RefreshCw, Copy, Check, Printer, Hash, FileUp, FileDown, Download, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminBranch } from "@/lib/branchContext";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { formatINR, formatStockDisplay, formatStockUnitLabel } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { generateSampleCsv, parseProductsCsv, exportProductsToCsv } from "@/lib/retailCsv";
import { applyRealProductsCatalog } from "@/lib/products.functions";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { ProductAiBenefitsCard } from "@/components/ProductAiBenefitsCard";
import {
  matchSpeciesVisualProfile,
  buildSpeciesAiPrompt,
  type ProductVisualPerspective,
} from "@/lib/productImageGenerator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function parseSpecsText(text?: string): Record<string, string> | null {
  if (!text || !text.trim()) return null;
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx !== -1) {
      const k = line.substring(0, idx).trim();
      const v = line.substring(idx + 1).trim();
      if (k && v) result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const { selectedBranchId, selectedBranch, isConsolidated, branches } = useAdminBranch();
  const products = useQuery(adminProductsQuery(selectedBranchId));
  const { data: categories } = useQuery(categoriesQuery);
  const allProducts = products.data ?? [];

  const nextSuggestedPosCode = useMemo(() => {
    const codes = (allProducts || [])
      .map((p) => p.pos_code)
      .filter((c): c is number => typeof c === "number" && !isNaN(c));
    return codes.length > 0 ? Math.max(...codes) + 1 : 1;
  }, [allProducts]);

  const [adminTab, setAdminTab] = useState<"products" | "categories">("products");
  const [showAddRetailSpecs, setShowAddRetailSpecs] = useState(false);
  const [showEditRetailSpecs, setShowEditRetailSpecs] = useState(false);
  const [search, setSearch] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [refillProduct, setRefillProduct] = useState<Product | null>(null);
  const [refillQty, setRefillQty] = useState<string>("10");
  const [makeLiveOnRefill, setMakeLiveOnRefill] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<"all" | "active" | "inactive" | "featured" | "bestseller" | "low">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [aiProduct, setAiProduct] = useState<Product | null>(null);
  const [aiVisualProduct, setAiVisualProduct] = useState<Product | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // CSV Import / Export states
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvTemplateVertical, setCsvTemplateVertical] = useState<string>("electronics_appliances");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvParsedProducts, setCsvParsedProducts] = useState<Partial<Product>[] | null>(null);
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    name_tamil: "",
    pos_code: "",
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
    brand: "",
    model_number: "",
    warranty_period_months: "0",
    requires_serial: false,
    aisle_location: "",
    specifications_text: "",
    cost_price: "",
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) {
        if (error.message && error.message.toLowerCase().includes("column")) {
          console.warn("Schema mismatch note:", error.message);
          throw new Error(`Database note: Please run 'supabase/consolidated_master_patch.sql' in your Supabase SQL editor (${error.message})`);
        }
        throw error;
      }
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

      const parsedPosCode = newProduct.pos_code ? parseInt(newProduct.pos_code, 10) : nextSuggestedPosCode;
      if (!isNaN(parsedPosCode)) {
        const conflict = allProducts.find((p) => p.pos_code === parsedPosCode && p.is_available !== false);
        if (conflict) {
          throw new Error(`POS Quick Code #${parsedPosCode} is already assigned to "${conflict.name}". Please choose another code.`);
        }
      }

      const { error } = await supabase.from("products").insert({
        name: newProduct.name.trim(),
        name_tamil: newProduct.name_tamil.trim() || null,
        pos_code: isNaN(parsedPosCode) ? null : parsedPosCode,
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
        is_featured: newProduct.is_featured,
        is_bestseller: newProduct.is_bestseller,
        image_url: newProduct.image_url || null,
        description: newProduct.description.trim() || null,
        branch_id: selectedBranchId || null,
        brand: newProduct.brand?.trim() || null,
        model_number: newProduct.model_number?.trim() || null,
        warranty_period_months: Number(newProduct.warranty_period_months) || 0,
        requires_serial: !!newProduct.requires_serial,
        aisle_location: newProduct.aisle_location?.trim() || null,
        specifications: parseSpecsText(newProduct.specifications_text),
        cost_price: newProduct.cost_price ? Number(newProduct.cost_price) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product created successfully!");
      setOpenAdd(false);
      setNewProduct({
        name: "",
        name_tamil: "",
        pos_code: "",
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
        brand: "",
        model_number: "",
        warranty_period_months: "0",
        requires_serial: false,
        aisle_location: "",
        specifications_text: "",
        cost_price: "",
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

      const editPosCode = editingProduct.pos_code !== undefined && editingProduct.pos_code !== null && editingProduct.pos_code !== ""
        ? parseInt(String(editingProduct.pos_code), 10)
        : null;

      if (editPosCode !== null && !isNaN(editPosCode)) {
        const conflict = allProducts.find((p) => p.id !== editingProduct.id && p.pos_code === editPosCode && p.is_available !== false);
        if (conflict) {
          throw new Error(`POS Quick Code #${editPosCode} is already assigned to "${conflict.name}". Please choose another code.`);
        }
      }

      const { error } = await supabase.from("products").update({
        name: editingProduct.name.trim(),
        name_tamil: editingProduct.name_tamil?.trim() || null,
        pos_code: editPosCode,
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
        brand: editingProduct.brand?.trim() || null,
        model_number: editingProduct.model_number?.trim() || null,
        warranty_period_months: Number(editingProduct.warranty_period_months) || 0,
        requires_serial: !!editingProduct.requires_serial,
        aisle_location: editingProduct.aisle_location?.trim() || null,
        specifications: typeof editingProduct.specifications_text === "string"
          ? parseSpecsText(editingProduct.specifications_text)
          : (editingProduct.specifications ?? null),
        cost_price: editingProduct.cost_price !== undefined && editingProduct.cost_price !== "" && editingProduct.cost_price !== null
          ? Number(editingProduct.cost_price)
          : null,
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

  const getThreshold = (p: Product) => {
    if (typeof p.low_stock_threshold === "number" && !isNaN(p.low_stock_threshold)) {
      return p.low_stock_threshold;
    }
    const u = (p.unit || "").toLowerCase();
    if (u.endsWith("g") && u !== "g") return 10;
    return 5;
  };

  const activeProducts = allProducts.filter((p) => p.is_available !== false);
  const inactiveProducts = allProducts.filter((p) => p.is_available === false);
  const lowStockProducts = allProducts.filter((p) => (p.stock ?? 0) <= getThreshold(p));
  const featuredProducts = allProducts.filter((p) => p.is_featured);
  const bestSellerProducts = allProducts.filter((p) => p.is_bestseller);

  const list = allProducts.filter((p) => {
    if (filterType === "active" && p.is_available === false) return false;
    if (filterType === "inactive" && p.is_available !== false) return false;
    if (filterType === "low" && !((p.stock ?? 0) <= getThreshold(p))) return false;
    if (filterType === "featured" && !p.is_featured) return false;
    if (filterType === "bestseller" && !p.is_bestseller) return false;
    if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
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
      const { error } = await supabase.from("products")
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

  const handlePrintCheatSheet = () => {
    const activeItems = [...allProducts]
      .filter((p) => p.is_available !== false)
      .sort((a, b) => (a.pos_code || 9999) - (b.pos_code || 9999));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>POS Counter Quick PLU Reference Sheet - Fish N Fresh Hub</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 10mm; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 10px; color: #0f172a; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    th { background: #0f172a; color: #ffffff; padding: 6px 8px; font-size: 10px; text-transform: uppercase; text-align: left; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: middle; }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .code-badge { display: inline-block; font-family: monospace; font-size: 13px; font-weight: 900; background: #0284c7; color: #ffffff; padding: 2px 8px; border-radius: 4px; min-width: 32px; text-align: center; }
    .price { font-weight: 800; font-size: 12px; text-align: right; }
    .tamil { color: #64748b; font-size: 10px; margin-top: 1px; }
    .footer { margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">⚡ Fish N Fresh Hub — POS Counter Quick Code Sheet</div>
    <div class="subtitle">Quick Numpad Entry Cheat Sheet • Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} • Total Items: ${activeItems.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 55px; text-align: center;">PLU #</th>
        <th>Product Name (English / Tamil)</th>
        <th style="width: 110px;">Category</th>
        <th style="width: 90px; text-align: right;">Selling Price</th>
        <th style="width: 90px; text-align: right;">Stock Balance</th>
      </tr>
    </thead>
    <tbody>
      ${activeItems.map((p, idx) => `
        <tr>
          <td style="text-align: center;">
            <span class="code-badge">#${String(p.pos_code ?? idx + 1).padStart(2, "0")}</span>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${p.name}</div>
            ${p.name_tamil ? `<div class="tamil">${p.name_tamil}</div>` : ""}
          </td>
          <td style="color: #475569; font-weight: 500;">${p.category || "Seafood"}</td>
          <td class="price">₹${Number(p.price).toFixed(2)} / ${p.unit}</td>
          <td style="text-align: right; font-weight: 600; color: ${(p.stock ?? 0) <= 5 ? "#dc2626" : "#059669"};">
            ${p.stock} ${p.unit}
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="footer">
    <div>Tip: Cashiers can type the PLU code into the POS counter [F2] and press Enter for instant 1-second billing.</div>
    <div>Fish N Fresh Retail Point of Sale</div>
  </div>
</body>
</html>
    `;

    const printWin = window.open("", "_blank", "width=850,height=750");
    if (!printWin) {
      toast.error("Please allow popups to print the POS Cheat Sheet.");
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.onload = () => {
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 250);
    };
  };

  const [seedingCatalog, setSeedingCatalog] = useState(false);
  const handleApplyRealCatalog = async () => {
    if (!confirm("This will load 10 authentic dock-fresh coastal seafood & meat items (Vanjaram ₹950, Pomfret ₹880, Tiger Prawns ₹720, etc.) with real market prices, photos, and PLU codes into your store. Proceed?")) return;
    try {
      setSeedingCatalog(true);
      const res = await applyRealProductsCatalog({ data: { archiveExisting: false } });
      if (res.success) {
        toast.success(`Successfully loaded ${res.inserted} authentic real seafood & meat products!`);
        qc.invalidateQueries({ queryKey: ["admin", "products"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      } else {
        toast.error(res.error || "Failed to load real catalog");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load real catalog");
    } finally {
      setSeedingCatalog(false);
    }
  };

  return (
    <AdminShell
      title="Products & Inventory"
      allow={["admin", "manager", "inventory_manager", "staff"]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="rounded-xl h-9 font-bold text-xs gap-1.5 border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary"
            onClick={handleApplyRealCatalog}
            disabled={seedingCatalog}
          >
            <Sparkles className="size-3.5 text-primary" /> <span>{seedingCatalog ? "Loading Real Catch…" : "Apply Real Seafood Catalog"}</span>
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-9 font-semibold text-xs gap-1.5 border-border/80 hover:bg-muted"
            onClick={() => {
              const csv = exportProductsToCsv(allProducts);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fish-n-fresh-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${allProducts.length} products to CSV`);
            }}
          >
            <FileDown className="size-3.5" /> <span>Export CSV</span>
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-9 font-semibold text-xs gap-1.5 border-border/80 hover:bg-muted"
            onClick={() => {
              setCsvParsedProducts(null);
              setCsvParseErrors([]);
              setCsvModalOpen(true);
            }}
          >
            <FileUp className="size-3.5" /> <span>Import CSV</span>
          </Button>
          <Button
            className="rounded-xl h-9 font-bold shadow-xs"
            onClick={() => {
              setNewProduct((prev) => ({ ...prev, pos_code: String(nextSuggestedPosCode) }));
              setOpenAdd(true);
            }}
          >
            <Plus className="mr-1.5 size-4" /> Add Product
          </Button>
        </div>
      }
    >
      {/* Top Admin Sub-Navigation Tabs */}
      <div className="w-full min-w-0 overflow-x-auto no-scrollbar touch-pan-x pb-1 mb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-max border border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => setAdminTab("products")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              adminTab === "products"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PackagePlus className="size-3.5 shrink-0" />
            <span>Products Catalog</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono">
              {allProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab("categories")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              adminTab === "categories"
                ? "bg-card text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5 shrink-0" />
            <span>Category Management</span>
            <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.2 text-[10px] font-mono">
              {categories?.length ?? 0}
            </span>
          </button>
        </div>
      </div>

      {adminTab === "categories" ? (
        <CategoryManagement />
      ) : (
        <>
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
              variant={filterType === "low" ? "default" : "outline"}
              className="rounded-xl h-7.5 text-xs font-bold self-start sm:self-auto border-amber-500/40 text-amber-700 dark:text-amber-300"
              onClick={() => setFilterType(filterType === "low" ? "all" : "low")}
            >
              {filterType === "low" ? "Show All Items" : "View Depleted Only"}
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

      {/* Search Bar */}
      <div className="mb-3 relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name, tamil name, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8 rounded-xl h-10 bg-card text-sm w-full"
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

      {/* Primary Filter Tabs - Full-width horizontally scrollable row */}
      <div 
        className="mb-2 w-full min-w-0 overflow-x-auto touch-pan-x scroll-smooth no-scrollbar flex items-center gap-1.5 pb-1"
        onWheel={(e) => {
          if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        <Button
          size="sm"
          variant={filterType === "all" ? "default" : "outline"}
          className="rounded-xl h-8.5 text-xs font-semibold shrink-0"
          onClick={() => setFilterType("all")}
        >
          All ({allProducts.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === "active" ? "default" : "outline"}
          className={`rounded-xl h-8.5 text-xs font-semibold shrink-0 ${
            filterType === "active"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
          }`}
          onClick={() => setFilterType("active")}
        >
          <Eye className="mr-1.5 size-3.5" /> Active ({activeProducts.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === "inactive" ? "default" : "outline"}
          className={`rounded-xl h-8.5 text-xs font-semibold shrink-0 ${
            filterType === "inactive"
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
          }`}
          onClick={() => setFilterType("inactive")}
        >
          <EyeOff className="mr-1.5 size-3.5" /> Inactive / Hidden ({inactiveProducts.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === "featured" ? "default" : "outline"}
          className={`rounded-xl h-8.5 text-xs font-semibold shrink-0 ${
            filterType === "featured"
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          }`}
          onClick={() => setFilterType("featured")}
        >
          ⭐ Featured ({featuredProducts.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === "bestseller" ? "default" : "outline"}
          className={`rounded-xl h-8.5 text-xs font-semibold shrink-0 ${
            filterType === "bestseller"
              ? "bg-rose-500 hover:bg-rose-600 text-white"
              : "border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
          }`}
          onClick={() => setFilterType("bestseller")}
        >
          🔥 Best Sellers ({bestSellerProducts.length})
        </Button>
        <Button
          size="sm"
          variant={filterType === "low" ? "default" : "outline"}
          className={`rounded-xl h-8.5 text-xs font-semibold shrink-0 ${
            lowStockProducts.length > 0 && filterType !== "low"
              ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
              : ""
          }`}
          onClick={() => setFilterType("low")}
        >
          ⚠️ Low Stock ({lowStockProducts.length})
        </Button>
      </div>

      {/* Category Chips - Full-width horizontally scrollable row */}
      <div 
        className="mb-3.5 w-full min-w-0 overflow-x-auto touch-pan-x scroll-smooth no-scrollbar flex items-center gap-1.5 pb-1"
        onWheel={(e) => {
          if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`rounded-full px-3 py-1 text-xs font-semibold shrink-0 transition-all border ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
              : "bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          }`}
        >
          All Categories ({allProducts.length})
        </button>
        {(categories ?? []).map((cat) => {
          const count = allProducts.filter((p) => p.category === cat.name).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? "all" : cat.name)}
              className={`rounded-full px-3 py-1 text-xs font-semibold shrink-0 transition-all border ${
                selectedCategory === cat.name
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-h-[88vh] flex flex-col p-0 rounded-2xl w-[calc(100vw-1.5rem)] sm:max-w-lg overflow-hidden mx-auto">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Add New Product
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name" className="text-xs font-semibold">Name (English) *</Label>
                <Input
                  id="prod-name"
                  placeholder="e.g. Vanjaram / King Fish, Fresh Mutton, Tiger Prawns"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-tamil" className="text-xs font-semibold">Name (Tamil / Local)</Label>
                <Input
                  id="prod-tamil"
                  placeholder="e.g. வஞ்சிரம், ஆட்டிறைச்சி"
                  value={newProduct.name_tamil}
                  onChange={(e) => setNewProduct({ ...newProduct, name_tamil: e.target.value })}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <select
                  className="flex h-9 w-full rounded-xl border border-input bg-card px-3 py-1 text-xs shadow-xs"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {[...(categories ?? [])]
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  <option value="__custom__">+ Custom Category...</option>
                </select>
                {newProduct.category === "__custom__" && (
                  <Input
                    placeholder="Type custom category name..."
                    value={newProduct.customCategory}
                    onChange={(e) => setNewProduct({ ...newProduct, customCategory: e.target.value })}
                    className="mt-1.5 rounded-xl h-8 text-xs"
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

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-pos-code" className="text-primary font-bold flex items-center gap-1">
                    <Hash className="size-3" /> PLU Code
                  </Label>
                  <Input
                    id="prod-pos-code"
                    type="number"
                    placeholder={`#${nextSuggestedPosCode}`}
                    value={newProduct.pos_code}
                    onChange={(e) => setNewProduct({ ...newProduct, pos_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cost-price" className="text-emerald-700 dark:text-emerald-400 font-bold">
                    Buying Cost (₹)
                  </Label>
                  <Input
                    id="prod-cost-price"
                    type="number"
                    placeholder="e.g. 320"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                  />
                </div>
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

              {Number(newProduct.cost_price) > 0 && Number(newProduct.price) > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>
                    Unit Gross Margin: <strong>{Math.round(((Number(newProduct.price) - Number(newProduct.cost_price)) / Number(newProduct.price)) * 100)}%</strong>
                  </span>
                  <span>
                    Gross Profit per unit: <strong>{formatINR(Number(newProduct.price) - Number(newProduct.cost_price))}</strong>
                  </span>
                </div>
              )}

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
                  placeholder="High quality product details and description..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>

              {/* Optional Retail & Hardware Tracking (Collapsed by default) */}
              <div className="rounded-2xl border border-border/80 bg-muted/15 p-3">
                <button
                  type="button"
                  onClick={() => setShowAddRetailSpecs(!showAddRetailSpecs)}
                  className="flex items-center justify-between w-full text-left cursor-pointer"
                >
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <span>Advanced Retail / Hardware Specs</span>
                    <Badge variant="outline" className="text-[10px] py-0 font-normal">Optional</Badge>
                  </Label>
                  <span className="text-xs font-bold text-primary">
                    {showAddRetailSpecs ? "− Hide" : "+ Show (Brand, Warranty, IMEI)"}
                  </span>
                </button>

                {showAddRetailSpecs && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-brand" className="text-xs">Brand / Supplier</Label>
                        <Input
                          id="prod-brand"
                          placeholder="e.g. Kasimedu Dock, FreshCo, Amul"
                          value={newProduct.brand}
                          onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-model" className="text-xs">Model Number / SKU</Label>
                        <Input
                          id="prod-model"
                          placeholder="e.g. VNJ-1KG, SK-01"
                          value={newProduct.model_number}
                          onChange={(e) => setNewProduct({ ...newProduct, model_number: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-warranty" className="text-xs">Warranty Period (Months)</Label>
                        <Input
                          id="prod-warranty"
                          type="number"
                          placeholder="0 for fresh food"
                          value={newProduct.warranty_period_months}
                          onChange={(e) => setNewProduct({ ...newProduct, warranty_period_months: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-aisle" className="text-xs">Storage / Cold Rack / Freezer</Label>
                        <Input
                          id="prod-aisle"
                          placeholder="e.g. Chiller A, Freezer 2, Rack 3"
                          value={newProduct.aisle_location}
                          onChange={(e) => setNewProduct({ ...newProduct, aisle_location: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <Switch
                          checked={newProduct.requires_serial}
                          onCheckedChange={(requires_serial) => setNewProduct({ ...newProduct, requires_serial })}
                        />
                        <span className={newProduct.requires_serial ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"}>
                          Require Serial / Barcode scan at checkout
                        </span>
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="prod-specs" className="text-xs">Technical Specs / Storage Notes</Label>
                      <Textarea
                        id="prod-specs"
                        placeholder="Cut: Whole Fish / Steaks&#10;Catch: Fresh Sea Catch&#10;Temp: 0-4°C"
                        rows={2}
                        value={newProduct.specifications_text}
                        onChange={(e) => setNewProduct({ ...newProduct, specifications_text: e.target.value })}
                        className="rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-border/80 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={newProduct.is_available}
                    onCheckedChange={(is_available) => setNewProduct({ ...newProduct, is_available })}
                  />
                  <span className={newProduct.is_available ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                    {newProduct.is_available ? "Active (Live)" : "Inactive"}
                  </span>
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
            </div>

            {/* Pinned Footer with Action Buttons */}
            <div className="p-3 sm:p-4 border-t border-border/60 shrink-0 bg-background/95 backdrop-blur-xs flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenAdd(false)}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                disabled={createProduct.isPending || !newProduct.name || !newProduct.price}
                onClick={() => createProduct.mutate()}
                className="rounded-xl text-xs font-bold h-9 px-4 shadow-xs"
              >
                {createProduct.isPending ? "Creating Product..." : "Save Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                      <div className="min-w-0 pr-1 flex items-start gap-2">
                        <span className="mt-0.5 px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary text-[11px] font-black font-mono border border-primary/25 shrink-0" title="POS Quick PLU Code">
                          #{String(p.pos_code ?? "—").padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                            {p.name}
                          </h4>
                          {p.name_tamil && (
                            <p className="text-xs text-muted-foreground font-medium">{p.name_tamil}</p>
                          )}
                        </div>
                      </div>

                      {/* Stock Status Badge with proper unit formatting */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border shrink-0 ${
                          !p.is_available
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40"
                            : isOut
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : isLow
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            !p.is_available
                              ? "bg-rose-600"
                              : isOut
                              ? "bg-rose-500"
                              : isLow
                              ? "bg-amber-500 animate-pulse"
                              : "bg-emerald-500"
                          }`}
                        />
                        {!p.is_available
                          ? "Inactive (Hidden)"
                          : isOut
                          ? "Out of Stock"
                          : isLow
                          ? `Low: ${formatStockDisplay(p.stock, p.unit)}`
                          : formatStockDisplay(p.stock, p.unit)}
                      </span>
                    </div>

                    {/* Category & Pricing & Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {p.brand && (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                          {p.brand}
                        </span>
                      )}
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {p.category ?? "General"}
                      </span>
                      {p.model_number && (
                        <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Mod: {p.model_number}
                        </span>
                      )}
                      {p.warranty_period_months ? (
                        <span className="rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
                          🛡️ {p.warranty_period_months}M Warranty
                        </span>
                      ) : null}
                      {p.requires_serial && (
                        <span className="rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
                          IMEI/Serial
                        </span>
                      )}
                      {p.aisle_location && (
                        <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                          📍 {p.aisle_location}
                        </span>
                      )}

                      <span className="font-extrabold text-foreground text-sm sm:text-base">
                        {formatINR(Number(p.price))} <span className="text-xs font-normal text-muted-foreground">/ {p.unit}</span>
                      </span>

                      {discountPercent > 0 && (
                        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          MRP: <span className="line-through">{formatINR(Number(p.old_price))}</span> ({discountPercent}% OFF)
                        </span>
                      )}

                      {p.cost_price != null && Number(p.cost_price) > 0 && (
                        <span className="rounded-md bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-500/20" title={`Buying Cost: ${formatINR(Number(p.cost_price))}`}>
                          Buy: {formatINR(Number(p.cost_price))} ({Math.round(((Number(p.price) - Number(p.cost_price)) / Number(p.price)) * 100)}% Margin)
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 rounded-2xl bg-muted/40 p-2.5 border border-border/60">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Buying Cost (₹)</Label>
                    <Input
                      type="number"
                      defaultValue={p.cost_price ?? ""}
                      placeholder="e.g. 250"
                      className="h-8 rounded-xl text-xs font-bold bg-background text-emerald-700 dark:text-emerald-400"
                      onBlur={(e) => {
                        const val = e.target.value.trim() ? Number(e.target.value) : null;
                        if (val !== p.cost_price) update.mutate({ id: p.id, patch: { cost_price: val } });
                      }}
                    />
                  </div>

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
                      <p className={`text-[10px] font-bold ${p.is_available ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {p.is_available ? "Active" : "Inactive / Hidden"}
                      </p>
                    </div>
                    <Switch
                      checked={p.is_available}
                      onCheckedChange={(is_available) => {
                        update.mutate(
                          { id: p.id, patch: { is_available } },
                          {
                            onSuccess: () => {
                              toast.success(
                                is_available
                                  ? `"${p.name}" is now Active (visible online & POS)`
                                  : `"${p.name}" is now Inactive (hidden from online & POS)`
                              );
                            },
                          }
                        );
                      }}
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
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
                  {/* Quick Refill Button */}
                  <Button
                    size="sm"
                    className="flex-1 min-w-[100px] rounded-xl h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
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
                    className="flex-1 min-w-[65px] rounded-xl h-8 text-xs font-semibold"
                    onClick={() => {
                      const isStandardUnit = UNIT_OPTIONS.includes(p.unit);
                      const specsText = p.specifications
                        ? Object.entries(p.specifications).map(([k, v]) => `${k}: ${v}`).join("\n")
                        : "";
                      setEditingProduct({
                        ...p,
                        cost_price: p.cost_price ?? "",
                        unit: isStandardUnit ? p.unit : "custom",
                        customUnit: isStandardUnit ? "" : p.unit,
                        customCategory: "",
                        brand: p.brand || "",
                        model_number: p.model_number || "",
                        warranty_period_months: p.warranty_period_months ?? 0,
                        aisle_location: p.aisle_location || "",
                        requires_serial: !!p.requires_serial,
                        specifications_text: specsText,
                      });
                    }}
                  >
                    <Edit className="mr-1.5 size-3.5" /> Edit
                  </Button>

                  {/* AI Marine Health & Culinary Intelligence */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-2.5 text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                    title="View / Pre-cache Multi-Language AI Profile"
                    onClick={() => setAiProduct(p)}
                  >
                    <Sparkles className="size-3.5" />
                  </Button>

                  {/* AI Species Visual Showcase & Daily Image Rotation */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-2.5 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 gap-1 shrink-0"
                    title="100% Species Matched Visuals & Daily Image Perspectives"
                    onClick={() => setAiVisualProduct(p)}
                  >
                    <Camera className="size-3.5 text-cyan-500" />
                    <span className="text-[11px] font-bold hidden md:inline">Visuals</span>
                  </Button>

                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="rounded-xl h-8 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" title="Delete Product">
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
      </>
      )}

      {/* Full Edit Product Dialog */}
      <Dialog open={Boolean(editingProduct)} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-h-[88vh] flex flex-col p-0 rounded-2xl w-[calc(100vw-1.5rem)] sm:max-w-lg overflow-hidden mx-auto">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2 truncate">
              <Edit className="size-4 text-primary shrink-0" />
              <span className="truncate">Edit Product: {editingProduct?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="text-xs font-semibold">Name (English) *</Label>
                    <Input
                      id="edit-name"
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="rounded-xl h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-tamil" className="text-xs font-semibold">Name (Tamil / Local)</Label>
                    <Input
                      id="edit-tamil"
                      value={editingProduct.name_tamil ?? ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name_tamil: e.target.value })}
                      className="rounded-xl h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Category</Label>
                    <select
                      className="flex h-9 w-full rounded-xl border border-input bg-card px-3 py-1 text-xs shadow-xs"
                      value={editingProduct.category}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {[...(categories ?? [])]
                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      <option value="__custom__">+ Custom Category...</option>
                    </select>
                    {editingProduct.category === "__custom__" && (
                      <Input
                        placeholder="Type custom category name..."
                        value={editingProduct.customCategory ?? ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, customCategory: e.target.value })}
                        className="mt-1.5 rounded-xl h-8 text-xs"
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

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pos-code" className="text-primary font-bold flex items-center gap-1">
                    <Hash className="size-3" /> PLU Code
                  </Label>
                  <Input
                    id="edit-pos-code"
                    type="number"
                    placeholder="e.g. 1"
                    value={editingProduct.pos_code ?? ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, pos_code: e.target.value ? parseInt(e.target.value, 10) : null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-cost-price" className="text-emerald-700 dark:text-emerald-400 font-bold">
                    Buying Cost (₹)
                  </Label>
                  <Input
                    id="edit-cost-price"
                    type="number"
                    placeholder="e.g. 320"
                    value={editingProduct.cost_price ?? ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: e.target.value })}
                  />
                </div>
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

              {Number(editingProduct.cost_price) > 0 && Number(editingProduct.price) > 0 && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span>
                    Unit Gross Margin: <strong>{Math.round(((Number(editingProduct.price) - Number(editingProduct.cost_price)) / Number(editingProduct.price)) * 100)}%</strong>
                  </span>
                  <span>
                    Gross Profit per unit: <strong>{formatINR(Number(editingProduct.price) - Number(editingProduct.cost_price))}</strong>
                  </span>
                </div>
              )}

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

              {/* Optional Retail & Hardware Tracking (Collapsed by default) */}
              <div className="rounded-2xl border border-border/80 bg-muted/15 p-3">
                <button
                  type="button"
                  onClick={() => setShowEditRetailSpecs(!showEditRetailSpecs)}
                  className="flex items-center justify-between w-full text-left cursor-pointer"
                >
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <span>Advanced Retail / Hardware Specs</span>
                    <Badge variant="outline" className="text-[10px] py-0 font-normal">Optional</Badge>
                  </Label>
                  <span className="text-xs font-bold text-primary">
                    {showEditRetailSpecs ? "− Hide" : "+ Show (Brand, Warranty, IMEI)"}
                  </span>
                </button>

                {showEditRetailSpecs && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-brand" className="text-xs">Brand / Supplier</Label>
                        <Input
                          id="edit-brand"
                          placeholder="e.g. Kasimedu Dock, FreshCo, Amul"
                          value={editingProduct.brand ?? ""}
                          onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-model" className="text-xs">Model Number / SKU</Label>
                        <Input
                          id="edit-model"
                          placeholder="e.g. VNJ-1KG, SK-01"
                          value={editingProduct.model_number ?? ""}
                          onChange={(e) => setEditingProduct({ ...editingProduct, model_number: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-warranty" className="text-xs">Warranty Period (Months)</Label>
                        <Input
                          id="edit-warranty"
                          type="number"
                          placeholder="0 for fresh food"
                          value={editingProduct.warranty_period_months ?? 0}
                          onChange={(e) => setEditingProduct({ ...editingProduct, warranty_period_months: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-aisle" className="text-xs">Storage / Cold Rack / Freezer</Label>
                        <Input
                          id="edit-aisle"
                          placeholder="e.g. Chiller A, Freezer 2, Rack 3"
                          value={editingProduct.aisle_location ?? ""}
                          onChange={(e) => setEditingProduct({ ...editingProduct, aisle_location: e.target.value })}
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <Switch
                          checked={!!editingProduct.requires_serial}
                          onCheckedChange={(requires_serial) => setEditingProduct({ ...editingProduct, requires_serial })}
                        />
                        <span className={editingProduct.requires_serial ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"}>
                          Require Serial / Barcode scan at checkout
                        </span>
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-specs" className="text-xs">Technical Specs / Storage Notes</Label>
                      <Textarea
                        id="edit-specs"
                        placeholder="Cut: Whole Fish / Steaks&#10;Catch: Fresh Sea Catch&#10;Temp: 0-4°C"
                        rows={2}
                        value={editingProduct.specifications_text ?? ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, specifications_text: e.target.value })}
                        className="rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-border/80 bg-muted/20 p-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch
                    checked={editingProduct.is_available}
                    onCheckedChange={(is_available) => setEditingProduct({ ...editingProduct, is_available })}
                  />
                  <span className={editingProduct.is_available ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                    {editingProduct.is_available ? "Active (Live)" : "Inactive"}
                  </span>
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
            </div>

            {/* Pinned Footer with Action Buttons */}
            <div className="p-3 sm:p-4 border-t border-border/60 shrink-0 bg-background/95 backdrop-blur-xs flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProduct(null)}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                disabled={saveEditedProduct.isPending || !editingProduct.name}
                onClick={() => saveEditedProduct.mutate()}
                className="rounded-xl text-xs font-bold h-9 px-4 shadow-xs"
              >
                {saveEditedProduct.isPending ? "Updating Product..." : "Save Changes"}
              </Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Product CSV Import & Template Suite Dialog */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="size-5 text-primary" />
              <span>Bulk Product CSV Import & Templates</span>
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file containing your product catalog or download ready-made templates for your industry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Step 1: Download sample template */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Download Ready Sample Template
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={csvTemplateVertical}
                  onChange={(e) => setCsvTemplateVertical(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs"
                >
                  <option value="electronics_appliances">Electronics & Appliances (IMEI, Specs, Warranty)</option>
                  <option value="clothing_fashion">Clothing & Fashion (Sizes, Fabric, Fit)</option>
                  <option value="grocery_supermarket">Grocery & Supermarket (Aisle, Pack, Nutrition)</option>
                  <option value="departmental_store">Departmental Store (Multi-category)</option>
                  <option value="seafood">Seafood & Meat Catch</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 shrink-0"
                  onClick={() => {
                    const sample = generateSampleCsv(csvTemplateVertical);
                    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `sample_${csvTemplateVertical}_template.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Sample template downloaded");
                  }}
                >
                  <Download className="size-3.5" /> Download Template
                </Button>
              </div>
            </div>

            {/* Step 2: Upload CSV */}
            <div className="rounded-2xl border-2 border-dashed border-border/80 p-5 text-center space-y-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const text = evt.target?.result as string;
                    const res = parseProductsCsv(text);
                    setCsvParsedProducts(res.validProducts);
                    setCsvParseErrors(res.errors);
                  };
                  reader.readAsText(file);
                }}
                className="cursor-pointer file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Supports columns: name, category, price, old_price, unit, stock, brand, model_number, warranty_period_months, requires_serial, aisle_location, specifications, pos_code, description.
              </p>
            </div>

            {/* Parse Warnings / Errors */}
            {csvParseErrors.length > 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1 max-h-32 overflow-y-auto">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> {csvParseErrors.length} issues noted:
                </div>
                {csvParseErrors.map((err, i) => (
                  <div key={i} className="text-[11px] leading-tight">• {err}</div>
                ))}
              </div>
            )}

            {/* Preview of valid items */}
            {csvParsedProducts && csvParsedProducts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-4" /> Ready to import {csvParsedProducts.length} products
                  </span>
                  <span className="text-muted-foreground text-[11px]">Previewing first 5</span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/80 bg-background divide-y divide-border/60">
                  {csvParsedProducts.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="p-2 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold">{p.name}</span>
                        {p.brand && <span className="ml-1 text-[11px] text-muted-foreground">({p.brand})</span>}
                        <div className="text-[10px] text-muted-foreground">
                          {p.category} • {formatINR(p.price || 0)} / {p.unit} • Stock: {p.stock}
                          {p.requires_serial ? " • Serial/IMEI Tracking" : ""}
                          {p.aisle_location ? ` • Aisle: ${p.aisle_location}` : ""}
                        </div>
                      </div>
                      <span className="text-emerald-600 text-xs font-bold">Valid</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setCsvModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl font-bold"
                disabled={!csvParsedProducts || csvParsedProducts.length === 0 || csvImporting}
                onClick={async () => {
                  if (!csvParsedProducts || csvParsedProducts.length === 0) return;
                  setCsvImporting(true);
                  try {
                    const toInsert = csvParsedProducts.map((p) => ({
                      ...p,
                      branch_id: selectedBranchId || null,
                    }));
                    const chunkSize = 50;
                    for (let i = 0; i < toInsert.length; i += chunkSize) {
                      const chunk = toInsert.slice(i, i + chunkSize);
                      const { error } = await supabase.from("products").insert(chunk as Database["public"]["Tables"]["products"]["Insert"][]);
                      if (error) throw error;
                    }
                    toast.success(`Successfully imported ${toInsert.length} products!`);
                    setCsvModalOpen(false);
                    setCsvParsedProducts(null);
                    setCsvParseErrors([]);
                    qc.invalidateQueries({ queryKey: ["admin", "products"] });
                    qc.invalidateQueries({ queryKey: ["products"] });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to import products");
                  } finally {
                    setCsvImporting(false);
                  }
                }}
              >
                {csvImporting ? "Importing..." : `Import ${csvParsedProducts?.length || 0} Products`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Refill Modal */}
      <Dialog open={Boolean(refillProduct)} onOpenChange={(open) => !open && setRefillProduct(null)}>
        <DialogContent className="rounded-2xl w-[calc(100vw-1.5rem)] sm:max-w-md p-4 sm:p-6 mx-auto">
          {refillProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 break-words text-base">
                  <PackagePlus className="size-5 text-amber-500 shrink-0" /> Quick Stock Refill
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
        <DialogContent className="rounded-3xl w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 break-words text-sm sm:text-base">
              <Sparkles className="size-5 text-primary shrink-0" />
              <span className="min-w-0 flex-1 break-words">AI Marine Nutrition & Culinary Intelligence: {aiProduct?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {aiProduct && (
            <div className="mt-2 min-w-0 max-w-full">
              <ProductAiBenefitsCard product={aiProduct} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Species Visual Showcase & Daily Image Rotation Dialog */}
      <Dialog open={Boolean(aiVisualProduct)} onOpenChange={(open) => !open && setAiVisualProduct(null)}>
        <DialogContent className="rounded-3xl w-[calc(100vw-1.25rem)] sm:w-full max-w-3xl max-h-[88vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 mx-auto">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="flex items-center gap-2 break-words text-sm sm:text-base font-bold leading-snug">
              <Camera className="size-5 text-cyan-500 shrink-0" />
              <span className="min-w-0 flex-1 break-words">Species Matched Visual Studio: {aiVisualProduct?.name}</span>
            </DialogTitle>
            <DialogDescription className="break-words text-xs sm:text-sm mt-1">
              Rotate between authentic studio angles (Dock Fresh, Master Cuts, Ready to Cook) to keep your catalog dynamic daily without manual photography.
            </DialogDescription>
          </DialogHeader>

          {aiVisualProduct && (() => {
            const profile = matchSpeciesVisualProfile(aiVisualProduct.name);
            return (
              <div className="space-y-4 sm:space-y-6 mt-2 max-w-full min-w-0">
                {/* Active Image Banner */}
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-muted/40 border min-w-0 overflow-hidden">
                  <img
                    src={aiVisualProduct.image_url || "/placeholder.svg"}
                    alt={aiVisualProduct.name}
                    className="size-14 sm:size-16 rounded-xl object-cover border shrink-0"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Active Catalog Image</p>
                    <p className="text-xs sm:text-sm font-bold truncate">{aiVisualProduct.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{aiVisualProduct.image_url || "Default placeholder"}</p>
                  </div>
                </div>

                {/* Perspective Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-full">
                  {profile?.perspectives.map((persp) => {
                    const isCurrent = aiVisualProduct.image_url === persp.imageUrl;
                    return (
                      <div
                        key={persp.id}
                        className={`rounded-2xl border p-3 flex flex-col justify-between transition-all min-w-0 max-w-full overflow-hidden ${
                          isCurrent
                            ? "ring-2 ring-primary border-primary bg-primary/5"
                            : "hover:border-primary/50 bg-card"
                        }`}
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted">
                            <img
                              src={persp.imageUrl}
                              alt={persp.title}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm uppercase">
                              {persp.perspectiveType.replace("_", " ")}
                            </span>
                            {isCurrent && (
                              <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow">
                                <Check className="size-3" /> Active
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm leading-tight break-words">{persp.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words">{persp.description}</p>
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 italic break-words">
                            📸 {persp.photographerNotes}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            disabled={isCurrent || update.isPending}
                            className={`rounded-xl h-8 w-full text-xs font-semibold ${
                              isCurrent
                                ? "bg-muted text-muted-foreground hover:bg-muted"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            }`}
                            onClick={async () => {
                              try {
                                await update.mutateAsync({
                                  id: aiVisualProduct.id,
                                  patch: { image_url: persp.imageUrl },
                                });
                                setAiVisualProduct({ ...aiVisualProduct, image_url: persp.imageUrl });
                                toast.success(`Updated catalog image to "${persp.title}"!`);
                              } catch (e: any) {
                                toast.error(e.message || "Failed to update product image");
                              }
                            }}
                          >
                            <RefreshCw className={`size-3.5 mr-1.5 ${update.isPending ? "animate-spin" : ""}`} />
                            {isCurrent ? "Active Image" : "Set as Catalog Image"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-7 w-full text-[11px] text-muted-foreground gap-1"
                            onClick={() => {
                              const prompt = buildSpeciesAiPrompt(aiVisualProduct.name, persp.perspectiveType);
                              navigator.clipboard.writeText(prompt);
                              setCopiedPrompt(persp.id);
                              toast.success("Copied AI photography prompt to clipboard!");
                              setTimeout(() => setCopiedPrompt(null), 2500);
                            }}
                          >
                            {copiedPrompt === persp.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" />
                                Copied Prompt
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                Copy AI Prompt
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-900 dark:text-cyan-200 break-words">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <Sparkles className="size-4 text-cyan-500 shrink-0" />
                    How to use Lovable AI Image Generation within free limits:
                  </p>
                  <p className="text-muted-foreground leading-relaxed break-words">
                    Click <strong>Copy AI Prompt</strong> above, paste into Lovable AI or your preferred image studio, and paste the generated URL back into the product edit modal. Each prompt is specifically engineered with authentic botanical/zoological species accuracy, depth of field, and lighting so images never look fake.
                  </p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

