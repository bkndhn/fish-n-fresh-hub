import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Utensils,
  Plus,
  Minus,
  Search,
  Sparkles,
  ShoppingCart,
  QrCode,
  CheckCircle2,
  Users,
  Flame,
  ChefHat,
  Receipt,
  MessageSquare,
  AlertCircle,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { productsQuery, categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { soundEngine } from "@/lib/realtime";
import { UpiPaymentQr } from "@/components/UpiPaymentQr";
import { supabase } from "@/integrations/supabase/client";
import type { Product, RestaurantTable, SiteSettings } from "@/lib/types";

export const Route = createFileRoute("/table/$tableNo")({
  component: TableOrderingPage,
});

type SpiceLevel = "mild" | "medium" | "spicy" | "extra_hot";

interface TableCartItem {
  product: Product;
  qty: number;
  spiceLevel: SpiceLevel;
  cookingNote: string;
}

function TableOrderingPage() {
  const { tableNo } = Route.useParams();
  const qc = useQueryClient();

  const { data: rawSettings } = useQuery(settingsQuery);
  const settings = rawSettings as (SiteSettings & {
    table_ordering_enabled?: boolean | null;
    table_ordering_offline_message?: string | null;
    restaurant_tables?: RestaurantTable[] | null;
    allow_unlimited_stock?: boolean | null;
    hide_out_of_stock_badges?: boolean | null;
  }) | null;

  const { data: categories } = useQuery(categoriesQuery);
  const { data: products } = useQuery(productsQuery());

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState<"all" | "veg" | "non-veg">("all");

  // Table Cart State
  const [cart, setCart] = useState<TableCartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  // Split Bill Engine State
  const [splitDiners, setSplitDiners] = useState<number>(2);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShare, setCustomShare] = useState<string>("");

  const storeName = settings?.store_name || "Restaurant & Café";
  const storeUpiId = (settings as any)?.upi_id || "9843061919@upi";

  // Match table configuration from store_settings
  const matchedTable = useMemo(() => {
    const rawTables = settings?.restaurant_tables;
    if (!Array.isArray(rawTables)) return null;
    const cleanNo = String(tableNo).trim().toLowerCase();
    const exact = rawTables.find((t) => String(t.id).toLowerCase() === cleanNo);
    if (exact) return exact;
    const cleanDigits = cleanNo.replace(/\D/g, "");
    return (
      rawTables.find(
        (t) =>
          (cleanDigits && String(t.id).toLowerCase() === cleanDigits) ||
          String(t.name).toLowerCase() === `table ${cleanNo}` ||
          String(t.name).toLowerCase() === `table ${cleanDigits}`
      ) || null
    );
  }, [settings?.restaurant_tables, tableNo]);

  const tableDisplayName = matchedTable ? matchedTable.name : `Table #${tableNo}`;
  const tableDisplayHeader = matchedTable
    ? `${matchedTable.name} • ${matchedTable.section} • ${matchedTable.seating_capacity} Seater`
    : `Table #${tableNo} • Contactless Dine-In`;

  // Unlimited stock configuration
  const isGlobalUnlimited = Boolean(
    settings?.allow_unlimited_stock ||
    settings?.business_vertical === "restaurant_cafe" ||
    settings?.business_vertical === "juice_shake_bar" ||
    settings?.business_vertical === "bakery_cake"
  );
  const hideOutOfStockBadges = Boolean(settings?.hide_out_of_stock_badges);

  // Query existing active orders for this table
  const { data: tableOrders, refetch: refetchTableOrders } = useQuery({
    queryKey: ["table_active_orders", tableNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("fulfillment_type", "dine_in")
        .or(`table_number.eq.${tableNo},customer_address.ilike.%Table #${tableNo}%,notes.ilike.%Table #${tableNo}%`)
        .in("status", ["pending", "confirmed", "packed", "ready", "preparing"])
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed fetching table active orders:", error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 12000,
  });

  // Filtered menu
  const filteredProducts = useMemo(() => {
    let list = (products ?? []) as Product[];
    if (activeCategory !== "all") {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    if (dietFilter === "veg") {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes("veg") ||
          (p.category && p.category.toLowerCase().includes("veg"))
      );
    } else if (dietFilter === "non-veg") {
      list = list.filter(
        (p) =>
          !p.name.toLowerCase().includes("pure veg") &&
          (p.category
            ? !p.category.toLowerCase().includes("pure veg")
            : true)
      );
    }
    return list;
  }, [products, activeCategory, searchQuery, dietFilter]);

  // Cart operations
  const addToCart = (product: Product, spice: SpiceLevel = "medium") => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.product.id === product.id && i.spiceLevel === spice
      );
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.spiceLevel === spice
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }
      return [...prev, { product, qty: 1, spiceLevel: spice, cookingNote: "" }];
    });
    toast.success(`Added ${product.name} to ${tableDisplayName}`);
  };

  const updateCartQty = (productId: string, spice: SpiceLevel, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.product.id === productId && i.spiceLevel === spice) {
            const nextQty = i.qty + delta;
            return nextQty > 0 ? { ...i, qty: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as TableCartItem[];
    });
  };

  const updateCartNote = (productId: string, spice: SpiceLevel, note: string) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId && i.spiceLevel === spice
          ? { ...i, cookingNote: note }
          : i
      )
    );
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setIsCartOpen(false);
    toast.success(`Cart cleared for ${tableDisplayName}`);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Calculate live running table bill from current orders + local pending cart
  const runningTableBillTotal = useMemo(() => {
    const ordersTotal = (tableOrders ?? []).reduce(
      (sum, ord) => sum + Number(ord.total || 0),
      0
    );
    return ordersTotal > 0 ? ordersTotal : cartTotal;
  }, [tableOrders, cartTotal]);

  // Place order to kitchen mutation
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error("Your table cart is empty.");
      }

      const orderNumber = `DINE-T${tableNo}-${Date.now().toString().slice(-4)}`;
      const orderItems = cart.map((i) => ({
        product_id: i.product.id,
        name: `${i.product.name} [${i.spiceLevel.toUpperCase()}]`,
        qty: i.qty,
        unit: i.product.unit || "portion",
        price: Number(i.product.price),
        total_price: Number(i.product.price) * i.qty,
        spice_level: i.spiceLevel,
        cooking_instruction: i.cookingNote || null,
      }));

      const payload = {
        order_number: orderNumber,
        status: "pending",
        fulfillment_type: "dine_in",
        table_number: String(tableNo),
        customer_name: customerName.trim() || `${tableDisplayName} Diner`,
        customer_phone: customerPhone.trim() || null,
        customer_address: `${tableDisplayName} (Dine-In)`,
        total: cartTotal,
        subtotal: cartTotal,
        delivery_fee: 0,
        discount: 0,
        payment_method: "pay_at_counter",
        payment_status: "pending",
        notes: `${tableDisplayName} Dine-In. Prep Notes: ${orderNotes.trim() || "Standard Chef Prep"}`,
        items: orderItems,
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(payload as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      soundEngine.playStatusChime();
      setOrderSuccess(data);
      setCart([]);
      setIsCartOpen(false);
      qc.invalidateQueries({ queryKey: ["table_active_orders", tableNo] });
      toast.success(`Order placed to kitchen for ${tableDisplayName}!`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send order to kitchen");
    },
  });

  // ─── GATE 1: Master QR Switch Offline Check ───
  const isMasterEnabled = settings?.table_ordering_enabled ?? true;
  const offlineMessage =
    settings?.table_ordering_offline_message ||
    "Table ordering is currently offline. Please call our steward or visit the counter.";

  if (settings && isMasterEnabled === false) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-md mx-auto w-full text-center space-y-2 pt-6">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={storeName}
              className="size-16 mx-auto rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div className="size-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Utensils className="size-8" />
            </div>
          )}
          <h1 className="text-xl font-black text-foreground">{storeName}</h1>
          <Badge variant="outline" className="border-border text-xs px-3 py-0.5">
            {tableDisplayName}
          </Badge>
        </header>

        <main className="max-w-md mx-auto w-full text-center space-y-5 my-auto py-8">
          <div className="size-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-foreground">Table Ordering Offline</h2>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              {offlineMessage}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              onClick={() => {
                soundEngine.playStatusChime();
                toast.success(`Steward notified for ${tableDisplayName}!`, {
                  description: "A server has been alerted and will attend your table shortly.",
                });
              }}
              className="w-full h-11 rounded-2xl font-bold text-xs bg-primary text-primary-foreground gap-2 shadow-sm"
            >
              <Users className="size-4" />
              <span>Call Steward to Table 🛎️</span>
            </Button>

            <Link to="/" className="block">
              <Button
                variant="outline"
                className="w-full h-11 rounded-2xl text-xs font-semibold border-border"
              >
                Browse Store Catalog
              </Button>
            </Link>
          </div>
        </main>

        <footer className="max-w-md mx-auto w-full text-center text-xs text-muted-foreground pb-4">
          <p>{storeName} • Contactless Dining Suite</p>
        </footer>
      </div>
    );
  }

  // ─── GATE 2: Table Maintenance / Reserved Status Check ───
  if (matchedTable && (matchedTable.status === "maintenance" || matchedTable.status === "reserved")) {
    const isMaint = matchedTable.status === "maintenance";
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8">
        <header className="max-w-md mx-auto w-full text-center space-y-2 pt-6">
          <h1 className="text-xl font-black text-foreground">{storeName}</h1>
          <Badge variant="outline" className="border-border text-xs px-3 py-0.5">
            {matchedTable.name} • {matchedTable.section}
          </Badge>
        </header>

        <main className="max-w-md mx-auto w-full text-center space-y-5 my-auto py-8">
          <div
            className={`size-20 mx-auto rounded-3xl flex items-center justify-center ${
              isMaint
                ? "bg-muted text-muted-foreground"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isMaint ? <AlertCircle className="size-10" /> : <Clock className="size-10" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-foreground">
              {isMaint ? "Table Under Maintenance" : "Table Reserved"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              {isMaint
                ? "This table is currently undergoing service or cleaning. Please consult our staff to be seated."
                : "This table is currently reserved for a scheduled dining booking. Please consult our host for table allocation."}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              onClick={() => {
                soundEngine.playStatusChime();
                toast.success(`Staff notified for ${matchedTable.name}!`);
              }}
              className="w-full h-11 rounded-2xl font-bold text-xs bg-primary text-primary-foreground gap-2"
            >
              <Users className="size-4" />
              <span>Call Host / Steward 🛎️</span>
            </Button>
            <Link to="/" className="block">
              <Button
                variant="outline"
                className="w-full h-11 rounded-2xl text-xs font-semibold border-border"
              >
                Explore Store Catalog
              </Button>
            </Link>
          </div>
        </main>

        <footer className="max-w-md mx-auto w-full text-center text-xs text-muted-foreground pb-4">
          <p>{storeName} • Contactless Dining Suite</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Table Header Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs shrink-0">
              {matchedTable ? matchedTable.id.slice(0, 4).toUpperCase() : `T${tableNo}`}
            </div>
            <div className="truncate">
              <h1 className="text-base font-bold truncate flex items-center gap-1.5">
                <span>{storeName}</span>
                <span className="text-xs font-normal text-muted-foreground">• {tableDisplayName}</span>
              </h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ChefHat className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>{tableDisplayHeader}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBillOpen(true)}
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Receipt className="size-3.5" />
              <span>Bill &amp; Split</span>
            </Button>

            {cartCount > 0 && (
              <Button
                size="sm"
                onClick={() => setIsCartOpen(true)}
                className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm"
              >
                <ShoppingCart className="size-3.5" />
                <span>{cartCount} ({formatINR(cartTotal)})</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Welcome Table Banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Utensils className="size-3.5" />
              <span>{tableDisplayName} Self-Service Menu</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select dishes, customize spice level &amp; notes, and send tickets directly to the kitchen.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary text-xs py-1 px-2.5">
            Dine-In Active
          </Badge>
        </div>

        {/* Search & Diet Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, starters..."
              className="pl-9 h-9.5 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center rounded-xl border border-border p-0.5 bg-muted/40 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setDietFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                dietFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDietFilter("veg")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                dietFilter === "veg"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-emerald-600"
              }`}
            >
              <span>🟢 Veg</span>
            </button>
            <button
              type="button"
              onClick={() => setDietFilter("non-veg")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                dietFilter === "non-veg"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-rose-600"
              }`}
            >
              <span>🔴 Non-Veg</span>
            </button>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            All Items
          </button>
          {(categories ?? []).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.name)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat.name
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Dish Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredProducts.map((product) => {
            const isItemUnlimited = isGlobalUnlimited || Boolean(product.unlimited_stock);
            const isOutOfStock =
              !isItemUnlimited &&
              !hideOutOfStockBadges &&
              ((product.stock !== null && Number(product.stock) <= 0) || product.is_available === false);

            const cartItemsForProduct = cart.filter((i) => i.product.id === product.id);
            const totalQtyInCart = cartItemsForProduct.reduce((sum, i) => sum + i.qty, 0);

            return (
              <Card
                key={product.id}
                className={`rounded-2xl border-border/70 overflow-hidden shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between ${
                  isOutOfStock ? "opacity-60 bg-muted/20" : ""
                }`}
              >
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm text-foreground">
                          {product.name}
                        </span>
                        {product.category && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border">
                            {product.category}
                          </Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className={`size-16 rounded-xl object-cover shrink-0 border border-border/50 ${
                          isOutOfStock ? "grayscale" : ""
                        }`}
                        loading="lazy"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-extrabold text-sm text-primary">
                      {formatINR(Number(product.price))}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {" "}
                        / {product.unit || "portion"}
                      </span>
                    </span>

                    {isOutOfStock ? (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-muted-foreground/30 text-muted-foreground">
                        Sold Out
                      </Badge>
                    ) : totalQtyInCart === 0 ? (
                      <Button
                        size="sm"
                        onClick={() => addToCart(product, "medium")}
                        className="h-8 rounded-xl text-xs font-semibold px-3 gap-1 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <Plus className="size-3.5" />
                        <span>Add</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-muted/60 rounded-xl p-0.5 border border-border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg text-destructive"
                          onClick={() => updateCartQty(product.id, "medium", -1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="text-xs font-bold px-1.5">{totalQtyInCart}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg text-primary"
                          onClick={() => updateCartQty(product.id, "medium", 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Spice Customizer */}
                {totalQtyInCart > 0 && (
                  <div className="bg-muted/30 border-t border-border/50 px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Flame className="size-3 text-amber-500" />
                      Spice:
                    </span>
                    <div className="flex items-center gap-1">
                      {(["mild", "medium", "spicy"] as SpiceLevel[]).map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => {
                            setCart((prev) =>
                              prev.map((i) =>
                                i.product.id === product.id ? { ...i, spiceLevel: sp } : i
                              )
                            );
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors capitalize ${
                            cartItemsForProduct.some((i) => i.spiceLevel === sp)
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-muted/20 border border-dashed border-border rounded-2xl space-y-2">
            <Utensils className="size-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-semibold">No dishes match your filter</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveCategory("all");
                setDietFilter("all");
                setSearchQuery("");
              }}
              className="rounded-xl text-xs"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </main>

      {/* ─── FEATURE 2: Floating Bottom Cart Review Bar with 1-Tap Clear ─── */}
      {cartCount > 0 && (
        <aside
          aria-label="Table order review bar"
          className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3 shadow-lg"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                {tableDisplayName} Cart: {cartCount} items
              </p>
              <p className="text-base font-extrabold text-primary">{formatINR(cartTotal)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCart}
                className="rounded-xl text-xs h-9 text-muted-foreground hover:text-destructive gap-1 px-2.5"
                title="Clear table cart"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCartOpen(true)}
                className="rounded-xl text-xs h-9"
              >
                Review Items
              </Button>

              <Button
                size="sm"
                onClick={() => placeOrderMutation.mutate()}
                disabled={placeOrderMutation.isPending}
                className="rounded-xl text-xs h-9 font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm px-4"
              >
                <ChefHat className="size-4" />
                <span>{placeOrderMutation.isPending ? "Sending..." : "Send to Kitchen 👨‍🍳"}</span>
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* ─── FEATURE 2: Cart Review Modal with 1-Tap Clear Cart ─── */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ChefHat className="size-5 text-primary" />
                <span>Review Order — {tableDisplayName}</span>
              </span>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCart}
                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2 gap-1 rounded-lg"
                >
                  <Trash2 className="size-3" />
                  <span>Clear All</span>
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2 divide-y divide-border/60">
              {cart.map((item, idx) => (
                <div key={`${item.product.id}-${item.spiceLevel}-${idx}`} className="pt-2.5 first:pt-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-foreground truncate">{item.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatINR(Number(item.product.price))} × {item.qty} ={" "}
                        <span className="font-semibold text-foreground">
                          {formatINR(Number(item.product.price) * item.qty)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-muted/60 rounded-xl p-0.5 border border-border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive"
                        onClick={() => updateCartQty(item.product.id, item.spiceLevel, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="text-xs font-bold px-1">{item.qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-primary"
                        onClick={() => updateCartQty(item.product.id, item.spiceLevel, 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Spice and Cooking Note input */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <select
                        value={item.spiceLevel}
                        onChange={(e) => {
                          const val = e.target.value as SpiceLevel;
                          setCart((prev) =>
                            prev.map((i, iIdx) => (iIdx === idx ? { ...i, spiceLevel: val } : i))
                          );
                        }}
                        className="h-7 w-full rounded-lg border border-input bg-background px-2 text-[11px]"
                      >
                        <option value="mild">Mild 🌿</option>
                        <option value="medium">Medium 🌶️</option>
                        <option value="spicy">Spicy 🔥</option>
                        <option value="extra_hot">Extra Hot 💥</option>
                      </select>
                    </div>

                    <div>
                      <Input
                        value={item.cookingNote}
                        onChange={(e) => updateCartNote(item.product.id, item.spiceLevel, e.target.value)}
                        placeholder="e.g. Less oil, no onion"
                        className="h-7 text-[11px] rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* General Kitchen Prep Instructions */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <label htmlFor="table-order-notes-input" className="text-xs font-semibold text-foreground">Special Instructions for Chef</label>
              <Input
                id="table-order-notes-input"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Please bring water glasses, serve starters first"
                className="h-8 text-xs rounded-xl"
              />
            </div>

            {/* Optional Diner Contact */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="table-diner-name-input" className="text-[11px] text-muted-foreground block mb-0.5">Your Name (Optional)</label>
                <Input
                  id="table-diner-name-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Diner Name"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="table-diner-phone-input" className="text-[11px] text-muted-foreground block mb-0.5">Mobile Number (Optional)</label>
                <Input
                  id="table-diner-phone-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="For digital bill"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Order Total</p>
              <p className="text-base font-black text-primary">{formatINR(cartTotal)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCart}
                className="rounded-xl h-10 px-3 font-semibold text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
              >
                <Trash2 className="size-4" />
                <span>Clear Cart</span>
              </Button>
              <Button
                onClick={() => placeOrderMutation.mutate()}
                disabled={placeOrderMutation.isPending}
                className="rounded-xl h-10 px-4 font-bold text-xs bg-primary text-primary-foreground gap-1.5"
              >
                <ChefHat className="size-4" />
                <span>{placeOrderMutation.isPending ? "Sending..." : "Confirm & Send"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill & Split Bill Engine Modal */}
      <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              <span>{tableDisplayName} — Bill &amp; Split</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Active Table Running Bill Summary */}
            <div className="rounded-xl bg-muted/40 p-3.5 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Table Status:</span>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Dine-In Active
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total Running Amount:</span>
                <span className="text-primary text-base font-extrabold">
                  {formatINR(runningTableBillTotal)}
                </span>
              </div>
              {(tableOrders ?? []).length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Includes {(tableOrders ?? []).length} active kitchen ticket(s) currently being served.
                </p>
              )}
            </div>

            {/* Split Mode Selector */}
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Split Bill Between Diners
                </span>
                <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      splitMode === "equal" ? "bg-background font-bold shadow-xs text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("custom")}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      splitMode === "custom" ? "bg-background font-bold shadow-xs text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Custom Share
                  </button>
                </div>
              </div>

              {splitMode === "equal" ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between bg-muted/20 p-2.5 rounded-xl border border-border">
                    <span className="text-muted-foreground">Number of Diners:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 rounded-lg"
                        onClick={() => setSplitDiners((d) => Math.max(2, d - 1))}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="font-bold text-sm min-w-[2ch] text-center">{splitDiners}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 rounded-lg"
                        onClick={() => setSplitDiners((d) => Math.min(20, d + 1))}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground">Each person pays:</p>
                    <p className="text-xl font-black text-primary">
                      {formatINR(Math.ceil(runningTableBillTotal / splitDiners))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      (Total {formatINR(runningTableBillTotal)} ÷ {splitDiners} diners)
                    </p>
                  </div>

                  {/* Individual Split QR Generator */}
                  {storeUpiId && (
                    <div className="space-y-2 pt-1">
                      <p className="font-semibold text-foreground text-center">
                        Instant UPI Payment for Each Diner
                      </p>
                      <div className="max-w-[220px] mx-auto">
                        <UpiPaymentQr
                          upiId={storeUpiId}
                          storeName={storeName}
                          amount={Math.ceil(runningTableBillTotal / splitDiners)}
                          orderReference={`T${tableNo}-S${splitDiners}`}
                          storeLogo={settings?.logo_url}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label htmlFor="custom-table-share-input" className="text-muted-foreground">Enter your share amount (₹):</label>
                    <Input
                      id="custom-table-share-input"
                      type="number"
                      value={customShare}
                      onChange={(e) => setCustomShare(e.target.value)}
                      placeholder="e.g. 250"
                      className="text-xs h-9 rounded-xl font-bold"
                    />
                  </div>

                  {Number(customShare) > 0 && storeUpiId && (
                    <div className="max-w-[220px] mx-auto pt-1">
                      <UpiPaymentQr
                        upiId={storeUpiId}
                        storeName={storeName}
                        amount={Number(customShare)}
                        orderReference={`T${tableNo}-Custom`}
                        storeLogo={settings?.logo_url}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Offline Steward Request Call */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  soundEngine.playStatusChime();
                  toast.success(`Steward notified to attend ${tableDisplayName}!`, {
                    description: "Our staff is on the way to your table for cash / card settlement.",
                  });
                }}
                className="w-full rounded-xl text-xs h-9 border-border"
              >
                Call Steward to Table 🛎️
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
