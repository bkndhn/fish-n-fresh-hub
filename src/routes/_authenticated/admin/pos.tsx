import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
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
  Wifi,
  WifiOff,
  History,
  Bookmark,
  Share2,
  Sliders,
  Layers,
  Keyboard,
  FileText,
  ArrowUpDown,
  Camera,
  ScanLine,
  Zap,
  Activity,
  Terminal,
  Settings2,
} from "lucide-react";
import { hardwareScanner, type ParsedBarcode } from "@/lib/barcodeScanner";
import { BarcodeCameraModal } from "@/components/BarcodeCameraModal";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { categoriesQuery, settingsQuery } from "@/lib/queries";
import { formatINR, formatStockDisplay, formatStockUnitLabel, formatStockBadge, formatInvoiceDateTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { deductOrderStock } from "@/lib/inventorySync";
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
import { PosPastBillsModal } from "@/components/admin/PosPastBillsModal";
import {
  getSavedPrinterConfig,
  sendEscPosToPrinter,
  buildPosReceiptEscPos,
  buildPosReceiptHtml,
  generatePosWhatsAppText,
  getPosWhatsAppShareUrl,
  type PosReceiptData,
  type PosReceiptItem,
} from "@/lib/thermalPrinter";
import {
  weighingScaleDriver,
  playScaleCaptureChime,
  type ScaleReading,
  type ScaleConnectionState,
  type ScaleProtocol,
  type ScaleSerialConfig,
} from "@/lib/weighingScale";

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
  serialNumbers?: string[] | undefined;
  variant?: { id?: string; size?: string; color?: string; sku?: string } | undefined;
  brand?: string | undefined;
  warrantyMonths?: number;
  aisleLocation?: string;
}

interface ParkedCart {
  id: string;
  timestamp: string;
  label: string;
  cart: PosCartItem[];
  customerName: string;
  customerPhone: string;
  discountAmount: number;
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

export interface QuickChipItem {
  label: string;
  val: number;
}

const DEFAULT_QUICK_CHIPS: QuickChipItem[] = [
  { label: "100g", val: 0.1 },
  { label: "250g", val: 0.25 },
  { label: "350g", val: 0.35 },
  { label: "500g", val: 0.5 },
  { label: "750g", val: 0.75 },
  { label: "1 kg", val: 1.0 },
  { label: "1.5 kg", val: 1.5 },
  { label: "2 kg", val: 2.0 },
  { label: "3 kg", val: 3.0 },
  { label: "5 kg", val: 5.0 },
];

function getStoredQuickChips(productId?: string): QuickChipItem[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_CHIPS;
  try {
    if (productId) {
      const prodStored = localStorage.getItem(`fnf_pos_chips_${productId}`);
      if (prodStored) return JSON.parse(prodStored);
    }
    const globalStored = localStorage.getItem("fnf_pos_global_chips");
    if (globalStored) return JSON.parse(globalStored);
  } catch {
    /* fallback */
  }
  return DEFAULT_QUICK_CHIPS;
}

function getNextPosReceiptNo(prefix = "POS-", dailyReset = true): string {
  try {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const stored = localStorage.getItem("fnf_pos_seq");
    let seq = 1;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (dailyReset) {
        if (parsed.date === todayStr) {
          seq = (parsed.lastSeq || 0) + 1;
        } else {
          seq = 1;
        }
      } else {
        seq = (parsed.lastSeq || 0) + 1;
      }
    }
    localStorage.setItem("fnf_pos_seq", JSON.stringify({ date: todayStr, lastSeq: seq }));
    const padded = String(seq).padStart(3, "0");
    return dailyReset ? `${prefix}${todayStr}-${padded}` : `${prefix}${seq}`;
  } catch {
    return `${prefix}${Date.now().toString().slice(-6)}`;
  }
}

export function RetailPosCounterPage() {
  const qc = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCodeInputRef = useRef<HTMLInputElement>(null);
  const [quickCodeInput, setQuickCodeInput] = useState("");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
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

  // Item customizer modal (Decimal scale input fix)
  const [activeItemModal, setActiveItemModal] = useState<Product | null>(null);
  const [modalWeightInput, setModalWeightInput] = useState<string>("1.0");
  const [modalCutting, setModalCutting] = useState<string>("Curry Cut");
  const [modalSerialInput, setModalSerialInput] = useState<string>("");
  const [modalSelectedVariant, setModalSelectedVariant] = useState<any | null>(null);

  // Custom Quick Chips state
  const [activeChips, setActiveChips] = useState<QuickChipItem[]>(DEFAULT_QUICK_CHIPS);
  const [showChipEditor, setShowChipEditor] = useState(false);
  const [chipInputVal, setChipInputVal] = useState("");
  const [chipInputLabel, setChipInputLabel] = useState("");
  const [chipScope, setChipScope] = useState<"product" | "global">("global");

  // Dedicated Universal Quick Chips Manager Modal state
  const [globalChipModalOpen, setGlobalChipModalOpen] = useState(false);
  const [globalChips, setGlobalChips] = useState<QuickChipItem[]>(() => getStoredQuickChips());
  const [newGlobalVal, setNewGlobalVal] = useState("");
  const [newGlobalLabel, setNewGlobalLabel] = useState("");

  const refreshGlobalChips = () => {
    setGlobalChips(getStoredQuickChips());
  };

  const handleAddGlobalChip = () => {
    const val = parseFloat(newGlobalVal);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight number (e.g. 0.4 or 1.25)");
      return;
    }
    const label = newGlobalLabel.trim() || (val < 1 ? `${Math.round(val * 1000)}g` : `${val} kg`);
    const updated = [...globalChips.filter((c) => c.val !== val), { label, val }].sort((a, b) => a.val - b.val);
    setGlobalChips(updated);
    localStorage.setItem("fnf_pos_global_chips", JSON.stringify(updated));
    setNewGlobalVal("");
    setNewGlobalLabel("");
    toast.success(`Universal portion chip added: ${label}`);
    if (activeItemModal && chipScope === "global") {
      setActiveChips(updated);
    }
  };

  const handleDeleteGlobalChip = (valToDelete: number) => {
    const updated = globalChips.filter((c) => c.val !== valToDelete);
    setGlobalChips(updated);
    localStorage.setItem("fnf_pos_global_chips", JSON.stringify(updated));
    toast.success("Universal portion chip removed");
    if (activeItemModal && chipScope === "global") {
      setActiveChips(updated);
    }
  };

  const handleResetUniversalChips = () => {
    setGlobalChips(DEFAULT_QUICK_CHIPS);
    localStorage.setItem("fnf_pos_global_chips", JSON.stringify(DEFAULT_QUICK_CHIPS));
    toast.success("Universal chips reset to standard presets");
    if (activeItemModal && chipScope === "global") {
      setActiveChips(DEFAULT_QUICK_CHIPS);
    }
  };

  const handleClearAllCustomOverrides = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("fnf_pos_chips_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      toast.success(`Cleared ${keysToRemove.length} custom product overrides. Universal chips are now active for all items.`);
      if (activeItemModal) {
        setActiveChips(getStoredQuickChips());
      }
    } catch {
      toast.error("Failed to clear overrides");
    }
  };

  useEffect(() => {
    if (activeItemModal) {
      setActiveChips(getStoredQuickChips(activeItemModal.id));
      setShowChipEditor(false);
      setChipInputVal("");
      setChipInputLabel("");
    }
  }, [activeItemModal]);

  const handleAddCustomChip = () => {
    const val = parseFloat(chipInputVal);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight number (e.g. 0.4 or 1.25)");
      return;
    }
    const label = chipInputLabel.trim() || (val < 1 ? `${Math.round(val * 1000)}g` : `${val} kg`);
    const updated = [...activeChips.filter((c) => c.val !== val), { label, val }].sort((a, b) => a.val - b.val);
    setActiveChips(updated);

    if (chipScope === "product" && activeItemModal) {
      localStorage.setItem(`fnf_pos_chips_${activeItemModal.id}`, JSON.stringify(updated));
      toast.success(`Quick chip saved for ${activeItemModal.name}!`);
    } else {
      localStorage.setItem("fnf_pos_global_chips", JSON.stringify(updated));
      setGlobalChips(updated);
      toast.success("Quick chip added to all products (Global)!");
    }
    setChipInputVal("");
    setChipInputLabel("");
  };

  const handleDeleteCustomChip = (valToDelete: number) => {
    const updated = activeChips.filter((c) => c.val !== valToDelete);
    setActiveChips(updated);
    if (chipScope === "product" && activeItemModal) {
      localStorage.setItem(`fnf_pos_chips_${activeItemModal.id}`, JSON.stringify(updated));
    } else {
      localStorage.setItem("fnf_pos_global_chips", JSON.stringify(updated));
      setGlobalChips(updated);
    }
    toast.success("Quick chip removed");
  };

  const handleResetDefaultChips = () => {
    setActiveChips(DEFAULT_QUICK_CHIPS);
    if (activeItemModal) {
      localStorage.removeItem(`fnf_pos_chips_${activeItemModal.id}`);
    }
    localStorage.setItem("fnf_pos_global_chips", JSON.stringify(DEFAULT_QUICK_CHIPS));
    setGlobalChips(DEFAULT_QUICK_CHIPS);
    toast.success("Quick chips reset to standard presets");
  };

  // Payment states (Single or Multi-payment / Split)
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "split">("cash");
  const [tenderedAmount, setTenderedAmount] = useState<string>("");
  const [upiUtr, setUpiUtr] = useState<string>("");

  // Split Tender states
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitUpi, setSplitUpi] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");
  const [splitUtr, setSplitUtr] = useState<string>("");

  const [processingOrder, setProcessingOrder] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [pastBillsModalOpen, setPastBillsModalOpen] = useState(false);
  const [parkedModalOpen, setParkedModalOpen] = useState(false);

  // Electronic Weighing Scale State & Driver Subscription
  const [scaleStatus, setScaleStatus] = useState<ScaleConnectionState>(() =>
    weighingScaleDriver.getConnectionState()
  );
  const [scaleReading, setScaleReading] = useState<ScaleReading>(() =>
    weighingScaleDriver.getLastReading()
  );
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleConfig, setScaleConfig] = useState<ScaleSerialConfig>(() =>
    weighingScaleDriver.loadSavedConfig()
  );
  const [simWeightInput, setSimWeightInput] = useState<string>("0.350");
  const [autoCapturedNotice, setAutoCapturedNotice] = useState<string | null>(null);
  const [rawStreamLog, setRawStreamLog] = useState<string[]>([]);
  const isScaleSupported = weighingScaleDriver.isSerialSupported();

  // Active item ref for zero-touch hands-free auto-capture
  const activeItemModalRef = useRef<Product | null>(null);
  activeItemModalRef.current = activeItemModal;

  useEffect(() => {
    // 1. Subscribe to weight updates
    const unsubWeight = weighingScaleDriver.onWeight((reading) => {
      setScaleReading(reading);
    });

    // 2. Subscribe to connection status updates
    const unsubStatus = weighingScaleDriver.onStatus((status) => {
      setScaleStatus(status);
    });

    // 3. Subscribe to hands-free stable weight capture
    const unsubStable = weighingScaleDriver.onStableWeight((weightKg) => {
      if (activeItemModalRef.current) {
        setModalWeightInput(weightKg.toFixed(3));
        setAutoCapturedNotice(`${weightKg.toFixed(3)} kg`);
        setTimeout(() => setAutoCapturedNotice(null), 3000);
        toast.success(`⚡ Scale locked ${weightKg.toFixed(3)} kg hands-free!`);
      }
    });

    // 4. Subscribe to raw serial data for diagnostic monitor
    const unsubRaw = weighingScaleDriver.onRawData((raw) => {
      setRawStreamLog((prev) => [raw.trim(), ...prev.slice(0, 14)]);
    });

    // 5. Attempt auto-reconnect to remembered serial port
    if (scaleConfig.autoReconnect && isScaleSupported) {
      weighingScaleDriver.autoConnect().then((connected) => {
        if (connected) {
          toast.success("Weighing scale auto-connected from remembered port!");
        }
      });
    }

    return () => {
      unsubWeight();
      unsubStatus();
      unsubStable();
      unsubRaw();
    };
  }, [scaleConfig.autoReconnect, isScaleSupported]);

  // Omnichannel Low Stock Radar Detection (Omnichannel stock <= 5kg or custom threshold)
  const lowStockProducts = useMemo(() => {
    return (rawProducts as Product[]).filter((p) => {
      const stock = p.stock ?? 0;
      const threshold = p.low_stock_threshold ?? 5;
      return p.is_available !== false && stock <= threshold;
    });
  }, [rawProducts]);

  // Offline and Auto-sync state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Parked Carts
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("fnf_pos_parked_carts");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

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

  // Quick Mode Keydown Handler (F1: Search, F2 or /: Quick PLU entry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        quickCodeInputRef.current?.focus();
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        quickCodeInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fast PLU Code Selector
  const handleQuickCodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = quickCodeInput.trim();
    if (!raw) return;
    const codeNum = parseInt(raw, 10);
    if (isNaN(codeNum)) {
      toast.error("Please enter a valid numeric PLU code (e.g. 1 or 14)");
      return;
    }

    // 1. Check in available products first
    const found = products.find((p, idx) => p.pos_code === codeNum || (!p.pos_code && (idx + 1) === codeNum));
    if (found) {
      handleOpenItem(found);
      setQuickCodeInput("");
      toast.info(`Selected PLU #${String(codeNum).padStart(2, "0")}: ${found.name}`);
      return;
    }

    // 2. Check if code belongs to an inactive or sold-out product
    const inactiveMatch = (rawProducts as Product[]).find(
      (p, idx) => p.pos_code === codeNum || (!p.pos_code && (idx + 1) === codeNum)
    );
    if (inactiveMatch) {
      toast.warning(`PLU Code #${codeNum} (${inactiveMatch.name}) is currently INACTIVE or OUT OF STOCK.`);
      setQuickCodeInput("");
      return;
    }

    toast.error(`No product found with PLU Code #${codeNum}`);
  };

  // Barcode & Scale Scanner Handler
  const handleBarcodeDetected = (parsed: ParsedBarcode) => {
    // 1. Scale barcode with embedded weight (Prefix 20/21)
    if (parsed.type === "scale_weight") {
      const targetPlu = parseInt(parsed.productIdOrCode, 10);
      const matched = products.find((p, idx) => p.pos_code === targetPlu || (!p.pos_code && (idx + 1) === targetPlu));
      if (matched) {
        const isWeightBased = (matched.unit || "kg").toLowerCase() === "kg";
        const weight = parsed.embeddedWeightKg || 1;
        const pricePerKg = Number(matched.price);
        const totalPrice = Math.round(pricePerKg * (isWeightBased ? weight : 1));

        const newItem: PosCartItem = {
          id: `${matched.id}-${Date.now()}`,
          productId: matched.id,
          name: matched.name,
          pricePerKg,
          weightKg: isWeightBased ? weight : 0,
          qty: isWeightBased ? 1 : Math.round(weight),
          unit: matched.unit || "kg",
          cuttingStyle: "Curry Cut",
          totalPrice,
          image: matched.image_url,
          gstPercent: (matched as any).gst_percent || 0,
        };

        setCart((prev) => [...prev, newItem]);
        toast.success(`Scale item added: ${matched.name} (${weight} kg - ₹${totalPrice})`, { icon: "⚖️" });
        return;
      }
    }

    // 2. PLU code scan (e.g. FNF-01 or numeric code)
    if (parsed.type === "plu_code") {
      const targetPlu = parseInt(parsed.productIdOrCode, 10);
      const matched = products.find((p, idx) => p.pos_code === targetPlu || (!p.pos_code && (idx + 1) === targetPlu));
      if (matched) {
        handleOpenItem(matched);
        toast.info(`Scanned PLU #${matched.pos_code ?? targetPlu}: ${matched.name}`);
        return;
      }
    }

    // 3. Direct Barcode / SKU matching
    const matched = products.find(
      (p, idx) =>
        p.id === parsed.productIdOrCode ||
        (p as any).barcode === parsed.productIdOrCode ||
        (p as any).sku === parsed.productIdOrCode ||
        p.pos_code === parseInt(parsed.productIdOrCode, 10) ||
        (!p.pos_code && (idx + 1) === parseInt(parsed.productIdOrCode, 10))
    );

    if (matched) {
      handleOpenItem(matched);
      toast.info(`Scanned Barcode: ${matched.name}`);
    } else {
      toast.error(`Barcode not found in catalog: ${parsed.raw}`);
    }
  };

  // Listen for hardware USB / Bluetooth barcode scanners
  useEffect(() => {
    hardwareScanner.startListening(handleBarcodeDetected);
    return () => {
      hardwareScanner.stopListening();
    };
  }, [products]);

  // Filtered Products with PLU Code Priority Matching
  const displayedProducts = useMemo(() => {
    return products.filter((p, idx) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const effectiveCode = p.pos_code ?? (idx + 1);

      // Numeric search (e.g. typing "1" or "01" matches PLU #1)
      if (/^\d+$/.test(q) && effectiveCode === parseInt(q, 10)) {
        return true;
      }

      return (
        p.name.toLowerCase().includes(q) ||
        (p.name_tamil ? p.name_tamil.toLowerCase().includes(q) : false) ||
        `#${effectiveCode}` === q ||
        `#${String(effectiveCode).padStart(2, "0")}` === q
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

  // Derived numeric weight for active weighing scale modal
  const modalWeight = useMemo(() => {
    const parsed = parseFloat(modalWeightInput);
    return isNaN(parsed) ? 0 : parsed;
  }, [modalWeightInput]);

  const adjustWeightByDelta = (deltaGrams: number) => {
    const current = parseFloat(modalWeightInput) || 0;
    const next = Math.max(0.01, Math.round((current + deltaGrams / 1000) * 1000) / 1000);
    setModalWeightInput(next.toString());
  };

  // Split Tender Calculations
  const splitCashNum = parseFloat(splitCash) || 0;
  const splitUpiNum = parseFloat(splitUpi) || 0;
  const splitCardNum = parseFloat(splitCard) || 0;
  const splitTotalAllocated = splitCashNum + splitUpiNum + splitCardNum;
  const splitRemaining = Math.max(0, totalPayable - splitTotalAllocated);

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

  // Offline queue helpers & auto-sync
  const loadOfflineQueue = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("fnf_pos_offline_orders");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const syncOfflineOrders = async () => {
    const queue = loadOfflineQueue();
    if (queue.length === 0) return;
    setIsSyncingOffline(true);
    let synced = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        const { data: orderRes, error: orderErr } = await (supabase as any)
          .from("orders")
          .insert(item.orderPayload)
          .select("id, order_number")
          .single();

        if (!orderErr && orderRes) {
          await deductOrderStock(orderRes.id, item.stockItems);
          synced++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    try {
      localStorage.setItem("fnf_pos_offline_orders", JSON.stringify(remaining));
    } catch {}
    setOfflineQueueCount(remaining.length);
    setIsSyncingOffline(false);
    if (synced > 0) {
      toast.success(`Synced ${synced} offline bill(s) to cloud database!`);
      qc.invalidateQueries({ queryKey: ["admin", "pos-orders-today"] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    }
  };

  useEffect(() => {
    setOfflineQueueCount(loadOfflineQueue().length);
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Network connection restored. Auto-syncing offline orders...");
      syncOfflineOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Network connection lost. Offline Billing Mode active.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Open item customization modal (with stock guard & live scale reading auto-detect)
  const handleOpenItem = (prod: Product) => {
    if ((prod.stock ?? 0) <= 0 || prod.is_available === false) {
      toast.error(`${prod.name} is currently SOLD OUT! Please inward stock first.`);
      return;
    }
    setActiveItemModal(prod);
    setModalSerialInput("");
    if (prod.variants && prod.variants.length > 0) {
      setModalSelectedVariant(prod.variants[0]);
    } else {
      setModalSelectedVariant(null);
    }
    // If electronic weighing scale has live weight on plate, auto-populate hands-free!
    if (scaleStatus === "streaming" && scaleReading.weightKg >= (scaleConfig.minCaptureWeightKg || 0.02)) {
      setModalWeightInput(scaleReading.weightKg.toFixed(3));
      if (scaleReading.isStable) {
        setAutoCapturedNotice(`${scaleReading.weightKg.toFixed(3)} kg`);
        setTimeout(() => setAutoCapturedNotice(null), 3000);
      }
    } else {
      setModalWeightInput("1.0");
    }
    setModalCutting(CUTTING_STYLES[0] ?? "Curry Cut");
  };

  // Add item to cart with strict stock boundary check
  const handleAddToCart = () => {
    if (!activeItemModal) return;
    const isWeightBased = (activeItemModal.unit || "kg").toLowerCase() === "kg";
    const selectedVar = modalSelectedVariant;
    const basePrice = selectedVar ? Number(selectedVar.price) : Number(activeItemModal.price);
    const pricePerKg = basePrice;
    const weight = isWeightBased ? modalWeight : 1;
    const qty = isWeightBased ? 1 : Math.round(modalWeight);

    const availableStock = selectedVar ? Number(selectedVar.stock ?? 0) : (activeItemModal.stock ?? 0);
    const requestedAmt = isWeightBased ? modalWeight : qty;

    if (availableStock <= 0 || activeItemModal.is_available === false) {
      toast.error(`${activeItemModal.name}${selectedVar ? ` (${selectedVar.size || ""} ${selectedVar.color || ""})` : ""} is out of stock! Cannot add to bill.`);
      return;
    }

    if (requestedAmt > availableStock) {
      toast.error(
        `Requested ${requestedAmt} exceeds available stock of ${availableStock}!`
      );
      setModalWeightInput(availableStock.toString());
      return;
    }

    // Mandatory IMEI / Serial tracking validation
    let serialList: string[] = [];
    if (activeItemModal.requires_serial) {
      const serials = modalSerialInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (serials.length < qty) {
        toast.error(`Please enter or scan at least ${qty} Serial/IMEI number(s). Currently captured: ${serials.length}`);
        return;
      }
      serialList = serials.slice(0, qty);
    }

    const totalPrice = Math.round(pricePerKg * (isWeightBased ? modalWeight : qty));

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
      serialNumbers: serialList.length > 0 ? serialList : undefined,
      variant: selectedVar
        ? {
            id: selectedVar.id,
            size: selectedVar.size,
            color: selectedVar.color,
            sku: selectedVar.sku,
          }
        : undefined,
      brand: activeItemModal.brand || undefined,
      warrantyMonths: activeItemModal.warranty_period_months || undefined,
      aisleLocation: activeItemModal.aisle_location || undefined,
    };

    setCart((prev) => [...prev, newItem]);
    setActiveItemModal(null);
    toast.success(`Added ${newItem.name} (${newItem.weightKg ? `${newItem.weightKg} kg` : `${newItem.qty} pcs`}) to bill`);
  };

  // Adjust Cart Item (+/- stepper with stock check)
  const handleAdjustCartItem = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const matched = products.find((p) => p.id === item.productId);
        const maxStock = matched?.stock ?? 9999;
        const isWeight = item.unit.toLowerCase() === "kg";

        if (isWeight) {
          const newWeight = Math.max(0.05, Math.round((item.weightKg + delta) * 100) / 100);
          if (delta > 0 && newWeight > maxStock) {
            toast.warning(`Cannot exceed available store stock (${maxStock} kg)!`);
            return item;
          }
          return {
            ...item,
            weightKg: newWeight,
            totalPrice: Math.round(newWeight * item.pricePerKg),
          };
        } else {
          const newQty = Math.max(1, item.qty + delta);
          if (delta > 0 && newQty > maxStock) {
            toast.warning(`Cannot exceed available store stock (${maxStock} pcs)!`);
            return item;
          }
          return {
            ...item,
            qty: newQty,
            totalPrice: Math.round(newQty * item.pricePerKg),
          };
        }
      })
    );
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearBill = () => {
    setCart([]);
    setDiscountAmount(0);
    setTenderedAmount("");
    setUpiUtr("");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
    setSplitUtr("");
    setCustomerName("");
    setCustomerPhone("");
  };

  // Park / Hold bill
  const handleParkCart = () => {
    if (cart.length === 0) {
      toast.error("Cannot park an empty cart");
      return;
    }
    const newParked: ParkedCart = {
      id: `parked-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      label: customerName.trim() || `Customer #${parkedCarts.length + 1} (${cart.length} items)`,
      cart,
      customerName,
      customerPhone,
      discountAmount,
    };
    const updated = [newParked, ...parkedCarts];
    setParkedCarts(updated);
    try {
      localStorage.setItem("fnf_pos_parked_carts", JSON.stringify(updated));
    } catch {}
    handleClearBill();
    toast.success(`Bill held for ${newParked.label}`);
  };

  const handleResumeParkedCart = (p: ParkedCart) => {
    if (cart.length > 0) {
      toast.error("Current bill has items! Clear or park it before resuming another.");
      return;
    }
    setCart(p.cart);
    setCustomerName(p.customerName);
    setCustomerPhone(p.customerPhone);
    setDiscountAmount(p.discountAmount);
    const updated = parkedCarts.filter((x) => x.id !== p.id);
    setParkedCarts(updated);
    try {
      localStorage.setItem("fnf_pos_parked_carts", JSON.stringify(updated));
    } catch {}
    setParkedModalOpen(false);
    toast.success(`Resumed bill for ${p.label}`);
  };

  const handleDeleteParkedCart = (id: string) => {
    const updated = parkedCarts.filter((x) => x.id !== id);
    setParkedCarts(updated);
    try {
      localStorage.setItem("fnf_pos_parked_carts", JSON.stringify(updated));
    } catch {}
    toast.info("Removed held bill");
  };

  // Generate UPI Deep Link and QR Code for POS counter screen
  const upiId = settings?.upi_id || "9843061919@upi";
  const upiName = settings?.upi_name || "Fish N Fresh";
  const posUpiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${totalPayable}&cu=INR&tn=${encodeURIComponent(`Counter Bill`)}`;
  const posUpiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(posUpiDeepLink)}`;

  const splitUpiDeepLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${splitUpiNum}&cu=INR&tn=${encodeURIComponent(`Counter Bill Split UPI`)}`;
  const splitUpiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(splitUpiDeepLink)}`;

  // Desktop keyboard shortcuts (F1-F12, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        handleClearBill();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleParkCart();
      } else if (e.key === "F5") {
        e.preventDefault();
        setPastBillsModalOpen((prev) => !prev);
      } else if (e.key === "F8") {
        e.preventDefault();
        setPaymentMode("split");
      } else if (e.key === "F9") {
        e.preventDefault();
        setPaymentMode("cash");
      } else if (e.key === "F10") {
        e.preventDefault();
        setPaymentMode("upi");
      } else if (e.key === "F12") {
        e.preventDefault();
        if (!processingOrder && cart.length > 0) {
          completeSale();
        }
      } else if (e.key === "Escape") {
        if (activeItemModal) setActiveItemModal(null);
        if (pastBillsModalOpen) setPastBillsModalOpen(false);
        if (parkedModalOpen) setParkedModalOpen(false);
        if (printerModalOpen) setPrinterModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cart,
    processingOrder,
    activeItemModal,
    pastBillsModalOpen,
    parkedModalOpen,
    printerModalOpen,
    totalPayable,
    tenderedNum,
    splitCashNum,
    splitUpiNum,
    splitCardNum,
    splitTotalAllocated,
    splitRemaining,
    customerName,
    customerPhone,
    discountAmount,
    parkedCarts,
  ]);

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
    if (paymentMode === "split") {
      if (splitRemaining > 0) {
        toast.error(`Please allocate remaining ${formatINR(splitRemaining)} across Cash, UPI, or Card`);
        return;
      }
    }

    setProcessingOrder(true);
    const printerConfig = getSavedPrinterConfig();
    const orderNumber = getNextPosReceiptNo(
      printerConfig.billPrefix || "POS-",
      printerConfig.billSequenceDailyReset !== false
    );
    const nowIso = new Date().toISOString();
    const dateFormatted = formatInvoiceDateTime(new Date(), true);

    const receiptItems: PosReceiptItem[] = cart.map((it) => ({
      name: it.name,
      weightKg: it.weightKg > 0 ? it.weightKg : undefined,
      qty: it.qty,
      unitPrice: it.pricePerKg,
      totalPrice: it.totalPrice,
      cuttingStyle: it.cuttingStyle,
      brand: it.brand,
      serialNumbers: it.serialNumbers,
      variant: it.variant
        ? `${it.variant.size ? `Size: ${it.variant.size} ` : ""}${it.variant.color ? `Color: ${it.variant.color}` : ""}`.trim()
        : undefined,
      warrantyMonths: it.warrantyMonths,
      aisleLocation: it.aisleLocation,
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
      upiRef: paymentMode === "upi" ? (upiUtr.trim() || undefined) : (paymentMode === "split" && splitUtr.trim() ? splitUtr.trim() : undefined),
      splitPayments: paymentMode === "split" ? {
        cash: splitCashNum,
        upi: splitUpiNum,
        card: splitCardNum,
      } : undefined,
      storeName: settings?.store_name || "Universal Retail Hub",
      storeAddress: settings?.store_address || undefined,
      storePhone: (settings as any)?.contact_phone || undefined,
      storeGstin: (settings as any)?.gst_number || undefined,
      copyType: "ORIGINAL",
      isReprint: false,
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
        actual_payment_ref: paymentMode === "upi" ? (upiUtr.trim() || null) : (paymentMode === "split" ? (splitUtr.trim() || null) : null),
        paid_to_bank_directly: paymentMode === "upi" || (paymentMode === "split" && splitUpiNum > 0),
        pos_split_payments: paymentMode === "split" ? { cash: splitCashNum, upi: splitUpiNum, card: splitCardNum } : null,
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
          brand: it.brand || null,
          serial_numbers: it.serialNumbers || [],
          variant: it.variant || null,
          warranty_months: it.warrantyMonths || 0,
          aisle_location: it.aisleLocation || null,
        })) as any,
        pos_cashier_id: cashierId,
        pos_cashier_name: cashierName,
        pos_amount_tendered: paymentMode === "cash" ? (tenderedNum || totalPayable) : null,
        pos_change_due: paymentMode === "cash" ? changeDue : null,
        delivered_at: nowIso,
      };

      const stockItems = cart.map((it) => ({
        product_id: it.productId,
        qty: it.weightKg > 0 ? it.weightKg : it.qty,
      }));

      if (navigator.onLine) {
        try {
          const { data: orderRes, error: orderErr } = await (supabase as any)
            .from("orders")
            .insert(orderPayload)
            .select("id, order_number")
            .single();

          if (orderErr) {
            console.warn("Could not insert order:", orderErr.message);
          }

          // Real-time Atomic Inventory Deduction
          await deductOrderStock(orderRes?.id || orderNumber, stockItems);
        } catch (netErr) {
          console.warn("Falling back to offline queue:", netErr);
          const queue = loadOfflineQueue();
          queue.push({ orderPayload, stockItems });
          try {
            localStorage.setItem("fnf_pos_offline_orders", JSON.stringify(queue));
          } catch {}
          setOfflineQueueCount(queue.length);
        }
      } else {
        const queue = loadOfflineQueue();
        queue.push({ orderPayload, stockItems });
        try {
          localStorage.setItem("fnf_pos_offline_orders", JSON.stringify(queue));
        } catch {}
        setOfflineQueueCount(queue.length);
        toast.info("Offline: Bill queued in local register. Will auto-sync when online.");
      }

      // 3. Print ESC/POS thermal receipt (multi-copies support)
      const copies = Math.min(3, Math.max(1, printerConfig.printCopies || 1));
      const copyLabels: ("ORIGINAL" | "KITCHEN TOKEN" | "STORE RECORD")[] = [
        "ORIGINAL",
        "KITCHEN TOKEN",
        "STORE RECORD",
      ];

      for (let i = 0; i < copies; i++) {
        const copyData: PosReceiptData = {
          ...receiptData,
          copyType: copyLabels[i] || "ORIGINAL",
        };
        const escPosBytes = buildPosReceiptEscPos(copyData, printerConfig);
        const fallbackHtml = buildPosReceiptHtml(copyData, printerConfig);
        try {
          await sendEscPosToPrinter(escPosBytes, printerConfig, fallbackHtml);
        } catch (printErr) {
          console.warn("Direct thermal print notice:", printErr);
        }
      }

      setLastReceipt(receiptData);
      toast.success(`Bill #${orderNumber} completed! Net: ${formatINR(totalPayable)}`);

      // Auto WhatsApp prompt if enabled
      if (printerConfig.autoWhatsAppPrompt && customerPhone.trim().length >= 10) {
        const waUrl = getPosWhatsAppShareUrl(customerPhone.trim(), receiptData);
        window.open(waUrl, "_blank");
      }

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
    const reprintData: PosReceiptData = {
      ...lastReceipt,
      isReprint: true,
      reprintCount: 1,
      reprintTimestamp: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
      copyType: "STORE RECORD",
    };
    const escPosBytes = buildPosReceiptEscPos(reprintData, printerConfig);
    const fallbackHtml = buildPosReceiptHtml(reprintData, printerConfig);
    await sendEscPosToPrinter(escPosBytes, printerConfig, fallbackHtml);
    toast.success(`Reprinted Bill #${lastReceipt.receiptNo} with Audit Mark`);
  };

  return (
    <AdminShell title="In-Store Retail POS Counter" allow={["admin", "cashier", "manager", "staff"]}>
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
                {/* Offline & Sync status indicator */}
                {!isOnline ? (
                  <Badge
                    variant="destructive"
                    className="flex items-center gap-1 font-mono text-[10px] cursor-pointer hover:opacity-90"
                    onClick={() => syncOfflineOrders()}
                    title="Offline billing active. Click to retry syncing."
                  >
                    <WifiOff className="size-3" /> Offline ({offlineQueueCount})
                  </Badge>
                ) : offlineQueueCount > 0 ? (
                  <Badge
                    className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                    onClick={() => syncOfflineOrders()}
                    title="Click to sync queued offline bills"
                  >
                    <RefreshCw className={`size-3 ${isSyncingOffline ? "animate-spin" : ""}`} /> Sync Queue ({offlineQueueCount})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
                    <Wifi className="size-3" /> Live Cloud
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                In-store walk-in counter checkout · Real-time unified stock deduction · Hotkeys F1-F12
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

            {/* Held / Parked Carts Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80 relative"
              onClick={() => setParkedModalOpen(true)}
              title="View held bills [F4]"
            >
              <Bookmark className="size-3.5 text-amber-500" />
              <span>Held Bills [F4]</span>
              {parkedCarts.length > 0 && (
                <span className="size-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {parkedCarts.length}
                </span>
              )}
            </Button>

            {/* Universal Quick Chips Manager Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80"
              onClick={() => {
                refreshGlobalChips();
                setGlobalChipModalOpen(true);
              }}
              title="Universal and custom portion chips manager"
            >
              <Sliders className="size-3.5 text-primary" />
              <span>⚡ Quick Chips</span>
            </Button>

            {/* Past Bills & Sales Register Trigger */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80"
              onClick={() => setPastBillsModalOpen(true)}
              title="Sales Register & Past Bills [F5]"
            >
              <History className="size-3.5 text-primary" />
              <span>Sales Register [F5]</span>
            </Button>

            {/* Reprint Last Bill */}
            {lastReceipt && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8.5 text-xs font-semibold gap-1.5"
                onClick={reprintLastBill}
                title="Reprint last completed receipt"
              >
                <RotateCcw className="size-3.5 text-primary" />
                <span>Reprint Last</span>
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
              <span>Printer Setup</span>
            </Button>

            {/* Electronic Weighing Scale Hardware Trigger */}
            <Button
              variant="outline"
              size="sm"
              className={`rounded-xl h-8.5 text-xs font-semibold gap-1.5 border-border/80 ${
                scaleStatus === "streaming"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : scaleStatus === "connected"
                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                  : ""
              }`}
              onClick={() => setScaleModalOpen(true)}
              title="Connect and manage electronic weighing scale (CAS, Essae, Toledo, Avery)"
            >
              <Scale className={`size-3.5 ${scaleStatus === "streaming" ? "text-emerald-600 animate-pulse" : "text-primary"}`} />
              <span>
                {scaleStatus === "streaming"
                  ? `⚖️ ${scaleReading.weightKg.toFixed(3)} kg ${scaleReading.isStable ? "STABLE" : "MOTION"}`
                  : scaleStatus === "connected"
                  ? "Scale: Ready"
                  : scaleStatus === "connecting"
                  ? "Scale: Connecting..."
                  : "Weighing Scale"}
              </span>
            </Button>
          </div>
        </div>

        {/* Real-Time Electronic Weighing Scale Plate HUD Ribbon */}
        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Left: Plate Weight & Status Readout */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-primary/30 bg-zinc-950 px-3.5 py-1.5 font-mono text-white flex items-baseline gap-2 shadow-inner">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">SCALE</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">
                {scaleReading.weightKg.toFixed(3)}
              </span>
              <span className="text-xs font-bold text-zinc-400">KG</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Badge
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 border ${
                    scaleStatus === "streaming"
                      ? scaleReading.isStable
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse"
                      : scaleStatus === "connected"
                      ? "bg-cyan-500/15 text-cyan-600 border-cyan-500/30"
                      : "bg-zinc-500/15 text-zinc-600 border-zinc-500/30"
                  }`}
                >
                  {scaleStatus === "streaming"
                    ? scaleReading.isStable
                      ? "● STABLE"
                      : "○ MOTION"
                    : scaleStatus === "connected"
                    ? "READY"
                    : "STANDBY"}
                </Badge>

                {scaleReading.tareKg > 0 && (
                  <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                    TARE: {scaleReading.tareKg.toFixed(3)} kg
                  </Badge>
                )}

                {autoCapturedNotice && (
                  <Badge className="bg-emerald-500 text-white text-[10px] font-bold animate-bounce gap-1">
                    <Zap className="size-3" /> Auto-Captured {autoCapturedNotice}
                  </Badge>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground font-medium">
                {scaleStatus === "streaming"
                  ? `Protocol: ${scaleReading.protocol.toUpperCase()} • ${scaleConfig.baudRate} Baud • Hands-Free ${scaleConfig.handsFreeMode ? "Active" : "Off"}`
                  : "Connect physical RS-232 / USB scale or use simulator"}
              </span>
            </div>
          </div>

          {/* Right: Scale Controls */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold border-border/80 px-2 sm:px-2.5"
              onClick={() => {
                weighingScaleDriver.zero();
                toast.success("Zero command sent to scale");
              }}
              title="Zero the scale"
            >
              Zero
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold border-border/80 px-2 sm:px-2.5"
              onClick={() => {
                weighingScaleDriver.tare();
                toast.success("Tare command sent to scale");
              }}
              title="Tare container weight"
            >
              Tare
            </Button>

            <Button
              type="button"
              variant={scaleConfig.handsFreeMode ? "default" : "outline"}
              size="sm"
              className={`h-8 rounded-xl text-xs font-bold gap-1 px-2 sm:px-2.5 ${
                scaleConfig.handsFreeMode ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""
              }`}
              onClick={() => {
                const updated = !scaleConfig.handsFreeMode;
                const newCfg = weighingScaleDriver.saveConfig({ handsFreeMode: updated });
                setScaleConfig(newCfg);
                toast.info(`Hands-Free Auto-Capture ${updated ? "Enabled" : "Disabled"}`);
              }}
              title="Automatically captures stable weight when seafood is placed on the plate"
            >
              <Zap className="size-3.5" />
              <span>Auto: {scaleConfig.handsFreeMode ? "ON" : "OFF"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold border-border/80 px-2 sm:px-2.5 gap-1 shrink-0"
              onClick={() => setScaleModalOpen(true)}
              title="Open scale configuration & diagnostics"
            >
              <Settings2 className="size-3.5 text-primary" />
              <span>Setup</span>
            </Button>
          </div>
        </div>

        {/* 2-Column POS Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_430px] gap-4 items-start">
          {/* LEFT: Fast Touch Product Catalog */}
          <div className="space-y-3">
            {/* Omnichannel Low Stock Radar Alert Banner */}
            {lowStockProducts.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
                        Low Stock Alert Radar ({lowStockProducts.length} items low or out of stock)
                      </span>
                      <span className="rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2 py-0.2">
                        Immediate Inward Required
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {lowStockProducts.slice(0, 4).map((lp) => (
                        <span
                          key={lp.id}
                          className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground border border-amber-500/20"
                        >
                          {lp.name}: <strong className={lp.stock <= 0 ? "text-rose-600" : "text-amber-600"}>{lp.stock} {lp.unit || "kg"}</strong>
                        </span>
                      ))}
                      {lowStockProducts.length > 4 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{lowStockProducts.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="rounded-xl h-8 text-xs font-bold gap-1 bg-amber-600 hover:bg-amber-500 text-white shrink-0 self-end sm:self-center"
                  asChild
                >
                  <a href="/admin/purchases">
                    <Plus className="size-3.5" /> Inward Catch (Purchases)
                  </a>
                </Button>
              </div>
            )}

            {/* Quick Mode PLU Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-gradient-to-r from-primary/10 via-card to-card rounded-2xl border border-primary/25 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shrink-0 shadow-2xs">
                  ⚡
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Quick Mode Billing</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-primary/20 text-primary font-mono font-bold">F2 / /</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Type item PLU number &amp; press Enter to ring up instantly
                  </p>
                </div>
              </div>

              <form onSubmit={handleQuickCodeSubmit} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="relative w-full sm:w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-xs text-primary">#</span>
                  <Input
                    ref={quickCodeInputRef}
                    data-barcode-input="true"
                    type="text"
                    placeholder="PLU / Barcode"
                    value={quickCodeInput}
                    onChange={(e) => setQuickCodeInput(e.target.value)}
                    className="pl-7 pr-2 h-9 text-xs font-mono font-bold rounded-xl bg-background border-primary/30 focus-visible:ring-primary text-foreground"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-2xs px-3"
                >
                  Select
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCameraScannerOpen(true)}
                  className="h-9 rounded-xl font-bold text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5 shrink-0 px-2.5"
                  title="Scan Barcode using Device Camera"
                >
                  <Camera className="size-3.5" />
                  <span className="hidden sm:inline">Camera</span>
                </Button>
              </form>
            </div>

            {/* Search & Category Filter */}
            <div className="space-y-2 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Fast search seafood / meat by name (English or Tamil) [F1]..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-background"
                />
              </div>

              {/* Category Pills */}
              <div 
                className="flex items-center gap-1.5 overflow-x-auto touch-pan-x scroll-smooth pb-1 scrollbar-none"
                onWheel={(e) => {
                  if (e.deltaY !== 0 && Math.abs(e.deltaX) < 10) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                <Button
                  size="sm"
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  className="rounded-xl h-7 text-xs shrink-0 font-semibold"
                  onClick={() => setSelectedCategory("all")}
                >
                  All Items ({products.length})
                </Button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat.name).length;
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={selectedCategory === cat.name ? "default" : "outline"}
                      className="rounded-xl h-7 text-xs shrink-0 font-semibold"
                      onClick={() => setSelectedCategory(cat.name)}
                    >
                      {cat.name} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {displayedProducts.map((prod, index) => {
                const isOutOfStock =
                  (typeof prod.stock === "number" && prod.stock <= 0) || prod.is_available === false;
                const effectiveCode = prod.pos_code ?? (index + 1);

                const cartEntries = cart.filter((item) => item.productId === prod.id);
                const isInCart = cartEntries.length > 0;
                const inCartQty = cartEntries.reduce((sum, item) => sum + (item.weightKg > 0 ? item.weightKg : item.qty), 0);

                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      if (isOutOfStock) {
                        toast.error(`${prod.name} is SOLD OUT! Inward fresh catch from harbour first.`);
                        return;
                      }
                      handleOpenItem(prod);
                    }}
                    className={`relative text-left p-3 rounded-2xl border transition-all duration-150 flex flex-col justify-between group ${
                      isOutOfStock
                        ? "opacity-60 border-dashed border-destructive/40 bg-destructive/5 cursor-not-allowed"
                        : isInCart
                        ? "bg-primary/5 dark:bg-primary/10 border-primary/80 ring-2 ring-primary/30 shadow-md scale-[1.01]"
                        : "bg-card border-border/80 hover:border-primary/60 hover:shadow-md active:scale-98"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="aspect-4/3 w-full rounded-xl overflow-hidden bg-muted/40 relative">
                        {/* High-Contrast Permanent PLU Code Badge */}
                        <div className="absolute top-1.5 left-1.5 z-10">
                          <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded-lg bg-slate-900/90 text-white dark:bg-sky-500/90 dark:text-slate-950 shadow-sm border border-white/20">
                            #{String(effectiveCode).padStart(2, "0")}
                          </span>
                        </div>
                        {/* In-Cart Highlight Badge */}
                        {isInCart && (
                          <div className="absolute top-1.5 right-1.5 z-10">
                            <span className="flex items-center gap-1 font-mono font-black text-[10px] px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-sm border border-white/20 animate-in fade-in zoom-in-95">
                              <CheckCircle2 className="size-3 fill-white text-emerald-600" />
                              <span>{Math.round(inCartQty * 1000) / 1000} {prod.unit || "kg"}</span>
                            </span>
                          </div>
                        )}

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

                        {/* Sold Out Overlay */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] flex items-center justify-center p-1">
                            <span className="text-[10px] font-black uppercase text-destructive tracking-wider border border-destructive/40 bg-destructive/10 px-2 py-0.5 rounded-md shadow-xs">
                              SOLD OUT
                            </span>
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
                            {isOutOfStock ? "Out of Stock" : formatStockBadge(prod.stock, prod.unit)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {prod.name}
                        </p>
                        {prod.name_tamil && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {prod.name_tamil}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                      <span className="font-bold text-xs text-primary font-mono">
                        {formatINR(Number(prod.price))}/{prod.unit || "kg"}
                      </span>
                      <div className="flex items-center gap-1">
                        {isInCart && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCart((prev) => prev.filter((item) => item.productId !== prod.id));
                              toast.success(`Removed "${prod.name}" from bill`);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setCart((prev) => prev.filter((item) => item.productId !== prod.id));
                                toast.success(`Removed "${prod.name}" from bill`);
                              }
                            }}
                            className="size-6 rounded-lg text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 bg-rose-500/10 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                            title={`Remove ${prod.name} from bill`}
                            aria-label={`Remove ${prod.name} from bill`}
                          >
                            <Trash2 className="size-3 stroke-[2.2]" />
                          </span>
                        )}
                        <span
                          className={`size-6 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                            isOutOfStock
                              ? "bg-muted text-muted-foreground"
                              : isInCart
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                          }`}
                        >
                          {isOutOfStock ? "✕" : isInCart ? "✓" : "+"}
                        </span>
                      </div>
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
          <div id="pos-cart-panel" className="space-y-3 sticky top-4">
            <Card className="border-border/80 shadow-md rounded-3xl overflow-hidden">
              {/* Bill Header */}
              <CardHeader className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4.5 text-primary" />
                    <CardTitle className="text-sm font-bold">Current Counter Bill</CardTitle>
                  </div>
                  {cart.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleParkCart}
                        className="h-7 text-xs text-amber-600 hover:bg-amber-500/10 px-2"
                        title="Hold current bill [F4]"
                      >
                        <Bookmark className="size-3 mr-1" /> Hold [F4]
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearBill}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2"
                        title="Clear bill [F2]"
                      >
                        <Trash2 className="size-3 mr-1" /> Clear
                      </Button>
                    </div>
                  )}
                </div>

                {/* Optional Customer Contact for FreshCash / WhatsApp receipt */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Input
                    placeholder="Customer Name (Opt)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-7 text-xs rounded-lg bg-background"
                  />
                  <Input
                    placeholder="Mobile No. (for WhatsApp)"
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
                        <div className="flex items-center gap-1">
                          {item.brand && (
                            <span className="text-[10px] font-extrabold uppercase px-1 rounded bg-primary/10 text-primary">
                              {item.brand}
                            </span>
                          )}
                          <p className="font-bold text-xs text-foreground truncate">{item.name}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                          {item.variant && (
                            <span className="text-[10px] font-medium bg-muted px-1.5 py-0.2 rounded font-mono">
                              {item.variant.size ? `Size: ${item.variant.size} ` : ""}{item.variant.color ? `· ${item.variant.color}` : ""}
                            </span>
                          )}
                          {item.cuttingStyle && (
                            <span className="text-primary font-medium">[{item.cuttingStyle}] · </span>
                          )}
                          <span>₹{item.pricePerKg}/{item.unit}</span>
                          {item.aisleLocation && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">· 📍 {item.aisleLocation}</span>
                          )}
                        </p>
                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                          <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                            SN: {item.serialNumbers.join(", ")}
                          </p>
                        )}
                        {/* Inline Item Stepper */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustCartItem(item.id, item.unit.toLowerCase() === "kg" ? -0.25 : -1)}
                            className="size-5 rounded flex items-center justify-center bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Decrease quantity/weight"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="font-mono text-[11px] font-bold px-1 bg-background rounded border border-border/60">
                            {item.weightKg > 0 ? `${item.weightKg.toFixed(2)} kg` : `${item.qty} ${item.unit}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustCartItem(item.id, item.unit.toLowerCase() === "kg" ? 0.25 : 1)}
                            className="size-5 rounded flex items-center justify-center bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Increase quantity/weight"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
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
                    <div className="grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => setPaymentMode("cash")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "cash"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Cash tender [F9]"
                      >
                        <Banknote className="size-3.5" /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("upi")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "upi"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="UPI QR payment [F10]"
                      >
                        <QrCode className="size-3.5" /> UPI QR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("card")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "card"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Card Swipe"
                      >
                        <CreditCard className="size-3.5" /> Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMode("split")}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          paymentMode === "split"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="Split payment [F8]"
                      >
                        <Layers className="size-3.5" /> Split
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

                    {/* Split Tender Panel */}
                    {paymentMode === "split" && (
                      <div className="space-y-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 p-3.5 text-xs">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                            <Layers className="size-4 text-indigo-600 dark:text-indigo-400" /> Split Tender Breakdown
                          </span>
                          <span className="font-mono text-foreground font-extrabold">{formatINR(totalPayable)}</span>
                        </div>

                        {/* Balance Allocation Indicator */}
                        <div className="p-2 rounded-xl bg-background/80 border border-indigo-500/20 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Allocated: <strong className="text-foreground">{formatINR(splitTotalAllocated)}</strong></span>
                          {splitRemaining === 0 ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                              Fully Allocated
                            </Badge>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              Remaining: {formatINR(splitRemaining)}
                            </span>
                          )}
                        </div>

                        {/* Split Inputs */}
                        <div className="space-y-2">
                          {/* Cash Portion */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground flex items-center gap-1 w-20">
                              <Banknote className="size-3.5 text-amber-600" /> Cash:
                            </span>
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                type="number"
                                placeholder="0"
                                value={splitCash}
                                onChange={(e) => setSplitCash(e.target.value)}
                                className="h-7 text-right text-xs font-mono bg-background rounded-lg flex-1"
                              />
                              {splitRemaining > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => setSplitCash((splitCashNum + splitRemaining).toString())}
                                >
                                  Fill
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* UPI Portion */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground flex items-center gap-1 w-20">
                              <QrCode className="size-3.5 text-emerald-600" /> UPI:
                            </span>
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                type="number"
                                placeholder="0"
                                value={splitUpi}
                                onChange={(e) => setSplitUpi(e.target.value)}
                                className="h-7 text-right text-xs font-mono bg-background rounded-lg flex-1"
                              />
                              {splitRemaining > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => setSplitUpi((splitUpiNum + splitRemaining).toString())}
                                >
                                  Fill
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Card Portion */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground flex items-center gap-1 w-20">
                              <CreditCard className="size-3.5 text-primary" /> Card:
                            </span>
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                type="number"
                                placeholder="0"
                                value={splitCard}
                                onChange={(e) => setSplitCard(e.target.value)}
                                className="h-7 text-right text-xs font-mono bg-background rounded-lg flex-1"
                              />
                              {splitRemaining > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => setSplitCard((splitCardNum + splitRemaining).toString())}
                                >
                                  Fill
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dynamic QR for split UPI if split UPI > 0 */}
                        {splitUpiNum > 0 && (
                          <div className="p-2.5 rounded-xl bg-background border border-emerald-500/30 flex flex-col items-center justify-center space-y-1.5">
                            <div className="flex items-center justify-between w-full text-[11px] font-bold text-emerald-700">
                              <span>Exact UPI Portion:</span>
                              <span className="font-mono">{formatINR(splitUpiNum)}</span>
                            </div>
                            <img
                              src={splitUpiQrUrl}
                              alt="Split UPI QR"
                              className="size-28 object-contain"
                            />
                            <Input
                              placeholder="UPI UTR / Ref (Optional)"
                              value={splitUtr}
                              onChange={(e) => setSplitUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                              className="h-6 text-[11px] font-mono rounded bg-muted/40 w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* One-Click Complete & Print Bill */}
                    <Button
                      type="button"
                      disabled={processingOrder}
                      onClick={completeSale}
                      className="w-full rounded-2xl h-12 text-sm font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      title="Complete and print bill [F12]"
                    >
                      {processingOrder ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="size-4 animate-spin" />
                          Printing Receipt & Deducting Stock...
                        </span>
                      ) : (
                        <>
                          <Printer className="size-4.5" />
                          <span>Complete &amp; Print Bill ({formatINR(totalPayable)}) [F12]</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating POS Counter Bottom Cart Bar (Shown whenever cart has items, especially on mobile/tablets or when cashier has scrolled down) */}
        {cart.length > 0 && (
          <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-xl px-3 sm:px-4 lg:hidden pointer-events-none">
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/95 px-4 py-3 text-primary-foreground shadow-2xl pointer-events-auto border border-white/20 animate-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center gap-3">
                <div className="relative flex size-10 items-center justify-center rounded-2xl bg-white/20 shrink-0 shadow-inner">
                  <Receipt className="size-5" />
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-black shadow-xs">
                    {cart.length}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-extrabold text-base sm:text-lg font-mono tracking-tight">{formatINR(totalPayable)}</span>
                    <span className="text-xs text-primary-foreground/80 font-medium">({cart.length} {cart.length === 1 ? "item" : "items"})</span>
                  </div>
                  <p className="text-[11px] text-primary-foreground/75 line-clamp-1">
                    {cart.slice(0, 2).map((i) => i.name).join(", ")}{cart.length > 2 ? ` +${cart.length - 2} more` : ""}
                  </p>
                </div>
              </div>
              <Button 
                type="button"
                variant="secondary" 
                className="rounded-xl px-4 sm:px-5 shadow-md text-xs sm:text-sm font-bold gap-1.5 hover:scale-102 transition-transform bg-white text-primary hover:bg-white/90"
                onClick={() => {
                  const el = document.getElementById("pos-cart-panel");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                <span>View Bill</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Item Weighing Scale & Cutting Style Customizer Modal (Fixed Decimal Weight Input < 1kg) */}
      {activeItemModal && (
        <Dialog open={!!activeItemModal} onOpenChange={(open) => !open && setActiveItemModal(null)}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-4 pb-3 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs">
                  <Scale className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeItemModal.brand && (
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {activeItemModal.brand}
                      </span>
                    )}
                    <DialogTitle className="font-display text-base font-bold text-foreground">
                      {activeItemModal.name}
                    </DialogTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span>
                      Rate: {formatINR(modalSelectedVariant ? Number(modalSelectedVariant.price) : Number(activeItemModal.price))}/{activeItemModal.unit || "kg"}
                    </span>
                    <span>· Live Stock: {formatStockDisplay(modalSelectedVariant ? modalSelectedVariant.stock : activeItemModal.stock, activeItemModal.unit)}</span>
                    {activeItemModal.warranty_period_months && activeItemModal.warranty_period_months > 0 ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-1 rounded">
                        🛡️ {activeItemModal.warranty_period_months}M Warranty
                      </span>
                    ) : null}
                    {activeItemModal.aisle_location && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-1 rounded">
                        📍 {activeItemModal.aisle_location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Electronic Weighing Scale Live Auto-Detect Bar */}
              <div
                className={`rounded-2xl border p-3 flex items-center justify-between gap-2 shadow-2xs transition-colors ${
                  scaleStatus === "streaming"
                    ? scaleReading.isStable
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                    : "border-cyan-500/30 bg-cyan-500/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`size-2.5 rounded-full shrink-0 ${
                      scaleStatus === "streaming"
                        ? scaleReading.isStable
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-amber-500 animate-ping"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-extrabold text-foreground">
                        {scaleStatus === "streaming"
                          ? `Live Scale: ${scaleReading.weightKg.toFixed(3)} kg`
                          : "Weighing Scale: Standby / Not Connected"}
                      </p>
                      {scaleConfig.handsFreeMode && scaleStatus === "streaming" && (
                        <Badge className="bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold px-1.5 py-0">
                          ⚡ Hands-Free Mode
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {scaleStatus === "streaming"
                        ? scaleReading.isStable
                          ? "● Stable reading locked to plate"
                          : "○ Weight reading in motion..."
                        : "Connect physical RS-232 / USB scale or simulator"}
                    </p>
                  </div>
                </div>

                {scaleStatus === "streaming" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white gap-1"
                      onClick={() => {
                        if (scaleReading.weightKg <= 0) {
                          toast.info("Please place seafood catch on the physical scale plate first.");
                          return;
                        }
                        setModalWeightInput(scaleReading.weightKg.toFixed(3));
                        toast.success(`Synced ${scaleReading.weightKg.toFixed(3)} kg from scale!`);
                      }}
                    >
                      <Scale className="size-3.5" /> Auto-Detect ({scaleReading.weightKg.toFixed(3)} kg)
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs font-semibold gap-1 shrink-0"
                    onClick={() => setScaleModalOpen(true)}
                  >
                    <Scale className="size-3.5 text-primary" /> Setup Scale
                  </Button>
                )}
              </div>

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
                    type="text"
                    inputMode="decimal"
                    value={modalWeightInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setModalWeightInput(val);
                      }
                    }}
                    placeholder="1.0"
                    className="h-12 text-center font-mono text-2xl font-black rounded-xl"
                  />
                  <span className="text-sm font-black text-muted-foreground shrink-0 font-mono">KG</span>
                </div>

                {/* Fine Delta Adjustment Steppers */}
                <div className="grid grid-cols-4 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-7 text-xs font-mono font-bold"
                    onClick={() => adjustWeightByDelta(-100)}
                  >
                    -100g
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-7 text-xs font-mono font-bold"
                    onClick={() => adjustWeightByDelta(-50)}
                  >
                    -50g
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-7 text-xs font-mono font-bold"
                    onClick={() => adjustWeightByDelta(50)}
                  >
                    +50g
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-7 text-xs font-mono font-bold"
                    onClick={() => adjustWeightByDelta(100)}
                  >
                    +100g
                  </Button>
                </div>

                {/* Quick Weight Preset Chips with Custom Chips Manager */}
                <div className="space-y-1.5 pt-1">
                  {(() => {
                    const isCustomForThis =
                      typeof window !== "undefined" &&
                      Boolean(localStorage.getItem(`fnf_pos_chips_${activeItemModal.id}`));
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-muted-foreground">Portion Chips:</span>
                          {isCustomForThis ? (
                            <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                              Custom for {activeItemModal.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                              Universal Store Presets
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isCustomForThis && (
                            <button
                              type="button"
                              onClick={() => {
                                localStorage.removeItem(`fnf_pos_chips_${activeItemModal.id}`);
                                setActiveChips(getStoredQuickChips());
                                toast.success("Restored universal chips for this item");
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline"
                            >
                              Revert Universal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowChipEditor(!showChipEditor)}
                            className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                          >
                            <Sliders className="size-3" />
                            {showChipEditor ? "Done" : "Configure"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Inline Custom Chip Editor */}
                  {showChipEditor && (
                    <div className="p-2.5 rounded-2xl bg-muted/60 border border-border/80 space-y-2 animate-in fade-in-50 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                        <span>Add Custom Portion Chip:</span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setChipScope("global")}
                            className={`px-1.5 py-0.5 rounded ${chipScope === "global" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            All Products
                          </button>
                          <button
                            type="button"
                            onClick={() => setChipScope("product")}
                            className={`px-1.5 py-0.5 rounded ${chipScope === "product" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            This Fish Only
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Weight (e.g. 0.4, 1.25)"
                          value={chipInputVal}
                          onChange={(e) => setChipInputVal(e.target.value)}
                          className="h-7 text-xs font-mono bg-background rounded-lg flex-1"
                        />
                        <Input
                          placeholder="Label (e.g. 400g)"
                          value={chipInputLabel}
                          onChange={(e) => setChipInputLabel(e.target.value)}
                          className="h-7 text-xs bg-background rounded-lg flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddCustomChip}
                          className="h-7 px-2.5 text-xs font-bold rounded-lg"
                        >
                          <Plus className="size-3 mr-0.5" /> Add
                        </Button>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-border/40 text-[10px]">
                        <span className="text-muted-foreground">Click (×) on any chip to remove</span>
                        <button
                          type="button"
                          onClick={handleResetDefaultChips}
                          className="text-amber-600 hover:underline font-medium"
                        >
                          Reset Defaults
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Render Quick Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {activeChips.map((chip) => (
                      <div key={`${chip.val}-${chip.label}`} className="inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => setModalWeightInput(chip.val.toString())}
                          className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                            modalWeight === chip.val
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "bg-muted/50 hover:bg-muted text-foreground border border-border/60"
                          } ${showChipEditor ? "rounded-r-none border-r-0" : ""}`}
                        >
                          {chip.label}
                        </button>
                        {showChipEditor && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomChip(chip.val)}
                            className="h-[27px] px-1 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-r-xl border border-l-0 border-border/60 text-xs transition-colors flex items-center justify-center"
                            title="Remove chip"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2D Size & Color Variant Matrix Selection */}
              {activeItemModal.variants && activeItemModal.variants.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" /> Size & Color Variant
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {activeItemModal.variants.map((v: any) => {
                      const isSel = (modalSelectedVariant?.id || activeItemModal.variants?.[0]?.id) === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setModalSelectedVariant(v)}
                          className={`text-left p-2.5 rounded-xl text-xs transition-all ${
                            isSel
                              ? "bg-primary/10 border-primary text-primary font-bold border ring-1 ring-primary/20"
                              : "bg-card border border-border/70 hover:border-primary/40 text-muted-foreground"
                          }`}
                        >
                          <div className="font-bold text-foreground">
                            {v.size ? `Size: ${v.size} ` : ""}{v.color ? `· ${v.color}` : ""}
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5 font-mono">
                            <span className="text-primary font-semibold">{formatINR(Number(v.price))}</span>
                            <span>Stock: {v.stock}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mandatory Serial / IMEI Number Entry */}
              {activeItemModal.requires_serial && (
                <div className="space-y-2 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <ScanLine className="size-3.5 text-blue-500" />
                      Capture Serial / IMEI Number(s)
                    </label>
                    <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                      {((activeItemModal.unit || "kg").toLowerCase() === "kg" ? 1 : Math.round(modalWeight))} required
                    </span>
                  </div>
                  <Input
                    value={modalSerialInput}
                    onChange={(e) => setModalSerialInput(e.target.value)}
                    placeholder="Scan barcode gun or type IMEI / Serial (comma separated)"
                    className="h-8 text-xs font-mono bg-background rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Hardware barcode gun supported. Serial is printed on the GST tax invoice.
                  </p>
                </div>
              )}

              {/* Cutting & Cleaning Style Selection (For Meat & Seafood) */}
              {((activeItemModal.unit || "kg").toLowerCase() === "kg" || 
                (activeItemModal.category && /fish|meat|chicken|seafood/i.test(activeItemModal.category))) && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Scissors className="size-3.5 text-primary" /> Cleaning &amp; Cutting Style
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
              )}

              {/* Add to Bill Button */}
              <Button
                type="button"
                onClick={handleAddToCart}
                className="w-full rounded-2xl h-11 text-sm font-bold shadow-md gap-2"
              >
                <span>
                  Add {((activeItemModal.unit || "kg").toLowerCase() === "kg" ? `${modalWeightInput || "0"} kg` : `${Math.round(modalWeight)} pcs`)} to Bill · {formatINR(Math.round((modalSelectedVariant ? Number(modalSelectedVariant.price) : Number(activeItemModal.price)) * modalWeight))}
                </span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Universal Quick Chips Manager Modal */}
      <Dialog open={globalChipModalOpen} onOpenChange={setGlobalChipModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sliders className="size-5 text-primary" />
              Universal Quick Portion Chips Manager
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure store-wide universal portion weight chips used across all seafood and meat items at the POS counter.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Add Universal Chip Form */}
            <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/80 space-y-2">
              <span className="text-xs font-bold text-foreground">Add Universal Portion Preset:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Weight in kg (e.g. 0.4, 1.25, 2.5)"
                  value={newGlobalVal}
                  onChange={(e) => setNewGlobalVal(e.target.value)}
                  className="h-8 text-xs font-mono bg-background rounded-xl flex-1"
                />
                <Input
                  placeholder="Label (e.g. 400g, 1.25 kg)"
                  value={newGlobalLabel}
                  onChange={(e) => setNewGlobalLabel(e.target.value)}
                  className="h-8 text-xs bg-background rounded-xl flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddGlobalChip}
                  className="h-8 px-3 text-xs font-bold rounded-xl"
                >
                  <Plus className="size-3.5 mr-1" /> Add Chip
                </Button>
              </div>
            </div>

            {/* Current Universal Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>Active Universal Chips ({globalChips.length}):</span>
                <button
                  type="button"
                  onClick={handleResetUniversalChips}
                  className="text-amber-600 hover:underline font-semibold"
                >
                  Reset Standard Defaults
                </button>
              </div>

              <div className="flex flex-wrap gap-2 p-3 rounded-2xl border border-border/70 bg-card">
                {globalChips.map((c) => (
                  <div
                    key={`${c.val}-${c.label}`}
                    className="inline-flex items-center rounded-xl bg-muted/60 border border-border/80 text-xs font-mono font-bold"
                  >
                    <span className="px-2.5 py-1 text-foreground">
                      {c.label} ({c.val} kg)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteGlobalChip(c.val)}
                      className="px-1.5 py-1 text-destructive hover:bg-destructive/10 rounded-r-xl border-l border-border/60 transition"
                      title="Remove this universal chip"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Overrides Reset Option */}
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2 text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                Custom Product Overrides in Storage:
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                If you previously set custom chips on specific items (e.g. Large Vanjaram or Crab), you can reset all products to strictly adhere to the universal list above.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300 text-amber-800 dark:text-amber-200 rounded-xl"
                onClick={handleClearAllCustomOverrides}
              >
                Clear All Per-Product Overrides
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held / Parked Carts Dialog */}
      <Dialog open={parkedModalOpen} onOpenChange={setParkedModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Bookmark className="size-5 text-amber-500" />
              Held Counter Bills ({parkedCarts.length})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Temporary held customer orders. Resume any bill when the customer is ready to checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pt-2">
            {parkedCarts.map((p) => {
              const pTotal = p.cart.reduce((s, it) => s + it.totalPrice, 0) - p.discountAmount;
              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl border border-border/80 bg-card flex items-center justify-between gap-3 shadow-xs hover:border-primary/40 transition"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground truncate">{p.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.cart.length} item(s) · {formatINR(pTotal)} · Held at {p.timestamp}
                    </p>
                    {p.customerPhone && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Phone: {p.customerPhone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleResumeParkedCart(p)}
                      className="rounded-xl h-8 text-xs font-bold bg-primary text-primary-foreground"
                    >
                      Resume Bill
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteParkedCart(p.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      title="Discard held bill"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {parkedCarts.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                <Bookmark className="size-8 mx-auto opacity-30 text-amber-500" />
                <p>No held bills currently</p>
                <p className="text-[10px]">Use "Hold [F4]" while billing to park a customer cart</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* POS Past Bills & Sales Register Modal */}
      <PosPastBillsModal
        open={pastBillsModalOpen}
        onOpenChange={setPastBillsModalOpen}
        storeSettings={settings}
      />

      {/* Bluetooth & USB ESC/POS Printer Pairing Modal */}
      <PrinterSettingsModal
        open={printerModalOpen}
        onOpenChange={setPrinterModalOpen}
      />

      {/* Electronic Weighing Scale Hardware Hub Modal */}
      <Dialog open={scaleModalOpen} onOpenChange={setScaleModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="size-5 text-primary" /> Electronic Weighing Scale Hardware Hub
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Direct RS-232 / USB / Bluetooth digital scale protocol driver (CAS, Essae, Toledo, Avery, NCI).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Digital Weight Terminal Display */}
            <div className="rounded-2xl border-2 border-primary/40 bg-zinc-950 p-4 text-center text-white shadow-inner font-mono relative overflow-hidden">
              <div className="flex justify-between items-center text-[10px] text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-800">
                <span className="flex items-center gap-1">
                  <span
                    className={`size-2 rounded-full ${
                      scaleStatus === "streaming" ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                    }`}
                  />
                  {scaleStatus === "streaming" ? "PORT ACTIVE" : "STANDBY"}
                </span>
                <span
                  className={
                    scaleReading.isStable ? "text-emerald-400 font-bold" : "text-amber-400 animate-pulse"
                  }
                >
                  {scaleReading.isStable ? "● STABLE" : "○ MOTION"}
                </span>
                <span>NET WEIGHT</span>
              </div>

              <div className="py-3 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black tracking-tight text-emerald-400 tabular-nums">
                  {scaleReading.weightKg.toFixed(3)}
                </span>
                <span className="text-xl font-bold text-zinc-400">KG</span>
              </div>

              <div className="text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800 flex flex-wrap justify-between gap-2">
                <span>Protocol: <strong className="text-zinc-200">{scaleReading.protocol.toUpperCase()}</strong></span>
                <span>Tare: <strong className="text-zinc-200">{scaleReading.tareKg.toFixed(3)} kg</strong></span>
                <span>Gross: <strong className="text-zinc-200">{scaleReading.rawWeightKg.toFixed(3)} kg</strong></span>
              </div>
            </div>

            {/* Hardware Port Connection & Protocol Profiles */}
            <div className="space-y-3 rounded-2xl border border-border/80 p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Activity className="size-3.5 text-primary" /> RS-232 / USB Serial Configuration
                </span>
                <Badge
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    scaleStatus === "streaming"
                      ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      : scaleStatus === "connected"
                      ? "bg-cyan-500/15 text-cyan-600 border-cyan-500/30"
                      : "bg-zinc-500/15 text-zinc-600 border-zinc-500/30"
                  }`}
                >
                  {scaleStatus}
                </Badge>
              </div>

              {isScaleSupported ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Protocol Profile Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Scale Model Profile
                      </label>
                      <select
                        value={scaleConfig.protocol}
                        onChange={(e) => {
                          const proto = e.target.value as ScaleProtocol;
                          const newCfg = weighingScaleDriver.saveConfig({ protocol: proto });
                          setScaleConfig(newCfg);
                        }}
                        className="flex h-8.5 w-full rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-medium"
                      >
                        <option value="auto">Auto-Detect / Generic ASCII</option>
                        <option value="essae">Essae-Teraoka (India DS-852 / 215)</option>
                        <option value="cas">CAS Corporation (PD-II / SW-1)</option>
                        <option value="toledo">Mettler Toledo (Continuous / 8217)</option>
                        <option value="nci">NCI / Fairbanks Standard</option>
                        <option value="avery">Avery Berkel / Weigh-Tronix</option>
                      </select>
                    </div>

                    {/* Baud Rate Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Baud Rate</label>
                      <select
                        value={scaleConfig.baudRate}
                        onChange={(e) => {
                          const baud = Number(e.target.value);
                          const newCfg = weighingScaleDriver.saveConfig({ baudRate: baud });
                          setScaleConfig(newCfg);
                        }}
                        className="flex h-8.5 w-full rounded-xl border border-input bg-background px-2.5 py-1 text-xs font-mono"
                      >
                        <option value={9600}>9600 Baud (Standard CAS / Essae)</option>
                        <option value={2400}>2400 Baud (Mettler Toledo)</option>
                        <option value={4800}>4800 Baud (Avery Berkel)</option>
                        <option value={19200}>19200 Baud (High Speed)</option>
                        <option value={38400}>38400 Baud</option>
                        <option value={115200}>115200 Baud (USB CDC)</option>
                      </select>
                    </div>
                  </div>

                  {/* Serial Parameters Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Data Bits</label>
                      <select
                        value={scaleConfig.dataBits}
                        onChange={(e) => {
                          const bits = Number(e.target.value) as 7 | 8;
                          const newCfg = weighingScaleDriver.saveConfig({ dataBits: bits });
                          setScaleConfig(newCfg);
                        }}
                        className="flex h-8 w-full rounded-xl border border-input bg-background px-2 py-1 text-xs font-mono"
                      >
                        <option value={8}>8 Bits (Standard)</option>
                        <option value={7}>7 Bits (Toledo)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Parity</label>
                      <select
                        value={scaleConfig.parity}
                        onChange={(e) => {
                          const p = e.target.value as "none" | "even" | "odd";
                          const newCfg = weighingScaleDriver.saveConfig({ parity: p });
                          setScaleConfig(newCfg);
                        }}
                        className="flex h-8 w-full rounded-xl border border-input bg-background px-2 py-1 text-xs font-mono"
                      >
                        <option value="none">None (8-N-1)</option>
                        <option value="even">Even (7-E-1)</option>
                        <option value="odd">Odd</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Stop Bits</label>
                      <select
                        value={scaleConfig.stopBits}
                        onChange={(e) => {
                          const sb = Number(e.target.value) as 1 | 2;
                          const newCfg = weighingScaleDriver.saveConfig({ stopBits: sb });
                          setScaleConfig(newCfg);
                        }}
                        className="flex h-8 w-full rounded-xl border border-input bg-background px-2 py-1 text-xs font-mono"
                      >
                        <option value={1}>1 Stop Bit</option>
                        <option value={2}>2 Stop Bits</option>
                      </select>
                    </div>
                  </div>

                  {/* Hardware Feature Switches */}
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">⚡ Hands-Free Zero-Keypress Auto-Capture</p>
                        <p className="text-[10px] text-muted-foreground">
                          Auto-locks weight & plays audio chime when platter stabilizes (≥ 20g)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={scaleConfig.handsFreeMode}
                        onChange={(e) => {
                          const newCfg = weighingScaleDriver.saveConfig({ handsFreeMode: e.target.checked });
                          setScaleConfig(newCfg);
                        }}
                        className="size-4.5 rounded accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">Active Auto-Polling Heartbeat</p>
                        <p className="text-[10px] text-muted-foreground">
                          Periodically queries command-mode scales (W\r\n / ENQ) every 250ms
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={scaleConfig.autoPoll}
                        onChange={(e) => {
                          const newCfg = weighingScaleDriver.saveConfig({ autoPoll: e.target.checked });
                          setScaleConfig(newCfg);
                        }}
                        className="size-4.5 rounded accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">Persistent Auto-Connect</p>
                        <p className="text-[10px] text-muted-foreground">
                          Automatically opens remembered scale COM port when POS launches
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={scaleConfig.autoReconnect}
                        onChange={(e) => {
                          const newCfg = weighingScaleDriver.saveConfig({ autoReconnect: e.target.checked });
                          setScaleConfig(newCfg);
                        }}
                        className="size-4.5 rounded accent-primary cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Connection Trigger Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {scaleStatus === "streaming" || scaleStatus === "connected" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8.5 rounded-xl text-xs font-bold w-full"
                        onClick={() => {
                          weighingScaleDriver.disconnect();
                          toast.info("Weighing scale disconnected");
                        }}
                      >
                        Disconnect Port
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8.5 rounded-xl text-xs font-bold w-full bg-primary text-primary-foreground"
                        onClick={async () => {
                          const ok = await weighingScaleDriver.connectSerial(scaleConfig);
                          if (ok) {
                            toast.success("Scale connected & streaming live weight!");
                          }
                        }}
                      >
                        Select Port &amp; Connect
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-8.5 text-xs font-bold border-border/80"
                      onClick={() => {
                        weighingScaleDriver.tare();
                        toast.success("Tare command sent to scale");
                      }}
                    >
                      Tare Platter (T)
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-8.5 text-xs font-bold border-border/80"
                      onClick={() => {
                        weighingScaleDriver.zero();
                        toast.success("Zero command sent to scale");
                      }}
                    >
                      Zero Scale (Z)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  <p className="font-bold">Web Serial API not supported in this browser.</p>
                  <p className="text-[11px] mt-0.5">
                    Please open Fish N Fresh in Google Chrome, Microsoft Edge, or Opera on Windows/macOS/Linux to communicate directly with physical RS-232 / USB scale COM ports.
                  </p>
                </div>
              )}
            </div>

            {/* Live Serial Packet Diagnostic Monitor */}
            <div className="space-y-1.5 rounded-2xl border border-border/80 p-3 bg-muted/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-primary" /> Live Raw Packet Monitor (Hex/ASCII)
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {rawStreamLog.length} packets logged
                </span>
              </div>

              <div className="rounded-xl bg-zinc-950 p-2.5 font-mono text-[11px] text-emerald-400 max-h-24 overflow-y-auto space-y-0.5 border border-zinc-800">
                {rawStreamLog.length > 0 ? (
                  rawStreamLog.map((line, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-zinc-600 select-none">{String(idx + 1).padStart(2, "0")}:</span>
                      <span className="truncate">{line}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 text-center py-2">
                    {scaleStatus === "streaming"
                      ? "Awaiting scale packets on serial line..."
                      : "Connect physical scale or use testing simulator below"}
                  </div>
                )}
              </div>
            </div>

            {/* Scale Testing & Simulator (Useful for testing without physical scale hardware) */}
            <div className="space-y-2 rounded-2xl border border-border/80 p-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Hardware Simulation (Testing Mode)</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-bold text-primary hover:bg-primary/10 gap-1 px-2"
                  onClick={() => {
                    // Simulate motion then stabilization to test hands-free auto-capture
                    weighingScaleDriver.simulateReading(0.85, false);
                    toast.info("Simulating seafood moving on scale plate...");
                    setTimeout(() => {
                      weighingScaleDriver.simulateReading(0.85, true);
                      toast.success("Platter stabilized! Hands-free auto-capture triggered!");
                    }, 400);
                  }}
                >
                  <Zap className="size-3" /> Simulate Motion → Stable
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[0.15, 0.35, 0.5, 0.75, 1.0, 1.5, 2.25, 3.5].map((w) => (
                  <Button
                    key={w}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-mono"
                    onClick={() => {
                      weighingScaleDriver.simulateReading(w, true);
                      toast.success(`Simulated scale weight: ${w} kg`);
                    }}
                  >
                    {w} kg
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  step="0.005"
                  value={simWeightInput}
                  onChange={(e) => setSimWeightInput(e.target.value)}
                  placeholder="Custom kg"
                  className="h-8 text-xs font-mono rounded-xl flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-xl text-xs font-bold"
                  onClick={() => {
                    const n = parseFloat(simWeightInput) || 0;
                    weighingScaleDriver.simulateReading(n, true);
                    toast.success(`Injected scale reading: ${n} kg`);
                  }}
                >
                  Inject
                </Button>
              </div>
            </div>

            <Button
              type="button"
              className="w-full rounded-xl font-bold h-9"
              onClick={() => setScaleModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Barcode Scanner Modal */}
      <BarcodeCameraModal
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleBarcodeDetected}
      />
    </AdminShell>
  );
}

export default RetailPosCounterPage;
