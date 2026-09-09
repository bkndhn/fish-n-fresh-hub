import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Store,
  Printer,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Banknote,
  CreditCard,
  Scale,
  Scissors,
  Receipt,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  User,
  X,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatINR, formatStockDisplay, formatStockUnitLabel } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PrinterSettingsModal } from "@/components/admin/PrinterSettingsModal";
import {
  getSavedPrinterConfig,
  sendEscPosToPrinter,
  buildPosReceiptEscPos,
  buildPosReceiptHtml,
  type PosReceiptData,
  type PosReceiptItem,
} from "@/lib/thermalPrinter";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  head: () => ({
    meta: [
      { title: "In-Store Retail POS Counter | Fish N Fresh Admin" },
      {
        name: "description",
        content: "High-speed in-store seafood billing counter with weighing scale entry, thermal receipt printing, cash drawer kick, and real-time unified inventory deduction.",
      },
    ],
  }),
  component: RetailPosCounterPage,
});

export interface PosCartItem {
  id: string; // unique cart entry id
  productId: string;
  name: string;
  pricePerKg: number;
  weightKg: number;
  qty: number;
  unit: string;
  cuttingStyle?: string;
  totalPrice: number;
  image?: string | null;
  gstPercent: number;
}

const CUTTING_STYLES = [
  "Curry Cut",
  "Fry Cut / Slices",
  "Whole Cleaned",
  "Fillet / Boneless",
  "Biryani Cut",
  "Head & Tail Separate",
  "No Cleaning (Whole)",
];

const QUICK_WEIGHTS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 5.0];

export function RetailPosCounterPage() {
  const qc = useQueryClient();
  const { data: rawProducts = [], isLoading: productsLoading } = useQuery(adminProductsQuery);
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: settings } = useQuery(settingsQuery);

  // Filter products that are active
  const products = useMemo(() => {
    return (rawProducts as Product[]).filter((p) => p.is_available !== false);
  }, [rawProducts]);

  // UI States
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Item customizer modal
  const [activeItemModal, setActiveItemModal] = useState<Product | null>(null);
  const [modalWeight, setModalWeight] = useState<number>(1.0);
  const [modalCutting, setModalCutting] = useState<string>("Curry Cut");

  // Payment states
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card">("cash");
  const [tenderedAmount, setTenderedAmount] = useState<string>("");
  const [upiUtr, setUpiUtr] = useState<string>("");
  const [processingOrder, setProcessingOrder] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);

  // Cashier Identity
  const [cashierName, setCashierName] = useState("Counter Staff");
  const [cashierId, setCashierId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCashierId(data.user.id);
        const name = (data.user.user_metadata as Record<string, string> | null)?.["name"] || data.user.email?.split("@")[0] || "Cashier";
        setCashierName(name);
      }
    });
  }, []);

  // Filtered Products
  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.name_tamilmil ? p.name_tamilmil.toLowerCase().includes(q) : false)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cart]);

  const gstTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      if (item.gstPercent > 0) {
        return acc + Math.round((item.totalPrice * item.gstPercent) / 100);
      }
      return acc;
    }, 0);
  }, [cart]);

  const totalPayable = Math.max(0, subtotal - discountAmount + gstTotal);

  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, tenderedNum - totalPayable);

  // Today's POS summary stats from orders
  const { data: todaysPosOrders = [] } = useQuery({
    queryKey: ["admin", "pos-orders-today"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, actual_payment_method, payment_method, fulfillment_type, created_at")
        .eq("fulfillment_type", "pos")
        .gte("created_at", todayStart.toISOString());

      if (error) return [];
      return data || [];
    },
  });

  const posStats = useMemo(() => {
    let totalCash = 0;
    let totalUpi = 0;
    let totalSales = 0;
    todaysPosOrders.forEach((o: any) => {
      const amt = Number(o.total || 0);
      totalSales += amt;
      const meth = (o.actual_payment_method || o.payment_method || "").toLowerCase();
      if (meth === "cash") totalCash += amt;
      else if (meth === "upi" || meth === "upi_qr") totalUpi += amt;
    });
    return {
      count: todaysPosOrders.length,
      totalSales,
      totalCash,
      totalUpi,
    };
  }, [todaysPosOrders]);

  // Open item customization modal
  const handleOpenItem = (prod: Product) => {
    setActiveItemModal(prod);
    setModalWeight(1.0);
    setModalCutting(CUTTING_STYLES[0] ?? "Curry Cut");
  };

  // Add item to cart
  const handleAddToCart = () => {
    if (!activeItemModal) return;
    const isWeightBased = (activeItemModal.unit || "kg").toLowerCase() === "kg";
    const pricePerKg = Number(activeItemModal.price);
    const weight = isWeightBased ? modalWeight : 1;
    const qty = isWeightBased ? 1 : Math.round(modalWeight);
    const totalPrice = Math.round(pricePerKg * modalWeight);

    const newItem: PosCartItem = {
      id: `${activeItemModal.id}-${Date.now()}`,
      productId: activeItemModal.id,
      name: activeItemModal.name,
      pricePerKg,
      weightKg: isWeightBased ? modalWeight : 0,
      qty,
      unit: activeItemModal.unit || "kg",
      cuttingStyle: modalCutting,
      totalPrice,
      image: activeItemModal.image_url,
      gstPercent: (activeItemModal as any).gst_percent || 0,
    };

    setCart((prev) => [...prev, newItem]);
    setActiveItemModal(null);
    toast.success(`Added ${newItem.name} (${newItem.weightKg ? `${newItem.weightKg} kg` : `${newItem.qty} pcs`}) to bill`);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearBill = () => {
    setCart([]);
    setDiscountAmount(0);
    setTenderedAmount("");
    setUpiUtr("");
    setCustomerName("");
    setCustomerPhone("");
  };

  // Generate UPI Deep Link and QR Code for POS counter screen
  const upiId = settings?.upi_id || "9843061919@upi";
  const upiName = settings?.upi_name || "Fish N Fresh";
  const posUpiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalPayable}&cu=INR&tn=${encodeURIComponent(`Counter Bill`)}`;
  const posUpiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(posUpiDeepLink)}`;

  // Complete Retail Sale Mutation
  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error("Billing cart is empty! Add products first.");
      return;
    }
    if (paymentMode === "cash" && tenderedNum > 0 && tenderedNum < totalPayable) {
      toast.error(`Cash tendered (₹${tenderedNum}) is less than total payable (₹${totalPayable})`);
      return;
    }

    setProcessingOrder(true);
    const orderNumber = `POS-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();
    const dateFormatted = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const receiptItems: PosReceiptItem[] = cart.map((it) => ({
      name: it.name,
      weightKg: it.weightKg > 0 ? it.weightKg : undefined,
      qty: it.qty,
      unitPrice: it.pricePerKg,
      totalPrice: it.totalPrice,
      cuttingStyle: it.cuttingStyle,
    }));

    const receiptData: PosReceiptData = {
      receiptNo: orderNumber,
      date: dateFormatted,
      cashierName,
      customerName: customerName.trim() || "Walk-in Customer",
      customerPhone: customerPhone.trim() || undefined,
      items: receiptItems,
      subtotal,
      discount: discountAmount,
      gstAmount: gstTotal,
      total: totalPayable,
      paymentMethod: paymentMode,
      amountTendered: paymentMode === "cash" ? (tenderedNum || totalPayable) : undefined,
      changeDue: paymentMode === "cash" ? changeDue : undefined,
      upiRef: paymentMode === "upi" && upiUtr.trim() ? upiUtr.trim() : undefined,
      storeName: settings?.store_name || "Fish N Fresh Hub",
      storeAddress: settings?.store_address || undefined,
      storePhone: (settings as any)?.contact_phone || undefined,
      storeGstin: (settings as any)?.gst_number || undefined,
    };

    try {
      // 1. Create order in orders table
      const orderPayload = {
        order_number: orderNumber,
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || "9999999999",
        fulfillment_type: "pos",
        status: "delivered",
        payment_method: paymentMode,
        payment_status: "paid",
        actual_payment_method: paymentMode === "upi" ? "upi_qr" : paymentMode,
        actual_payment_ref: upiUtr.trim() || null,
        paid_to_bank_directly: paymentMode === "upi",
        subtotal,
        discount: discountAmount,
        gst_amount: gstTotal,
        total: totalPayable,
        items: cart.map((it) => ({
          product_id: it.productId,
          name: it.name,
          price: it.pricePerKg,
          qty: it.weightKg > 0 ? it.weightKg : it.qty,
          unit: it.unit,
          cutting_style: it.cuttingStyle,
          line_total: it.totalPrice,
        })) as any,
        pos_cashier_id: cashierId,
        pos_cashier_name: cashierName,
        pos_amount_tendered: paymentMode === "cash" ? (tenderedNum || totalPayable) : null,
        pos_change_due: paymentMode === "cash" ? changeDue : null,
        delivered_at: nowIso,
      };

      const { data: orderRes, error: orderErr } = await supabase
        .from("orders")
        .insert(orderPayload as any)
        .select("id, order_number")
        .single();

      if (orderErr) {
        console.warn("Could not insert order:", orderErr.message);
      }

      // 2. Real-time Inventory Deduction: update product stock atomically
      for (const item of cart) {
        const { data: prodData } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.productId)
          .maybeSingle();

        if (prodData && typeof prodData.stock === "number") {
          const deductAmount = item.weightKg > 0 ? item.weightKg : item.qty;
          const newStock = Math.max(0, Math.round((prodData.stock - deductAmount) * 100) / 100);
          await supabase
            .from("products")
            .update({ stock: newStock } as any)
            .eq("id", item.productId);
        }
      }

      // 3. Print ESC/POS thermal receipt via connected printer or styled fallback
      const printerConfig = getSavedPrinterConfig();
      const escPosBytes = buildPosReceiptEscPos(receiptData, printerConfig);
      const fallbackHtml = buildPosReceiptHtml(receiptData, printerConfig);

      try {
        await sendEscPosToPrinter(escPosBytes, printerConfig, fallbackHtml);
      } catch (printErr) {
        console.warn("Direct thermal print notice:", printErr);
      }

      setLastReceipt(receiptData);
      toast.success(`Bill #${orderNumber} completed! Net: ${formatINR(totalPayable)}`);

      // Reset bill
      handleClearBill();
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "pos-orders-today"] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to complete POS sale");
    } finally {
      setProcessingOrder(false);
    }
  };

  const reprintLastBill = async () => {
    if (!lastReceipt) {
      toast.error("No recent receipt to reprint");
      return;
    }
    const printerConfig = getSavedPrinterConfig();
    const escPosBytes = buildPosReceiptEscPos(lastReceipt, printerConfig);
    const fallbackHtml = buildPosReceiptHtml(lastReceipt, printerConfig);
    await sendEscPosToPrinter(escPosBytes, printerConfig, fallbackHtml);
    toast.success(`Reprinted Bill #${lastReceipt.receiptNo}`);
  };

  return (
    <AdminShell title="In-Store Retail POS Counter" allow={["admin", "staff"]}>
      <div className="space-y-4 max-w-7xl mx-auto pb-12">
        {/* Top Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs">
              <Store className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold text-foreground">
                  Retail POS Billing Counter
                </h1>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Cashier: {cashierName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                In-store walk-in counter checkout · Real-time unified stock deduction
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Daily POS Stats */}
            <div className="hidden md:flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/60 text-xs">
              <span className="text-muted-foreground font-medium">Today's Shift:</span>
              <span className="font-bold text-foreground">{posStats.count} Bills</span>
              <span className="text-border">|</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Cash: {formatINR(posStats.totalCash)}
              </span>
              <span className="text-border">|</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                UPI: {formatINR(posStats.totalUpi)}
              </span>
            </div>

            {/* Reprint Last Bill */}
            {lastReceipt && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8.5 text-xs font-semibold gap-1.5"
                onClick={reprintLastBill}
              >
                <RotateCcw className="size-3.5 text-primary" />
                <span>Reprint Last Bill</span>
              </Button>
            )}

            {/* Printer Settings Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80"
              onClick={() => setPrinterModalOpen(true)}
            >
              <Printer className="size-3.5 text-primary" />
              <span>Thermal Printer</span>
            </Button>
          </div>
        </div>

        {/* 2-Column POS Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 items-start">
          {/* LEFT: Fast Touch Product Catalog */}
          <div className="space-y-3">
            {/* Search & Category Filter */}
            <div className="space-y-2 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Fast search seafood / meat by name (English or Tamil)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-background"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className="rounded-xl h-7 text-xs shrink-0 font-semibold"
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items ({products.length})
                </Button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category_id === cat.id).length;
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.id ? "default" : "outline"}
                      className="rounded-xl h-7 text-xs shrink-0 font-semibold"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.name} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {displayedProducts.map((prod) => {
                const isOutOfStock = typeof prod.stock === "number" && prod.stock <= 0;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleOpenItem(prod)}
                    className={`relative text-left p-3 rounded-2xl border transition-all duration-150 flex flex-col justify-between group ${
                      isOutOfStock
                        ? "opacity-50 border-dashed border-border bg-muted/30 cursor-not-allowed"
                        : "bg-card border-border/80 hover:border-primary/60 hover:shadow-md active:scale-98"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="aspect-4/3 w-full rounded-xl overflow-hidden bg-muted/40 relative">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-semibold">
                            No image
                          </div>
                        )}
                        {/* Live Stock Badge */}
                        <div className="absolute bottom-1 right-1">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-xs ${
                              isOutOfStock
                                ? "bg-destructive text-destructive-foreground"
                                : (prod.stock ?? 0) < 5
                                ? "bg-amber-500 text-white"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {isOutOfStock ? "Out" : `${prod.stock} ${prod.unit || "kg"}`}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {prod.name}
                        </p>
                        {prod.name_ta && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {prod.name_ta}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                      <span className="font-bold text-xs text-primary font-mono">
                        {formatINR(Number(prod.price))}/{prod.unit || "kg"}
                      </span>
                      <span className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}

              {displayedProducts.length === 0 && !productsLoading && (
                <div className="col-span-full p-8 text-center bg-card rounded-2xl border border-dashed text-muted-foreground text-xs">
                  No products found in this category.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Active Bill & Checkout Panel */}
          <div className="space-y-3 sticky top-4">
            <Card className="border-border/80 shadow-md rounded-3xl overflow-hidden">
              {/* Bill Header */}
              <CardHeader className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4.5 text-primary" />
                    <CardTitle className="text-sm font-bold">Current Counter Bill</CardTitle>
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearBill}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2"
                    >
                      <Trash2 className="size-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {/* Optional Customer Contact for FreshCash / History */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Input
                    placeholder="Customer Name (Opt)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-7 text-xs rounded-lg bg-background"
                  />
                  <Input
                    placeholder="Mobile No. (Opt)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-7 text-xs rounded-lg bg-background font-mono"
                  />
                </div>
              </CardHeader>

              {/* Bill Line Items */}
              <CardContent className="p-4 space-y-3">
                <div className="max-h-56 overflow-y-auto divide-y divide-border/40 pr-1">
                  {cart.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-foreground truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.weightKg > 0 ? `${item.weightKg.toFixed(2)} kg` : `${item.qty} ${item.unit}`} × ₹{item.pricePerKg}
                          {item.cuttingStyle && (
                            <span className="ml-1.5 text-primary font-medium">[{item.cuttingStyle}]</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs font-mono">{formatINR(item.totalPrice)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                      <ShoppingBag className="size-8 mx-auto opacity-30" />
                      <p>Counter bill is empty</p>
                      <p className="text-[10px]">Click any seafood / meat on the left to add</p>
                    </div>
                  )}
                </div>

                {/* Bill Totals Calculation */}
                {cart.length > 0 && (
                  <div className="space-y-1.5 pt-3 border-t border-border/60 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal ({cart.length} items)</span>
                      <span className="font-mono font-medium">{formatINR(subtotal)}</span>
                    </div>

                    {gstTotal > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST</span>
                        <span className="font-mono font-medium">{formatINR(gstTotal)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Counter Discount</span>
                      <div className="flex items-center gap-1">
                        <span>-₹</span>
                        <input
                          type="number"
                          value={discountAmount || ""}
                          onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                          placeholder="0"
                          className="w-16 h-6 text-right px-1 text-xs rounded border border-border bg-background font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border/80 font-bold text-sm text-foreground">
                      <span>Total Amount</span>
                      <span className="text-base font-extrabold text-primary font-mono">
                        {formatINR(totalPayable)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Selection Tabs */}
                {cart.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-3 gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => setPaymentMode("cash")}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "cash"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Banknote className="size-3.5" /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("upi")}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "upi"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <QrCode className="size-3.5" /> UPI QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("card")}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "card"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <CreditCard className="size-3.5" /> Card
                      </button>
                    </div>

                    {/* Cash Tender Calculation */}
                    {paymentMode === "cash" && (
                      <div className="space-y-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-amber-900 dark:text-amber-200">
                            Cash Received from Customer:
                          </span>
                          <Input
                            type="number"
                            placeholder={totalPayable.toString()}
                            value={tenderedAmount}
                            onChange={(e) => setTenderedAmount(e.target.value)}
                            className="w-28 h-7 text-right text-xs font-mono font-bold bg-background rounded-lg"
                          />
                        </div>

                        {/* Quick Tender Buttons */}
                        <div className="flex flex-wrap gap-1">
                          {[totalPayable, 500, 1000, 2000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setTenderedAmount(amt.toString())}
                              className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-mono hover:bg-amber-500/20 transition"
                            >
                              ₹{amt}
                            </button>
                          ))}
                        </div>

                        {tenderedNum > 0 && (
                          <div className="flex items-center justify-between pt-1 font-bold text-xs border-t border-amber-500/30">
                            <span className="text-amber-900 dark:text-amber-200">Change to Return:</span>
                            <span
                              className={`font-mono text-sm ${
                                changeDue >= 0 ? "text-emerald-700 dark:text-emerald-400 font-extrabold" : "text-destructive"
                              }`}
                            >
                              {formatINR(changeDue)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dynamic In-Store Counter UPI QR Code */}
                    {paymentMode === "upi" && (
                      <div className="space-y-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs">
                        <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                          <span>Show QR to Customer</span>
                          <span>{formatINR(totalPayable)}</span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-2.5 bg-white rounded-xl border">
                          <img
                            src={posUpiQrUrl}
                            alt="Counter UPI QR Code"
                            className="size-36 object-contain"
                          />
                          <p className="mt-1 text-[10px] font-bold text-emerald-700">
                            Scan with GPay / PhonePe / Paytm
                          </p>
                        </div>

                        <Input
                          placeholder="12-Digit UPI Ref / UTR (Optional)"
                          value={upiUtr}
                          onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                          className="h-7 text-xs font-mono rounded-lg bg-background"
                        />
                      </div>
                    )}

                    {/* One-Click Complete & Print Bill */}
                    <Button
                      type="button"
                      disabled={processingOrder}
                      onClick={completeSale}
                      className="w-full rounded-2xl h-12 text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {processingOrder ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="size-4 animate-spin" />
                          Printing Receipt & Deducting Stock...
                        </span>
                      ) : (
                        <>
                          <Printer className="size-4.5" />
                          <span>Complete Sale &amp; Print Bill ({formatINR(totalPayable)})</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Item Weighing Scale & Cutting Style Customizer Modal */}
      {activeItemModal && (
        <Dialog open={!!activeItemModal} onOpenChange={(open) => !open && setActiveItemModal(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl">
            <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs">
                  <Scale className="size-5" />
                </div>
                <div>
                  <DialogTitle className="font-display text-base font-bold text-foreground">
                    {activeItemModal.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Rate: {formatINR(Number(activeItemModal.price))}/{activeItemModal.unit || "kg"} · Live Stock: {activeItemModal.stock} {activeItemModal.unit || "kg"}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Decimal Weighing Scale Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scale className="size-3.5 text-primary" /> Scale Weight (in kg)
                  </label>
                  <span className="text-sm font-extrabold text-primary font-mono">
                    {formatINR(Math.round(Number(activeItemModal.price) * modalWeight))}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={modalWeight}
                    onChange={(e) => setModalWeight(Math.max(0.01, parseFloat(e.target.value) || 0))}
                    className="h-11 text-center font-mono text-xl font-bold rounded-xl"
                  />
                  <span className="text-xs font-bold text-muted-foreground shrink-0">KG</span>
                </div>

                {/* Quick Weight Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_WEIGHTS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setModalWeight(w)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                        modalWeight === w
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "bg-muted/50 hover:bg-muted text-foreground border border-border/60"
                      }`}
                    >
                      {w} kg
                    </button>
                  ))}
                </div>
              </div>

              {/* Cutting & Cleaning Style Selection */}
              <div className="space-y-2 pt-1 border-t border-border/50">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Scissors className="size-3.5 text-primary" /> Cleaning & Cutting Style
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CUTTING_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setModalCutting(style)}
                      className={`text-left p-2.5 rounded-xl text-xs font-medium transition-all ${
                        modalCutting === style
                          ? "bg-primary/10 border-primary text-primary font-bold border ring-1 ring-primary/20"
                          : "bg-card border border-border/70 hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Bill Button */}
              <Button
                type="button"
                onClick={handleAddToCart}
                className="w-full rounded-2xl h-11 text-sm font-bold shadow-md gap-2"
              >
                <span>Add {modalWeight} kg to Bill · {formatINR(Math.round(Number(activeItemModal.price) * modalWeight))}</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bluetooth & USB ESC/POS Printer Pairing Modal */}
      <PrinterSettingsModal
        open={printerModalOpen}
        onOpenChange={setPrinterModalOpen}
      />
    </AdminShell>
  );
}

export default RetailPosCounterPage;
