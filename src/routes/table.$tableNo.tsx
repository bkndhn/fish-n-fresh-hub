import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
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
  Bell,
  BellRing,
  Droplet,
  Coffee,
  X,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { productsQuery, categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatINR, formatIST } from "@/lib/format";
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

export interface TableServiceRequest {
  id: string;
  table_number: string;
  session_id: string | null;
  request_type: "waiter_call" | "bill_request" | "water" | "cutlery" | "cleaning" | "custom" | string;
  details: string | null;
  status: "pending" | "acknowledged" | "resolved" | "cancelled" | string;
  created_at: string;
  updated_at: string;
}

function TableOrderingPage() {
  const { tableNo } = Route.useParams();
  const qc = useQueryClient();

  // Multi-round session token: dine_in_session_T{tableNo}
  const sessionKey = `dine_in_session_T${tableNo}`;
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return `sess_ssr_${tableNo}`;
    try {
      const existing = window.sessionStorage.getItem(sessionKey);
      if (existing && existing.trim()) return existing;
      const newId = `sess_${tableNo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      window.sessionStorage.setItem(sessionKey, newId);
      return newId;
    } catch {
      return `sess_${tableNo}_${Date.now()}`;
    }
  });

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

  // Custom request dialog state
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [customRequestText, setCustomRequestText] = useState("");

  // Expandable round state for live stepper
  const [expandedRoundIds, setExpandedRoundIds] = useState<Record<string, boolean>>({});

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

  // ─── 1. QUERY & REALTIME: Active Orders for this Table ───
  const { data: tableOrders = [], refetch: refetchTableOrders } = useQuery<any[]>({
    queryKey: ["table_active_orders", tableNo],
    queryFn: async () => {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("get_table_active_orders", {
          p_table: String(tableNo),
        });
        if (!rpcErr && Array.isArray(rpcData)) {
          return rpcData;
        }
      } catch {
        // RPC fallback to direct query
      }

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
    refetchInterval: 8000,
  });

  // Realtime subscription on orders for celebratory chimes and live status changes
  useEffect(() => {
    const channel = supabase
      .channel(`table_orders_stream_${tableNo}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `table_number=eq.${tableNo}`,
        },
        (payload) => {
          refetchTableOrders();
          if (payload.eventType === "UPDATE") {
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            const roundNum = (payload.new as any)?.round_number || 1;
            if (newStatus !== oldStatus) {
              soundEngine.playStatusChime();
              if (newStatus === "preparing") {
                toast.info(`👨‍🍳 Chef started preparing Round #${roundNum}!`, {
                  description: "Your food is fresh in the pan.",
                });
              } else if (newStatus === "ready") {
                toast.success(`🔔 Round #${roundNum} is ready!`, {
                  description: "Our server is bringing hot dishes to your table.",
                  duration: 6000,
                });
              } else if (newStatus === "delivered" || newStatus === "completed") {
                toast.success(`🍽️ Round #${roundNum} served. Enjoy your meal!`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableNo, refetchTableOrders]);

  // ─── 2. QUERY & REALTIME: Active Service Requests for this Table ───
  const { data: serviceRequests = [], refetch: refetchServiceRequests } = useQuery<TableServiceRequest[]>({
    queryKey: ["table_service_requests", tableNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_service_requests")
        .select("*")
        .eq("table_number", String(tableNo))
        .in("status", ["pending", "acknowledged"])
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed fetching table service requests:", error);
        return [];
      }
      return (data as TableServiceRequest[]) || [];
    },
    refetchInterval: 6000,
  });

  // Realtime subscription on table_service_requests
  useEffect(() => {
    const channel = supabase
      .channel(`table_service_stream_${tableNo}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_service_requests",
          filter: `table_number=eq.${tableNo}`,
        },
        (payload) => {
          refetchServiceRequests();
          if (payload.eventType === "UPDATE") {
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            if (newStatus !== oldStatus) {
              soundEngine.playStatusChime();
              if (newStatus === "acknowledged") {
                toast.info("🏃 Staff on the way!", {
                  description: "A steward has acknowledged your request and is coming to your table.",
                });
              } else if (newStatus === "resolved") {
                toast.success("✅ Service request attended by staff.");
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableNo, refetchServiceRequests]);

  // ─── 3. MUTATIONS: Service Requests (Call Waiter, Request Bill, Water, Cutlery, Cleaning) ───
  const createServiceRequestMutation = useMutation({
    mutationFn: async ({
      type,
      details,
    }: {
      type: "waiter_call" | "bill_request" | "water" | "cutlery" | "cleaning" | "custom";
      details?: string;
    }) => {
      const { data, error } = await supabase
        .from("table_service_requests")
        .insert({
          table_number: String(tableNo),
          session_id: sessionId,
          request_type: type,
          details: details || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      soundEngine.playStatusChime();
      refetchServiceRequests();
      const labels: Record<string, string> = {
        waiter_call: "Waiter / Steward Called 🛎️",
        bill_request: "Bill Requested 🧾",
        water: "Drinking Water Requested 💧",
        cutlery: "Cutlery & Plates Requested 🍴",
        cleaning: "Table Cleaning Requested 🧹",
        custom: "Special Request Sent 💬",
      };
      toast.success(labels[vars.type] || "Service request sent!", {
        description: "Floor staff has been alerted in real time.",
      });
      if (vars.type === "bill_request") {
        setIsBillOpen(true);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to alert staff");
    },
  });

  const cancelServiceRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("table_service_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      refetchServiceRequests();
      toast.info("Service request cancelled.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel request");
    },
  });

  // ─── 4. MULTI-ROUND CALCULATION ───
  const activeOrdersList = useMemo(() => {
    return (tableOrders ?? []) as any[];
  }, [tableOrders]);

  const maxRound = useMemo(() => {
    if (activeOrdersList.length === 0) return 0;
    const rounds = activeOrdersList.map((o) => Number(o.round_number || 1));
    return Math.max(0, ...rounds);
  }, [activeOrdersList]);

  const nextRoundNumber = maxRound + 1;

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
    toast.success(`Added ${product.name} to Round #${nextRoundNumber}`);
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
    toast.success(`Round #${nextRoundNumber} cart cleared`);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Calculate live running table bill consolidating all active rounds
  const runningTableBillTotal = useMemo(() => {
    const ordersTotal = activeOrdersList.reduce(
      (sum, ord) => sum + Number(ord.total || 0),
      0
    );
    return ordersTotal > 0 ? ordersTotal : cartTotal;
  }, [activeOrdersList, cartTotal]);

  // ─── 5. PLACE ORDER MUTATION (With Multi-Round RPC & Fallback) ───
  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error("Your table cart is empty.");
      }

      const orderNumber = `DINE-T${tableNo}-R${nextRoundNumber}-${Date.now().toString().slice(-4)}`;
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

      // Try RPC first for transaction integrity and security definer
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("place_dine_in_order", {
          p_table: String(tableNo),
          p_items: orderItems,
          p_total: cartTotal,
          p_customer_name: customerName.trim() || `${tableDisplayName} Diner`,
          p_customer_phone: customerPhone.trim() || "9999999999",
          p_notes: `${tableDisplayName} Dine-In Round ${nextRoundNumber}. Prep Notes: ${orderNotes.trim() || "Standard Chef Prep"}`,
          p_round: nextRoundNumber,
          p_session_id: sessionId,
        });

        if (!rpcErr && rpcRes && (rpcRes as any).success) {
          return rpcRes;
        }
      } catch (e) {
        console.warn("place_dine_in_order RPC fallback to direct insert:", e);
      }

      // Direct insert fallback
      const payload = {
        order_number: orderNumber,
        status: "pending",
        fulfillment_type: "dine_in",
        table_number: String(tableNo),
        customer_name: customerName.trim() || `${tableDisplayName} Diner`,
        customer_phone: customerPhone.trim() || "9999999999",
        customer_address: `${tableDisplayName} (Dine-In)`,
        total: cartTotal,
        subtotal: cartTotal,
        delivery_fee: 0,
        discount: 0,
        payment_method: "pay_at_counter",
        payment_status: "pending",
        notes: `${tableDisplayName} Dine-In Round ${nextRoundNumber}. Prep Notes: ${orderNotes.trim() || "Standard Chef Prep"}`,
        items: orderItems,
        round_number: nextRoundNumber,
        session_id: sessionId,
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
      toast.success(`Round #${nextRoundNumber} sent to kitchen for ${tableDisplayName}!`, {
        description: "Chef ticket is printing. Track preparation live below.",
      });
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
                createServiceRequestMutation.mutate({ type: "waiter_call" });
              }}
              disabled={createServiceRequestMutation.isPending}
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
                createServiceRequestMutation.mutate({ type: "waiter_call" });
              }}
              disabled={createServiceRequestMutation.isPending}
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

  // Helper for Stepper Milestone Calculation
  const getOrderStep = (status: string) => {
    switch (status) {
      case "pending":
      case "confirmed":
        return 1;
      case "preparing":
        return 2;
      case "ready":
      case "packed":
        return 3;
      case "delivered":
      case "completed":
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* ─── STICKY TABLE HEADER ─── */}
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

      {/* ─── FEATURE 1: FLOATING QUICK SERVICE BAR (Instant Table Assistance) ─── */}
      <div className="bg-muted/40 border-b border-border/80 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              disabled={createServiceRequestMutation.isPending}
              onClick={() => createServiceRequestMutation.mutate({ type: "waiter_call" })}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
            >
              <Bell className="size-3.5" />
              <span>Call Waiter 🛎️</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={createServiceRequestMutation.isPending}
              onClick={() => createServiceRequestMutation.mutate({ type: "bill_request" })}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <Receipt className="size-3.5" />
              <span>Request Bill 🧾</span>
            </Button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <button
              type="button"
              disabled={createServiceRequestMutation.isPending}
              onClick={() => createServiceRequestMutation.mutate({ type: "water" })}
              className="h-8 px-2.5 rounded-xl border border-border bg-background hover:bg-muted font-medium flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground text-[11px]"
            >
              <Droplet className="size-3 text-blue-500" />
              <span>Water</span>
            </button>

            <button
              type="button"
              disabled={createServiceRequestMutation.isPending}
              onClick={() => createServiceRequestMutation.mutate({ type: "cutlery" })}
              className="h-8 px-2.5 rounded-xl border border-border bg-background hover:bg-muted font-medium flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground text-[11px]"
            >
              <Utensils className="size-3 text-purple-500" />
              <span>Cutlery</span>
            </button>

            <button
              type="button"
              disabled={createServiceRequestMutation.isPending}
              onClick={() => createServiceRequestMutation.mutate({ type: "cleaning" })}
              className="h-8 px-2.5 rounded-xl border border-border bg-background hover:bg-muted font-medium flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground text-[11px]"
            >
              <Sparkles className="size-3 text-rose-500" />
              <span>Clean Table</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomRequestOpen(true)}
              className="h-8 px-2.5 rounded-xl border border-border bg-background hover:bg-muted font-medium flex items-center gap-1 transition-colors text-muted-foreground hover:text-foreground text-[11px]"
            >
              <MessageSquare className="size-3 text-indigo-500" />
              <span>Custom Note</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* ─── ACTIVE SERVICE REQUEST TRACKER PILL ─── */}
        {serviceRequests.length > 0 && (
          <div className="space-y-2">
            {serviceRequests.map((req) => {
              const isAcknowledged = req.status === "acknowledged";
              return (
                <div
                  key={req.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                    isAcknowledged
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 animate-pulse"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-2 rounded-full bg-current shrink-0 animate-ping" />
                    <div className="truncate">
                      <p className="font-bold truncate">
                        {isAcknowledged ? "🏃 Staff on the way to table!" : "⏳ Request sent to staff..."}
                      </p>
                      <p className="text-[11px] opacity-80 truncate">
                        {req.request_type === "waiter_call" && "Steward assistance requested"}
                        {req.request_type === "bill_request" && "Bill printed & cashier alerted"}
                        {req.request_type === "water" && "Fresh drinking water on the way"}
                        {req.request_type === "cutlery" && "Extra cutlery & plates requested"}
                        {req.request_type === "cleaning" && "Housekeeping notified to clean table"}
                        {req.request_type === "custom" && `Note: ${req.details}`}
                        {" • "}{formatIST(req.created_at)}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelServiceRequestMutation.isPending}
                    onClick={() => cancelServiceRequestMutation.mutate(req.id)}
                    className="h-7 text-[10px] text-muted-foreground hover:text-destructive px-2 shrink-0"
                  >
                    Cancel
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FEATURE 3: LIVE ORDER PIPELINE FOR DINERS (Multi-Round Stepper) ─── */}
        {activeOrdersList.length > 0 && (
          <Card className="rounded-2xl border-primary/20 bg-card overflow-hidden shadow-xs">
            <CardHeader className="p-3.5 pb-2 border-b border-border/60 bg-primary/5 flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-primary">
                  <ChefHat className="size-4" />
                  <span>Kitchen Tickets &amp; Live Order Pipeline</span>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  {activeOrdersList.length} Round{activeOrdersList.length > 1 ? "s" : ""} placed for {tableDisplayName}. Real-time kitchen progress:
                </p>
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-bold">
                {activeOrdersList.length} Active Ticket{activeOrdersList.length > 1 ? "s" : ""}
              </Badge>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3.5 divide-y divide-border/60">
              {activeOrdersList.map((order, idx) => {
                const step = getOrderStep(order.status);
                const roundNum = order.round_number || idx + 1;
                const items = (order.items as any[]) || [];
                const isExpanded = expandedRoundIds[order.id] ?? true;

                return (
                  <div key={order.id} className="pt-3 first:pt-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary text-primary-foreground font-black text-xs px-2 py-0.5">
                          Round #{roundNum}
                        </Badge>
                        <span className="text-xs font-bold text-foreground">
                          {formatINR(Number(order.total || 0))}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({items.length} item{items.length !== 1 ? "s" : ""})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRoundIds((prev) => ({
                            ...prev,
                            [order.id]: !isExpanded,
                          }))
                        }
                        className="text-[11px] text-primary font-semibold flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? "Hide items" : "Show items"}</span>
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>
                    </div>

                    {/* Stepper with 4 milestones */}
                    <div className="space-y-1.5 pt-1">
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className={`space-y-1 ${step >= 1 ? "text-primary font-bold" : "text-muted-foreground opacity-60"}`}>
                          <div className={`size-6 mx-auto rounded-full flex items-center justify-center text-[10px] border transition-all ${
                            step >= 1 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
                          }`}>
                            1
                          </div>
                          <p className="text-[10px] leading-tight">Confirmed ⏱️</p>
                        </div>

                        <div className={`space-y-1 ${step >= 2 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground opacity-60"}`}>
                          <div className={`size-6 mx-auto rounded-full flex items-center justify-center text-[10px] border transition-all ${
                            step >= 2 ? "bg-amber-500 text-white border-amber-500 animate-pulse" : "bg-muted border-border"
                          }`}>
                            2
                          </div>
                          <p className="text-[10px] leading-tight">Cooking 👨‍🍳</p>
                        </div>

                        <div className={`space-y-1 ${step >= 3 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground opacity-60"}`}>
                          <div className={`size-6 mx-auto rounded-full flex items-center justify-center text-[10px] border transition-all ${
                            step >= 3 ? "bg-emerald-500 text-white border-emerald-500 animate-bounce" : "bg-muted border-border"
                          }`}>
                            3
                          </div>
                          <p className="text-[10px] leading-tight">Ready 🔔</p>
                        </div>

                        <div className={`space-y-1 ${step >= 4 ? "text-primary font-bold" : "text-muted-foreground opacity-60"}`}>
                          <div className={`size-6 mx-auto rounded-full flex items-center justify-center text-[10px] border transition-all ${
                            step >= 4 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border"
                          }`}>
                            4
                          </div>
                          <p className="text-[10px] leading-tight">Served ✅</p>
                        </div>
                      </div>

                      {/* Progress Bar Track */}
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{
                            width: step === 1 ? "25%" : step === 2 ? "50%" : step === 3 ? "75%" : "100%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Expandable item details */}
                    {isExpanded && items.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-[11px] space-y-1">
                        {items.map((it: any, iIdx: number) => (
                          <div key={iIdx} className="flex items-center justify-between text-muted-foreground">
                            <span>
                              {it.qty}x {it.name}
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatINR(Number(it.total_price || (it.price * it.qty) || 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Welcome Table Banner & Multi-Round Notice */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Utensils className="size-3.5" />
              <span>
                {tableDisplayName} — {maxRound > 0 ? `Order Round #${nextRoundNumber}` : "Self-Service Menu"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {maxRound > 0
                ? `You have ${maxRound} round(s) active. You can keep adding starters, mains or drinks anytime!`
                : "Select dishes, customize spice levels & instructions, and place orders directly to the chef."}
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary text-xs py-1 px-2.5">
            Round #{nextRoundNumber} Active
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

      {/* ─── FEATURE 4: FLOATING BOTTOM CART REVIEW & MULTI-ROUND CTA BAR ─── */}
      {cartCount > 0 && (
        <aside
          aria-label="Table order review bar"
          className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3 shadow-lg"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Round #{nextRoundNumber}: {cartCount} items
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
                <span>
                  {placeOrderMutation.isPending
                    ? "Sending..."
                    : `Send Round #${nextRoundNumber} 👨‍🍳`}
                </span>
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* ─── CART REVIEW MODAL WITH MULTI-ROUND TICKETING ─── */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ChefHat className="size-5 text-primary" />
                <span>Review Round #{nextRoundNumber} — {tableDisplayName}</span>
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
              <label htmlFor="table-order-notes-input" className="text-xs font-semibold text-foreground">
                Special Instructions for Round #{nextRoundNumber}
              </label>
              <Input
                id="table-order-notes-input"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Serve piping hot, bring finger bowls"
                className="h-8 text-xs rounded-xl"
              />
            </div>

            {/* Optional Diner Contact */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="table-diner-name-input" className="text-[11px] text-muted-foreground block mb-0.5">
                  Your Name (Optional)
                </label>
                <Input
                  id="table-diner-name-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Diner Name"
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div>
                <label htmlFor="table-diner-phone-input" className="text-[11px] text-muted-foreground block mb-0.5">
                  Mobile Number (Optional)
                </label>
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
              <p className="text-xs text-muted-foreground">Round #{nextRoundNumber} Total</p>
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
                <span>Clear</span>
              </Button>
              <Button
                onClick={() => placeOrderMutation.mutate()}
                disabled={placeOrderMutation.isPending}
                className="rounded-xl h-10 px-4 font-bold text-xs bg-primary text-primary-foreground gap-1.5"
              >
                <ChefHat className="size-4" />
                <span>
                  {placeOrderMutation.isPending
                    ? "Sending..."
                    : `Confirm Round #${nextRoundNumber}`}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CUSTOM SERVICE REQUEST MODAL ─── */}
      <Dialog open={customRequestOpen} onOpenChange={setCustomRequestOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <span>Custom Table Request</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-muted-foreground">
              Need extra ice, baby high chair, toothpicks, or lime? Tell the floor staff directly:
            </p>
            <Input
              value={customRequestText}
              onChange={(e) => setCustomRequestText(e.target.value)}
              placeholder="e.g. Please bring extra green chillies & lime"
              className="text-xs rounded-xl h-10"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCustomRequestOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createServiceRequestMutation.isPending || !customRequestText.trim()}
              onClick={() => {
                createServiceRequestMutation.mutate({
                  type: "custom",
                  details: customRequestText.trim(),
                });
                setCustomRequestText("");
                setCustomRequestOpen(false);
              }}
              className="rounded-xl text-xs h-9 font-bold bg-primary text-primary-foreground gap-1.5"
            >
              <Send className="size-3.5" />
              <span>Send to Staff</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── FEATURE 5: COMBINED RUNNING BILL & SPLIT BILL ENGINE MODAL ─── */}
      <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                <span>{tableDisplayName} — Combined Master Bill</span>
              </span>
              <Badge variant="outline" className="border-primary/30 text-primary text-xs font-bold">
                {activeOrdersList.length} Round{activeOrdersList.length !== 1 ? "s" : ""}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Active Table Running Bill Summary */}
            <div className="rounded-xl bg-muted/40 p-3.5 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Session Status:</span>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  Dine-In Active 🟢
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Total Running Amount:</span>
                <span className="text-primary text-base font-extrabold">
                  {formatINR(runningTableBillTotal)}
                </span>
              </div>
              {activeOrdersList.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Consolidates all {activeOrdersList.length} dining round(s) placed at this table.
                </p>
              )}
            </div>

            {/* Itemized Rounds Breakdown */}
            {activeOrdersList.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-border">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Utensils className="size-3.5 text-primary" />
                  Itemized Order Rounds
                </span>

                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {activeOrdersList.map((order, idx) => {
                    const items = (order.items as any[]) || [];
                    const roundNum = order.round_number || idx + 1;
                    return (
                      <div
                        key={order.id}
                        className="p-2.5 rounded-xl border border-border/70 bg-card space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-primary" />
                            Round #{roundNum}
                          </span>
                          <span className="text-primary">{formatINR(Number(order.total || 0))}</span>
                        </div>
                        <div className="space-y-1 divide-y divide-border/40 text-[11px]">
                          {items.map((it: any, iIdx: number) => (
                            <div key={iIdx} className="pt-1 first:pt-0 flex items-center justify-between text-muted-foreground">
                              <span>
                                {it.qty}x {it.name}
                              </span>
                              <span>{formatINR(Number(it.total_price || (it.price * it.qty) || 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                    <label htmlFor="custom-table-share-input" className="text-muted-foreground">
                      Enter your share amount (₹):
                    </label>
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

            {/* Offline Steward Request Call & Full Bill Request */}
            <div className="pt-2 border-t border-border space-y-2">
              <Button
                variant="default"
                size="sm"
                disabled={createServiceRequestMutation.isPending}
                onClick={() => {
                  createServiceRequestMutation.mutate({ type: "bill_request" });
                  toast.success(`Bill request sent for ${tableDisplayName}!`, {
                    description: "Our cashier is printing your final bill and steward is on the way.",
                  });
                }}
                className="w-full rounded-xl text-xs h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <DollarSign className="size-4" />
                <span>Request Printed Bill &amp; Card Machine 🧾</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={createServiceRequestMutation.isPending}
                onClick={() => {
                  createServiceRequestMutation.mutate({ type: "waiter_call" });
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
