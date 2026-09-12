import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import { toast } from "sonner";
import {
  Anchor,
  Plus,
  Search,
  Printer,
  Calendar,
  Phone,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  Building2,
  DollarSign,
  PackagePlus,
  Trash2,
  Eye,
  X,
  ExternalLink,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Landmark,
  Scale,
  ShieldAlert,
  Snowflake,
  AlertOctagon,
  TrendingUp,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  Clock,
  Check,
} from "lucide-react";
import {
  createInwardBatch,
  updateBatchStatus,
  executeBatchRecall,
  type BatchRecallReport,
} from "@/lib/batches.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatIST, formatStockDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import {
  printSupplierLedgerPdf,
  type SupplierLedgerEntry,
  type SupplierOutstandingBill,
  type SupplierStatementData,
} from "@/lib/supplierLedgerPdf";
import type { Supplier, PurchaseOrder, PurchaseItem, Product, SupplierPaymentRecord } from "@/lib/types";

export interface PurchaseRequestOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_phone?: string;
  supplier_whatsapp?: string;
  expected_delivery_date: string;
  status: "draft" | "sent" | "partially_received" | "completed" | "cancelled";
  items: {
    product_id: string;
    product_name: string;
    suggested_qty: number;
    unit: string;
    estimated_rate: number;
    current_stock: number;
  }[];
  total_estimated_cost: number;
  notes: string;
  created_at: string;
}

const DEFAULT_PURCHASE_REQUESTS: PurchaseRequestOrder[] = [
  {
    id: "req-101",
    po_number: "PO-2026-0901",
    supplier_id: "sup-1",
    supplier_name: "Kasimedu Deep Sea Fishermen Society",
    supplier_phone: "9843061919",
    supplier_whatsapp: "9843061919",
    expected_delivery_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: "sent",
    items: [
      {
        product_id: "prod-vanjaram",
        product_name: "Vanjaram / Seer Fish (Large King)",
        suggested_qty: 35,
        unit: "kg",
        estimated_rate: 680,
        current_stock: 4.5,
      },
      {
        product_id: "prod-sanki",
        product_name: "Sankara / Red Snapper (Whole)",
        suggested_qty: 25,
        unit: "kg",
        estimated_rate: 340,
        current_stock: 2,
      },
    ],
    total_estimated_cost: 32300,
    notes: "Direct Kasimedu landing 5:30 AM. Strictly chemical-free on crushed sea ice.",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "req-102",
    po_number: "PO-2026-0902",
    supplier_id: "sup-3",
    supplier_name: "Cochin Prawns & Crab Traders",
    supplier_phone: "9847054321",
    supplier_whatsapp: "9847054321",
    expected_delivery_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    status: "draft",
    items: [
      {
        product_id: "prod-prawn",
        product_name: "Tiger Prawns (Jumbo 20/30 count)",
        suggested_qty: 30,
        unit: "kg",
        estimated_rate: 420,
        current_stock: 0,
      },
    ],
    total_estimated_cost: 12600,
    notes: "High weekend demand anticipated. Export grade.",
    created_at: new Date().toISOString(),
  },
];

export const Route = createFileRoute("/_authenticated/admin/purchases")({
  head: () => ({
    meta: [
      { title: "Supplier Purchases & Catch Inward | Fish N Fresh Admin" },
      { name: "description", content: "Harbour catch purchases, supplier ledger, auto-stock refill and payment statements." },
    ],
  }),
  component: PurchasesAdmin,
});

const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Kasimedu Deep Sea Fishermen Society",
    harbour: "Kasimedu Harbour, Chennai",
    contact_person: "Muthu Pandi",
    phone: "9843061919",
    whatsapp: "9843061919",
    email: "kasimedu.catch@gmail.com",
    gstin: "33AABCT1234F1Z5",
    upi_id: "muthupandi@oksbi",
    balance_due: 15400,
    created_at: new Date().toISOString(),
  },
  {
    id: "sup-2",
    name: "Rameswaram Coastal Fresh Trawlers",
    harbour: "Rameswaram Jetty",
    contact_person: "Kalyan Sundaram",
    phone: "9443123456",
    whatsapp: "9443123456",
    email: "rameswaram.fish@outlook.com",
    gstin: "33AABCR9876G1Z2",
    upi_id: "rameswaramtrawlers@upi",
    balance_due: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "sup-3",
    name: "Cochin Prawns & Crab Traders",
    harbour: "Cochin Fisheries Harbour",
    contact_person: "Varghese Joseph",
    phone: "9847054321",
    whatsapp: "9847054321",
    email: "cochinfresh@gmail.com",
    upi_id: "cochinprawns@okhdfcbank",
    balance_due: 8200,
    created_at: new Date().toISOString(),
  },
];

function PurchasesAdmin() {
  const qc = useQueryClient();
  const productsQueryObj = useQuery(adminProductsQuery());
  const products = productsQueryObj.data ?? [];

  // Local storage backed state with fallback
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem("fnf_suppliers");
      return saved ? JSON.parse(saved) : DEFAULT_SUPPLIERS;
    } catch {
      return DEFAULT_SUPPLIERS;
    }
  });

  const [purchases, setPurchases] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem("fnf_purchases");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: "po-101",
        reference_no: "INW-8821",
        supplier_id: "sup-1",
        supplier_name: "Kasimedu Deep Sea Fishermen Society",
        supplier_phone: "9843061919",
        inward_date: new Date().toISOString().slice(0, 10),
        items: [
          {
            product_id: "vanjaram",
            product_name: "Vanjaram / Seer Fish (Catch)",
            quantity: 50,
            unit: "kg",
            cost_per_unit: 420,
            total_cost: 21000,
          },
          {
            product_id: "prawns",
            product_name: "Tiger Prawns (Large)",
            quantity: 20,
            unit: "kg",
            cost_per_unit: 380,
            total_cost: 7600,
          },
        ],
        total_amount: 28600,
        paid_amount: 15000,
        payment_status: "partial",
        payment_method: "upi",
        notes: "Boat: Sri Murugan Trawler. Morning 4 AM catch.",
        created_at: new Date().toISOString(),
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem("fnf_suppliers", JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem("fnf_purchases", JSON.stringify(purchases));
  }, [purchases]);

  // Form State: New Inward Catch
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [inwardDate, setInwardDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [autoRefillStock, setAutoRefillStock] = useState<boolean>(true);
  const [purchaseNotes, setPurchaseNotes] = useState<string>("");
  const [inwardItems, setInwardItems] = useState<
    { product_id: string; product_name: string; quantity: string; unit: string; cost_per_unit: string }[]
  >([{ product_id: "", product_name: "", quantity: "20", unit: "kg", cost_per_unit: "350" }]);

  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "bank" | "credit">("cash");

  // Payment transactions history
  const [payments, setPayments] = useState<SupplierPaymentRecord[]>(() => {
    try {
      const saved = localStorage.getItem("fnf_supplier_payments");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "pay-101",
        supplier_id: "sup-1",
        supplier_name: "Kasimedu Deep Sea Fishermen Society",
        po_id: "po-101",
        po_reference: "INW-8821",
        payment_date: new Date().toISOString().slice(0, 10),
        amount: 15000,
        payment_mode: "partial",
        payment_method: "upi",
        reference_no: "UPI/38291049281",
        notes: "Morning catch advance disbursement",
        created_at: new Date().toISOString(),
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem("fnf_supplier_payments", JSON.stringify(payments));
  }, [payments]);

  // Filter state for ledger and statements
  const [searchLedger, setSearchLedger] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [activeTab, setActiveTab] = useState<"ledger" | "outstanding" | "new" | "po_requests" | "suppliers" | "batches">("ledger");
  const [statementSupplierFilter, setStatementSupplierFilter] = useState<string>("all");

  // Purchase Orders & Demand Radar State
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestOrder[]>(() => {
    try {
      const saved = localStorage.getItem("fnf_purchase_orders");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PURCHASE_REQUESTS;
  });

  useEffect(() => {
    localStorage.setItem("fnf_purchase_orders", JSON.stringify(purchaseRequests));
  }, [purchaseRequests]);

  const [newPoModalOpen, setNewPoModalOpen] = useState(false);
  const [selectedPoForView, setSelectedPoForView] = useState<PurchaseRequestOrder | null>(null);
  const [poFormSupplierId, setPoFormSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [poFormDeliveryDate, setPoFormDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [poFormNotes, setPoFormNotes] = useState<string>("Morning harbour landing 05:30 AM. Chemical-free on ice.");
  const [poFormItems, setPoFormItems] = useState<
    { product_id: string; product_name: string; suggested_qty: number; unit: string; estimated_rate: number; current_stock: number }[]
  >([]);

  // Calculate Demand Radar recommendations from active catalogue
  const demandRadarItems = useMemo(() => {
    return products
      .filter((p) => Number(p.stock) <= 15 || p.is_bestseller || p.is_featured)
      .map((p) => {
        const stock = Number(p.stock) || 0;
        let urgency: "critical" | "urgent" | "high_demand" = "high_demand";
        let suggestedQty = 25;

        if (stock === 0) {
          urgency = "critical";
          suggestedQty = 40;
        } else if (stock <= 10) {
          urgency = "urgent";
          suggestedQty = 30;
        } else if (p.is_bestseller) {
          urgency = "high_demand";
          suggestedQty = 25;
        }

        const pName = p.name.toLowerCase();
        let matchedSupplier = suppliers[0];
        if (pName.includes("prawn") || pName.includes("shrimp") || pName.includes("crab") || pName.includes("lobster")) {
          matchedSupplier = suppliers.find((s) => s.id === "sup-3") || suppliers[0];
        } else if (pName.includes("squid") || pName.includes("nethili") || pName.includes("anchovy") || pName.includes("sardine")) {
          matchedSupplier = suppliers.find((s) => s.id === "sup-2") || suppliers[0];
        } else {
          matchedSupplier = suppliers.find((s) => s.id === "sup-1") || suppliers[0];
        }

        const estRate = (p as any).cost_price ? Number((p as any).cost_price) : Math.round(Number(p.price) * 0.7);

        return {
          product: p,
          stock,
          urgency,
          suggestedQty,
          matchedSupplier,
          estRate,
        };
      })
      .sort((a, b) => {
        const order = { critical: 0, urgent: 1, high_demand: 2 };
        return order[a.urgency] - order[b.urgency] || a.stock - b.stock;
      });
  }, [products, suppliers]);

  const sendPoWhatsApp = (po: PurchaseRequestOrder) => {
    const supplier = suppliers.find((s) => s.id === po.supplier_id);
    const phone = supplier?.whatsapp || supplier?.phone || po.supplier_phone || "9843061919";
    const cleaned = phone.replace(/\D/g, "");
    const waNumber = cleaned.length === 10 ? `91${cleaned}` : cleaned;

    const itemsText = po.items
      .map((it, idx) => `${idx + 1}. *${it.product_name}* — ${it.suggested_qty} ${it.unit} (~₹${it.estimated_rate}/${it.unit})`)
      .join("\n");

    const text = `📋 *PURCHASE ORDER (P.O.) — FISH N FRESH CHENNAI*
*PO Ref:* ${po.po_number}
*Date:* ${new Date(po.created_at).toLocaleDateString("en-IN")}
*Supplier:* ${po.supplier_name}
*Required Arrival:* ${po.expected_delivery_date || "Tomorrow 06:00 AM Dock Landing"}

*Requested Catch Items:*
${itemsText}

*Estimated Outlay:* ₹${po.total_estimated_cost.toLocaleString("en-IN")}
*Quality Mandate:* 100% Chemical-free, strictly chilled on crushed sea-ice (0–4°C).
*Instructions:* ${po.notes || "Please reply to confirm boat landing & dispatch rate."}

_Generated via Fish N Fresh Hub Purchasing System_`;

    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    toast.success(`Opening WhatsApp to send PO #${po.po_number} to ${po.supplier_name}`);
  };

  const convertPoToInward = (po: PurchaseRequestOrder) => {
    setSelectedSupplierId(po.supplier_id || suppliers[0]?.id || "");
    setInwardItems(
      po.items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: String(it.suggested_qty),
        unit: it.unit || "kg",
        cost_per_unit: String(it.estimated_rate),
      }))
    );
    setPurchaseNotes(`Inward fulfillment for Purchase Order #${po.po_number}.`);
    setAutoRefillStock(true);

    setPurchaseRequests((prev) =>
      prev.map((p) => (p.id === po.id ? { ...p, status: "completed" } : p))
    );

    setActiveTab("new");
    toast.success(`PO #${po.po_number} converted into Inward Catch form! Ready to record dock delivery.`);
  };

  const handleQuickAddDemandToPo = (item: (typeof demandRadarItems)[0]) => {
    setPoFormSupplierId(item.matchedSupplier?.id || suppliers[0]?.id || "");
    setPoFormItems([
      {
        product_id: item.product.id,
        product_name: item.product.name,
        suggested_qty: item.suggestedQty,
        unit: item.product.unit || "kg",
        estimated_rate: item.estRate,
        current_stock: item.stock,
      },
    ]);
    setNewPoModalOpen(true);
  };

  // Batch Traceability & Food Safety State
  const { data: inventoryBatches = [], refetch: refetchBatches } = useQuery({
    queryKey: ["admin", "inventory-batches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  const [batchRecallModalOpen, setBatchRecallModalOpen] = useState(false);
  const [selectedRecallBatch, setSelectedRecallBatch] = useState<string>("");
  const [recallReport, setRecallReport] = useState<BatchRecallReport | null>(null);
  const [isRecalling, setIsRecalling] = useState(false);

  const [newBatchModalOpen, setNewBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    batchNumber: `LOT-KAS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 90 + 10)}`,
    productId: "",
    productName: "",
    supplierName: "Kasimedu Deep Sea Fishermen Society",
    catchDate: new Date().toISOString().slice(0, 10),
    catchHarbour: "Kasimedu Harbour, Chennai",
    boatNumber: "TN-02-MM-1092",
    initialQuantity: "40",
    unit: "kg",
    coldChainTempCelsius: "-1.8",
    shelfLifeHours: "72",
    qualityGrade: "Grade A+ (Export Quality)",
    notes: "Direct dockside purchase on ice.",
  });

  // Modals
  const [viewVoucher, setViewVoucher] = useState<PurchaseOrder | null>(null);
  const [openAddSupplier, setOpenAddSupplier] = useState(false);
  
  // Enhanced Payment Disburse Modal State
  const [recordPaymentOrder, setRecordPaymentOrder] = useState<PurchaseOrder | null>(null);
  const [paymentMode, setPaymentMode] = useState<"full" | "partial">("full");
  const [additionalPayment, setAdditionalPayment] = useState<string>("");
  const [paymentDisburseMethod, setPaymentDisburseMethod] = useState<"cash" | "upi" | "bank" | "cheque">("upi");
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: "",
    harbour: "Kasimedu Harbour, Chennai",
    contact_person: "",
    phone: "",
    whatsapp: "",
    email: "",
    gstin: "",
    upi_id: "",
  });

  // Calculate total amount for the current inward form
  const computedTotal = inwardItems.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const c = Number(item.cost_per_unit) || 0;
    return acc + q * c;
  }, 0);

  const computedPaid = Number(paidAmount) || 0;
  const computedBalance = Math.max(0, computedTotal - computedPaid);

  // Add item row
  const addItemRow = () => {
    setInwardItems([
      ...inwardItems,
      { product_id: "", product_name: "", quantity: "10", unit: "kg", cost_per_unit: "300" },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (inwardItems.length <= 1) return;
    setInwardItems(inwardItems.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    setInwardItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "product_id") {
          const matched = products.find((p) => p.id === value);
          return {
            ...item,
            product_id: value,
            product_name: matched?.name || "",
            unit: matched?.unit || "kg",
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Submit Inward Catch
  const handleSavePurchase = async () => {
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      toast.error("Supplier not found");
      return;
    }

    if (inwardItems.length === 0 || computedTotal <= 0) {
      toast.error("Please add at least one catch item with valid quantity and price");
      return;
    }

    const validItems: PurchaseItem[] = inwardItems.map((item, idx) => {
      const q = Number(item.quantity) || 0;
      const c = Number(item.cost_per_unit) || 0;
      return {
        product_id: item.product_id || `item-${idx}`,
        product_name: item.product_name || "Daily Seafood Catch",
        quantity: q,
        unit: item.unit || "kg",
        cost_per_unit: c,
        total_cost: q * c,
      };
    });

    const paymentStatus: "paid" | "partial" | "pending" =
      computedPaid >= computedTotal ? "paid" : computedPaid > 0 ? "partial" : "pending";

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      reference_no: `INW-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      supplier_phone: supplier.phone,
      inward_date: inwardDate,
      items: validItems,
      total_amount: computedTotal,
      paid_amount: computedPaid,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      notes: purchaseNotes.trim() || null,
      created_at: new Date().toISOString(),
    };

    // Auto update product stock in Supabase database if checked
    if (autoRefillStock) {
      for (const itm of validItems) {
        if (itm.product_id) {
          const prod = products.find((p) => p.id === itm.product_id);
          if (prod) {
            const currentStock = Number(prod.stock || 0);
            const newStock = currentStock + Number(itm.quantity);
            await supabase
              .from("products")
              .update({ stock: newStock, is_available: true } as any)
              .eq("id", itm.product_id);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    }

    // Update supplier balance due
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplier.id ? { ...s, balance_due: (s.balance_due || 0) + computedBalance } : s
      )
    );

    setPurchases([newPO, ...purchases]);
    toast.success(`Inward Catch saved! ${autoRefillStock ? "Stock levels increased." : ""}`);

    // Reset Form
    setInwardItems([{ product_id: "", product_name: "", quantity: "20", unit: "kg", cost_per_unit: "350" }]);
    setPaidAmount("0");
    setPurchaseNotes("");
    setActiveTab("ledger");
    setViewVoucher(newPO);
  };

  // Open Disburse Payment Modal with pre-configured full or partial mode
  const openPaymentModal = (po: PurchaseOrder, mode: "full" | "partial" = "full") => {
    const due = Math.max(0, po.total_amount - po.paid_amount);
    setRecordPaymentOrder(po);
    setPaymentMode(mode);
    setAdditionalPayment(mode === "full" ? due.toString() : "");
    setPaymentDisburseMethod("upi");
    setPaymentRefNumber("");
    setPaymentNotes("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
  };

  // Record full or partial payment against supplier purchase
  const handleRecordPayment = () => {
    if (!recordPaymentOrder) return;
    const addPay = Number(additionalPayment);
    const due = Math.max(0, recordPaymentOrder.total_amount - recordPaymentOrder.paid_amount);

    if (isNaN(addPay) || addPay <= 0) {
      toast.error("Please enter a valid payment amount greater than ₹0");
      return;
    }

    if (addPay > due) {
      toast.error(`Payment amount ₹${addPay} cannot exceed outstanding due of ${formatINR(due)}`);
      return;
    }

    const newPaid = recordPaymentOrder.paid_amount + addPay;
    const newStatus: "paid" | "partial" | "pending" =
      newPaid >= recordPaymentOrder.total_amount ? "paid" : "partial";

    // Create payment transaction record
    const newTxn: SupplierPaymentRecord = {
      id: `pay-${Date.now()}`,
      supplier_id: recordPaymentOrder.supplier_id,
      supplier_name: recordPaymentOrder.supplier_name,
      po_id: recordPaymentOrder.id,
      po_reference: recordPaymentOrder.reference_no,
      payment_date: paymentDate,
      amount: addPay,
      payment_mode: paymentMode,
      payment_method: paymentDisburseMethod,
      reference_no: paymentRefNumber.trim() || null,
      notes: paymentNotes.trim() || null,
      created_at: new Date().toISOString(),
    };

    setPayments((prev) => [newTxn, ...prev]);

    // Update Purchase Order
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === recordPaymentOrder.id ? { ...p, paid_amount: newPaid, payment_status: newStatus } : p
      )
    );

    // Update supplier balance
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === recordPaymentOrder.supplier_id
          ? { ...s, balance_due: Math.max(0, (s.balance_due || 0) - addPay) }
          : s
      )
    );

    toast.success(
      `Payment of ${formatINR(addPay)} (${paymentMode === "full" ? "Full Settlement" : "Partial"}) recorded via ${paymentDisburseMethod.toUpperCase()}!`
    );
    setRecordPaymentOrder(null);
    setAdditionalPayment("");
    setPaymentRefNumber("");
    setPaymentNotes("");
  };

  // Generate & Print Supplier Account Statement PDF
  const handleGenerateStatementPdf = (targetSupplierId?: string) => {
    const isAll = !targetSupplierId || targetSupplierId === "all";
    const targetSupplier = !isAll ? suppliers.find((s) => s.id === targetSupplierId) : null;
    const supplierName = targetSupplier ? targetSupplier.name : "All Seafood Suppliers (Consolidated)";

    const relevantPOs = !isAll
      ? purchases.filter((p) => p.supplier_id === targetSupplierId)
      : purchases;
    const relevantPayments = !isAll
      ? payments.filter((p) => p.supplier_id === targetSupplierId)
      : payments;

    type RawEvent = {
      date: string;
      referenceNo: string;
      description: string;
      type: "inward_catch" | "payment";
      debit: number;
      credit: number;
      paymentMethod?: string | null | undefined;
      paymentRef?: string | null | undefined;
      timestamp: number;
    };

    const rawEvents: RawEvent[] = [];

    // Catch Inward Debits
    relevantPOs.forEach((po) => {
      const summary = po.items.map((i) => `${i.product_name} (${i.quantity}${i.unit})`).join(", ");
      rawEvents.push({
        date: po.inward_date,
        referenceNo: po.reference_no,
        description: `Catch Inward: ${summary || "Harbour Seafood Catch"}`,
        type: "inward_catch",
        debit: po.total_amount,
        credit: 0,
        timestamp: new Date(po.inward_date).getTime() || Date.now(),
      });

      // Upfront payment on creation if not already in payments table
      if (po.paid_amount > 0 && !relevantPayments.some((pm) => pm.po_id === po.id)) {
        rawEvents.push({
          date: po.inward_date,
          referenceNo: po.reference_no,
          description: `Initial Settlement against #${po.reference_no}`,
          type: "payment",
          debit: 0,
          credit: po.paid_amount,
          paymentMethod: po.payment_method?.toUpperCase(),
          timestamp: (new Date(po.inward_date).getTime() || Date.now()) + 1,
        });
      }
    });

    // Payment Credits
    relevantPayments.forEach((pay) => {
      rawEvents.push({
        date: pay.payment_date,
        referenceNo: pay.po_reference || `PAY-${pay.id.slice(-4)}`,
        description: `Disbursement against #${pay.po_reference || "Bill"} (${
          pay.payment_mode === "full" ? "Full Settlement" : "Partial Payment"
        })${pay.notes ? ` - ${pay.notes}` : ""}`,
        type: "payment",
        debit: 0,
        credit: pay.amount,
        paymentMethod: pay.payment_method.toUpperCase(),
        paymentRef: pay.reference_no || undefined,
        timestamp: new Date(pay.payment_date).getTime() || Date.now(),
      });
    });

    // Sort chronologically ascending
    rawEvents.sort((a, b) => a.timestamp - b.timestamp);

    let running = 0;
    const ledgerEntries: SupplierLedgerEntry[] = rawEvents.map((evt) => {
      running += evt.debit - evt.credit;
      return {
        date: evt.date,
        referenceNo: evt.referenceNo,
        description: evt.description,
        type: evt.type,
        debit: evt.debit,
        credit: evt.credit,
        runningBalance: running,
        paymentMethod: evt.paymentMethod,
        paymentRef: evt.paymentRef,
      };
    });

    const now = Date.now();
    const outstandingBills: SupplierOutstandingBill[] = relevantPOs
      .filter((po) => po.total_amount > po.paid_amount)
      .map((po) => {
        const d = new Date(po.inward_date).getTime();
        const ageDays = Math.max(0, Math.floor((now - d) / (1000 * 60 * 60 * 24)));
        return {
          referenceNo: po.reference_no,
          inwardDate: po.inward_date,
          itemsSummary: po.items.map((i) => `${i.product_name} (${i.quantity}${i.unit})`).join(", "),
          totalAmount: po.total_amount,
          paidAmount: po.paid_amount,
          balanceDue: po.total_amount - po.paid_amount,
          status: po.paid_amount > 0 ? "partial" : "unpaid",
          ageDays,
        };
      });

    const totalDebits = relevantPOs.reduce((s, p) => s + p.total_amount, 0);
    const totalCredits = relevantPOs.reduce((s, p) => s + p.paid_amount, 0);
    const closingBalanceDue = Math.max(0, totalDebits - totalCredits);

    const statementData: SupplierStatementData = {
      storeName: "Fish N Fresh Seafoods",
      storeAddress: "Harbour Wholesale & Retail Terminal, Marina Coast",
      storePhone: "+91 98430 61919",
      storeEmail: "billing@fishnfresh.in",
      storeGstin: "33AABCT1234F1Z5",
      storeFssai: "12423008000456",

      supplierName,
      supplierHarbour: targetSupplier?.harbour || undefined,
      supplierContact: targetSupplier?.contact_person || undefined,
      supplierPhone: targetSupplier?.phone || "-",
      supplierEmail: targetSupplier?.email || undefined,
      supplierGstin: targetSupplier?.gstin || undefined,
      supplierUpiId: targetSupplier?.upi_id || undefined,

      fromDate: relevantPOs.length > 0 && relevantPOs[relevantPOs.length - 1] ? relevantPOs[relevantPOs.length - 1]!.inward_date : new Date().toISOString().slice(0, 10),
      toDate: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),

      totalPurchases: totalDebits,
      totalPayments: totalCredits,
      closingBalanceDue,

      ledgerEntries,
      outstandingBills,
    };

    printSupplierLedgerPdf(statementData);
  };

  // Add new supplier
  const handleSaveSupplier = () => {
    if (!newSupplier.name?.trim() || !newSupplier.phone?.trim()) {
      toast.error("Supplier name and phone number are required");
      return;
    }
    const sup: Supplier = {
      id: `sup-${Date.now()}`,
      name: newSupplier.name.trim(),
      harbour: newSupplier.harbour || "Kasimedu Harbour, Chennai",
      contact_person: newSupplier.contact_person || null,
      phone: newSupplier.phone.trim(),
      whatsapp: newSupplier.whatsapp?.trim() || newSupplier.phone.trim(),
      email: newSupplier.email?.trim() || null,
      gstin: newSupplier.gstin?.trim() || null,
      upi_id: newSupplier.upi_id?.trim() || null,
      balance_due: 0,
      created_at: new Date().toISOString(),
    };
    setSuppliers([...suppliers, sup]);
    setSelectedSupplierId(sup.id);
    setOpenAddSupplier(false);
    setNewSupplier({
      name: "",
      harbour: "Kasimedu Harbour, Chennai",
      contact_person: "",
      phone: "",
      whatsapp: "",
      email: "",
      gstin: "",
      upi_id: "",
    });
    toast.success("Supplier profile created!");
  };

  // Generate WhatsApp Statement Link
  const getWhatsAppStatementLink = (po: PurchaseOrder) => {
    const phone = po.supplier_phone.replace(/\D/g, "");
    const lines = po.items.map((i) => `• ${i.product_name}: ${i.quantity} ${i.unit} @ ₹${i.cost_per_unit} = ${formatINR(i.total_cost)}`).join("\n");
    const text = encodeURIComponent(
      `*Fish N Fresh — Catch Inward Statement*\n\n` +
      `*Voucher No:* #${po.reference_no}\n` +
      `*Supplier:* ${po.supplier_name}\n` +
      `*Inward Date:* ${po.inward_date}\n\n` +
      `*Catch Itemization:*\n${lines}\n\n` +
      `*Total Catch Amount:* ${formatINR(po.total_amount)}\n` +
      `*Amount Paid:* ${formatINR(po.paid_amount)} (${po.payment_method.toUpperCase()})\n` +
      `*Balance Due:* ${formatINR(Math.max(0, po.total_amount - po.paid_amount))}\n` +
      `*Status:* ${po.payment_status.toUpperCase()}\n\n` +
      (po.notes ? `*Notes:* ${po.notes}\n\n` : "") +
      `Thank you for supplying daily fresh catch to Fish N Fresh!`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  // Ledger summary calculations
  const totalInwardAmount = purchases.reduce((acc, p) => acc + p.total_amount, 0);
  const totalPaidAmount = purchases.reduce((acc, p) => acc + p.paid_amount, 0);
  const totalOutstandingDue = Math.max(0, totalInwardAmount - totalPaidAmount);
  const totalWeightKg = purchases.reduce(
    (acc, p) => acc + p.items.reduce((s, i) => s + (i.unit === "kg" ? i.quantity : 0), 0),
    0
  );

  const filteredPurchases = purchases.filter((p) => {
    if (statusFilter === "pending" && p.payment_status === "paid") return false;
    if (statusFilter === "paid" && p.payment_status !== "paid") return false;
    if (!searchLedger.trim()) return true;
    const term = searchLedger.toLowerCase();
    return (
      p.reference_no.toLowerCase().includes(term) ||
      p.supplier_name.toLowerCase().includes(term) ||
      p.supplier_phone.includes(term) ||
      p.items.some((i) => i.product_name.toLowerCase().includes(term))
    );
  });

  const purchasesExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "reference_no", label: "Invoice / Lot #", type: "string" },
      { key: "inward_date", label: "Date & Time (IST)", type: "date", format: (v) => formatIST(v) },
      { key: "supplier_name", label: "Supplier / Harbour", type: "string" },
      { key: "supplier_phone", label: "Phone", type: "string" },
      { key: "payment_status", label: "Payment Status", type: "string" },
      { key: "total_amount", label: "Gross Inward (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "paid_amount", label: "Paid (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "payment_method", label: "Payment Mode", type: "string" },
      {
        key: "items",
        label: "Items Procured",
        type: "string",
        format: (v) => (v ? v.map((i: any) => `${i.product_name} (${i.qty} ${i.unit || "kg"})`).join(", ") : ""),
      },
    ];
    return {
      filename: `harbour-catch-purchases-${new Date().toISOString().slice(0, 10)}`,
      title: "Harbour Catch Purchases & Inward Stock Ledger",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | ${filteredPurchases.length} inward lots`,
      columns,
      data: filteredPurchases,
      orientation: "landscape",
    };
  }, [filteredPurchases]);

  return (
    <AdminShell title="Catch Inward & Suppliers" allow={["admin", "manager", "inventory_manager", "staff"]}>
      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Purchases</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">{formatINR(totalInwardAmount)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{purchases.length} catch lots inwarded</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Paid to Suppliers</p>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatINR(totalPaidAmount)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Disbursed via UPI/Cash</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Balance Due</p>
          <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
            {formatINR(totalOutstandingDue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pending supplier payables</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Catch Weight</p>
          <p className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5">
            {totalWeightKg.toLocaleString()} kg
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total fresh catch received</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 w-full min-w-0">
          <div className="w-full min-w-0 overflow-x-auto no-scrollbar pb-0.5">
            <TabsList className="rounded-2xl p-1 bg-muted/60 flex-nowrap">
              <TabsTrigger value="ledger" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <FileText className="mr-1.5 size-3.5" /> Catch Purchases
              </TabsTrigger>
              <TabsTrigger value="outstanding" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <Receipt className="mr-1.5 size-3.5" /> Outstanding & Statements
                {purchases.filter((p) => p.total_amount > p.paid_amount).length > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 text-[10px] font-extrabold">
                    {purchases.filter((p) => p.total_amount > p.paid_amount).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <PackagePlus className="mr-1.5 size-3.5" /> Inward Catch (New)
              </TabsTrigger>
              <TabsTrigger value="po_requests" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0 gap-1.5">
                <TrendingUp className="size-3.5 text-indigo-500" /> Demand Radar &amp; P.O.
                {demandRadarItems.filter((i) => i.urgency === "critical").length > 0 && (
                  <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-extrabold animate-pulse">
                    {demandRadarItems.filter((i) => i.urgency === "critical").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <Building2 className="mr-1.5 size-3.5" /> Suppliers Directory ({suppliers.length})
              </TabsTrigger>
              <TabsTrigger value="batches" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <ShieldAlert className="mr-1.5 size-3.5 text-cyan-600" /> Catch Batches & Recall
                {inventoryBatches.filter((b: any) => b.status === "active").length > 0 && (
                  <span className="ml-1.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.2 text-[10px] font-extrabold">
                    {inventoryBatches.filter((b: any) => b.status === "active").length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {activeTab === "ledger" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search reference, harbour..."
                  value={searchLedger}
                  onChange={(e) => setSearchLedger(e.target.value)}
                  className="pl-8 h-8 rounded-xl text-xs"
                />
              </div>
              <ExportDropdown options={purchasesExportOptions} buttonLabel="Export Ledger" />
              <Button
                size="sm"
                className="h-8 rounded-xl text-xs font-bold shrink-0"
                onClick={() => setActiveTab("new")}
              >
                <Plus className="mr-1 size-3.5" /> Log Catch
              </Button>
            </div>
          )}
        </div>

        {/* TAB 1: Inward Purchase Ledger */}
        <TabsContent value="ledger" className="space-y-3 mt-0">
          <div className="flex items-center gap-2 pb-1 overflow-x-auto">
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs font-semibold"
              onClick={() => setStatusFilter("all")}
            >
              All ({purchases.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "pending" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs font-semibold text-rose-600 dark:text-rose-400"
              onClick={() => setStatusFilter("pending")}
            >
              Pending Balance ({purchases.filter((p) => p.payment_status !== "paid").length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "paid" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              onClick={() => setStatusFilter("paid")}
            >
              Fully Settled ({purchases.filter((p) => p.payment_status === "paid").length})
            </Button>
          </div>

          <div className="space-y-3">
            {filteredPurchases.map((po) => {
              const balance = Math.max(0, po.total_amount - po.paid_amount);
              return (
                <Card key={po.id} className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold bg-muted px-2 py-0.5 rounded-lg text-foreground">
                            #{po.reference_no}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase border ${
                              po.payment_status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : po.payment_status === "partial"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            }`}
                          >
                            {po.payment_status}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-foreground pt-1">{po.supplier_name}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{po.inward_date}</span>
                          <span>•</span>
                          <span>{po.items.length} catch items</span>
                          <span>•</span>
                          <span className="capitalize">{po.payment_method}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-extrabold text-foreground">{formatINR(po.total_amount)}</p>
                        {balance > 0 ? (
                          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            Due: {formatINR(balance)} (Paid {formatINR(po.paid_amount)})
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            Paid in Full
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Items chips preview */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {po.items.map((itm, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {itm.product_name}: <strong>{itm.quantity} {itm.unit}</strong> @ ₹{itm.cost_per_unit}
                        </span>
                      ))}
                    </div>

                    {po.notes && (
                      <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-xl">
                        "{po.notes}"
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/60 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 text-xs font-bold gap-1"
                        onClick={() => setViewVoucher(po)}
                      >
                        <Printer className="size-3.5" /> Voucher / Print
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 text-xs font-bold gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                        asChild
                      >
                        <a href={getWhatsAppStatementLink(po)} target="_blank" rel="noopener noreferrer">
                          <WhatsAppIcon className="size-3.5 text-emerald-600" /> WhatsApp Statement
                        </a>
                      </Button>

                      {balance > 0 ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8 text-xs font-bold gap-1 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                            onClick={() => openPaymentModal(po, "partial")}
                          >
                            <CreditCard className="size-3.5" /> Partial
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl h-8 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => openPaymentModal(po, "full")}
                          >
                            <CreditCard className="size-3.5" /> Pay Full ({formatINR(balance)})
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl h-8 text-xs font-bold gap-1 text-muted-foreground ml-auto"
                          onClick={() => handleGenerateStatementPdf(po.supplier_id)}
                        >
                          <FileText className="size-3.5" /> Statement PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredPurchases.length === 0 && (
              <p className="text-center py-10 text-sm text-muted-foreground">
                No purchases match your criteria. Click "Log Catch" to inward fish.
              </p>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Bill-Wise Outstanding Ledger & PDF Statements */}
        <TabsContent value="outstanding" className="space-y-4 mt-0">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-3.5 rounded-2xl border border-border/80">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label className="text-xs font-bold whitespace-nowrap text-muted-foreground">Supplier Filter:</Label>
              <select
                value={statementSupplierFilter}
                onChange={(e) => setStatementSupplierFilter(e.target.value)}
                className="flex h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-2xs font-semibold"
              >
                <option value="all">All Seafood Suppliers (Consolidated)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatINR(s.balance_due || 0)} due)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                size="sm"
                className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-cyan-700 hover:bg-cyan-600 text-white shadow-xs"
                onClick={() => handleGenerateStatementPdf(statementSupplierFilter)}
              >
                <Download className="size-3.5" /> Download Statement PDF
              </Button>
            </div>
          </div>

          {/* Metric KPI Cards for filtered view */}
          {(() => {
            const isAll = statementSupplierFilter === "all";
            const filteredPOs = isAll
              ? purchases
              : purchases.filter((p) => p.supplier_id === statementSupplierFilter);
            const unpaidPOs = filteredPOs.filter((p) => p.total_amount > p.paid_amount);
            const totalPurch = filteredPOs.reduce((s, p) => s + p.total_amount, 0);
            const totalPaid = filteredPOs.reduce((s, p) => s + p.paid_amount, 0);
            const netBalance = Math.max(0, totalPurch - totalPaid);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs bg-background">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Purchases (Debits)</p>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">{formatINR(totalPurch)}</p>
                  <p className="text-[10px] text-muted-foreground">{filteredPOs.length} bills inwarded</p>
                </Card>

                <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs bg-background">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Settled (Credits)</p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatINR(totalPaid)}</p>
                  <p className="text-[10px] text-muted-foreground">Disbursed to date</p>
                </Card>

                <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs bg-background border-rose-500/30">
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Closing Balance Due</p>
                  <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{formatINR(netBalance)}</p>
                  <p className="text-[10px] text-muted-foreground">{unpaidPOs.length} pending vouchers</p>
                </Card>

                <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs bg-background">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Statement Status</p>
                  <p className="text-sm font-extrabold text-foreground mt-1">
                    {netBalance === 0 ? "✨ All Accounts Settled" : "⚠️ Action Required"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Debit - Credit balanced</p>
                </Card>
              </div>
            );
          })()}

          {/* Section: Outstanding Bills */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                <Receipt className="size-4 text-rose-500" /> Outstanding Bills (Aging Breakdown)
              </h3>
              <p className="text-xs text-muted-foreground">
                Individual inward catch bills awaiting full or partial settlement.
              </p>
            </div>

            {(() => {
              const isAll = statementSupplierFilter === "all";
              const targetBills = purchases
                .filter((p) => p.total_amount > p.paid_amount)
                .filter((p) => (isAll ? true : p.supplier_id === statementSupplierFilter));

              if (targetBills.length === 0) {
                return (
                  <Card className="rounded-2xl p-8 text-center border-dashed border-border/80">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-foreground">Zero Outstanding Balance!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All catch inward bills for this selection have been settled in full.
                    </p>
                  </Card>
                );
              }

              return (
                <div className="space-y-2.5">
                  {targetBills.map((po) => {
                    const balance = po.total_amount - po.paid_amount;
                    const inwardTime = new Date(po.inward_date).getTime();
                    const ageDays = Math.max(0, Math.floor((Date.now() - inwardTime) / (1000 * 60 * 60 * 24)));

                    return (
                      <Card key={po.id} className="rounded-2xl border-border/80 shadow-2xs hover:shadow-sm transition">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-extrabold bg-muted px-2 py-0.5 rounded-lg text-foreground">
                                #{po.reference_no}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  ageDays > 7
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    : ageDays > 3
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                }`}
                              >
                                {ageDays === 0 ? "Today" : `${ageDays} days overdue`}
                              </span>
                              <span className="text-xs text-muted-foreground">Inward: {po.inward_date}</span>
                            </div>
                            <h4 className="font-bold text-sm text-foreground">{po.supplier_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {po.items.map((i) => `${i.product_name} (${i.quantity} ${i.unit})`).join(", ")}
                            </p>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-muted-foreground">
                                Bill: {formatINR(po.total_amount)} | Paid: {formatINR(po.paid_amount)}
                              </p>
                              <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                                Due: {formatINR(balance)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl h-8 text-xs font-semibold gap-1 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                                onClick={() => openPaymentModal(po, "partial")}
                              >
                                <CreditCard className="size-3.5" /> Pay Partial
                              </Button>
                              <Button
                                size="sm"
                                className="rounded-xl h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs"
                                onClick={() => openPaymentModal(po, "full")}
                              >
                                <CheckCircle2 className="size-3.5" /> Pay Full ({formatINR(balance)})
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl h-8 text-xs font-semibold gap-1 text-muted-foreground"
                                onClick={() => handleGenerateStatementPdf(po.supplier_id)}
                                title="Download statement for this supplier"
                              >
                                <FileText className="size-3.5" /> Statement
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Section: Recent Payment Disbursements History */}
          <div className="space-y-3 pt-3 border-t border-border/80">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                <Landmark className="size-4 text-emerald-500" /> Recent Payment Disbursements
              </h3>
              <p className="text-xs text-muted-foreground">
                Audit trail of full & partial settlements disbursed to seafood suppliers.
              </p>
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No payment disbursements logged yet.</p>
            ) : (
              <div className="rounded-2xl border border-border/80 overflow-hidden bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/80">
                    <tr>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Against Bill</th>
                      <th className="text-left p-3">Mode & Method</th>
                      <th className="text-left p-3">UTR / Ref #</th>
                      <th className="text-right p-3">Disbursed Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {payments.slice(0, 10).map((pay) => (
                      <tr key={pay.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium text-foreground">{pay.payment_date}</td>
                        <td className="p-3 font-semibold text-foreground">{pay.supplier_name || "Supplier"}</td>
                        <td className="p-3 font-mono text-muted-foreground">#{pay.po_reference || "-"}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold mr-1.5 uppercase ${
                              pay.payment_mode === "full"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {pay.payment_mode}
                          </span>
                          <span className="uppercase text-[11px] font-mono text-muted-foreground">
                            {pay.payment_method}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">{pay.reference_no || "-"}</td>
                        <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatINR(pay.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Log New Catch Inward */}
        <TabsContent value="new" className="space-y-4 mt-0">
          <Card className="rounded-3xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Harbour Catch Inward & Stock Entry</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Record supplier purchase, calculate costs, and automatically refill store inventory.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-semibold gap-1"
                  onClick={() => setOpenAddSupplier(true)}
                >
                  <Plus className="size-3.5" /> Add Supplier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Select Supplier / Harbour Trawler *</Label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.harbour || "Harbour"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Inward Date *</Label>
                  <Input
                    type="date"
                    value={inwardDate}
                    onChange={(e) => setInwardDate(e.target.value)}
                    className="rounded-xl h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs"
                  >
                    <option value="cash">Cash on Dock</option>
                    <option value="upi">Direct UPI Transfer</option>
                    <option value="bank">Bank IMPS / NEFT</option>
                    <option value="credit">Harbour Credit (Due)</option>
                  </select>
                </div>
              </div>

              {/* Inward Catch Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Catch Itemization & Weight
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-xl"
                    onClick={addItemRow}
                  >
                    <Plus className="mr-1 size-3" /> Add Fish Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {inwardItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-2xl border border-border/80 bg-muted/20 items-end"
                    >
                      <div className="sm:col-span-5 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Select Product</Label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItemRow(idx, "product_id", e.target.value)}
                          className="flex h-8 w-full rounded-xl border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
                        >
                          <option value="">Choose Catalog Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Current Stock: {formatStockDisplay(p.stock, p.unit)})
                            </option>
                          ))}
                          <option value="custom">+ Other / Custom Catch</option>
                        </select>
                        {item.product_id === "custom" && (
                          <Input
                            placeholder="Enter custom fish name..."
                            value={item.product_name}
                            onChange={(e) => updateItemRow(idx, "product_name", e.target.value)}
                            className="h-7 text-xs rounded-xl mt-1"
                          />
                        )}
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Quantity ({item.unit})</Label>
                        <Input
                          type="number"
                          placeholder="25"
                          value={item.quantity}
                          onChange={(e) => updateItemRow(idx, "quantity", e.target.value)}
                          className="h-8 text-xs rounded-xl"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Cost/Unit (₹)</Label>
                        <Input
                          type="number"
                          placeholder="350"
                          value={item.cost_per_unit}
                          onChange={(e) => updateItemRow(idx, "cost_per_unit", e.target.value)}
                          className="h-8 text-xs rounded-xl"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Total (₹)</Label>
                        <div className="h-8 flex items-center px-3 font-bold text-xs bg-muted/60 rounded-xl">
                          {formatINR((Number(item.quantity) || 0) * (Number(item.cost_per_unit) || 0))}
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={inwardItems.length <= 1}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItemRow(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation & Auto Stock Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-foreground cursor-pointer">
                        Auto-Add to Live Store Stock
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically increment product inventory in catalog immediately upon saving.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoRefillStock}
                      onChange={(e) => setAutoRefillStock(e.target.checked)}
                      className="size-5 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Harbour / Lot Notes</Label>
                    <Textarea
                      placeholder="e.g. Trawler: Sagar Kanya, Boat Reg: TN-02-F-990, Box 1-4 on dry ice..."
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      className="rounded-2xl text-xs min-h-[70px]"
                    />
                  </div>
                </div>

                {/* Amount Paid & Balance Breakdown */}
                <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Total Purchase Value:</span>
                    <span className="text-base text-foreground">{formatINR(computedTotal)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Amount Paid (₹) *</Label>
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="h-9 rounded-xl text-sm font-bold bg-background"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Outstanding Balance Due:</span>
                    <span
                      className={`font-extrabold ${
                        computedBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"
                      }`}
                    >
                      {formatINR(computedBalance)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 rounded-xl font-bold h-10 shadow-xs"
                  onClick={handleSavePurchase}
                >
                  <CheckCircle2 className="mr-1.5 size-4" /> Save Catch Inward & Update Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Suppliers Directory */}
        <TabsContent value="suppliers" className="space-y-3 mt-0">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground">Verified Seafood Suppliers & Jetties</h3>
            <Button
              size="sm"
              className="rounded-xl h-8 text-xs font-bold"
              onClick={() => setOpenAddSupplier(true)}
            >
              <Plus className="mr-1 size-3.5" /> Add Supplier
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {suppliers.map((sup) => (
              <Card key={sup.id} className="rounded-2xl border-border/80 p-4 shadow-2xs flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground">{sup.name}</h4>
                    {sup.balance_due && sup.balance_due > 0 ? (
                      <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[10px] font-extrabold shrink-0 border border-rose-500/20">
                        Due: {formatINR(sup.balance_due)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold shrink-0 border border-emerald-500/20">
                        Settled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Anchor className="size-3 shrink-0" /> {sup.harbour || "Harbour"}
                  </p>
                  {sup.contact_person && (
                    <p className="text-xs text-muted-foreground">Contact: {sup.contact_person}</p>
                  )}
                  {sup.gstin && (
                    <p className="text-[11px] font-mono text-muted-foreground">GSTIN: {sup.gstin}</p>
                  )}
                  {sup.upi_id && (
                    <p className="text-[11px] font-mono text-muted-foreground">UPI: {sup.upi_id}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs font-semibold gap-1"
                    asChild
                  >
                    <a href={`tel:${sup.phone}`}>
                      <Phone className="size-3" /> Call
                    </a>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs font-semibold gap-1 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                    onClick={() => handleGenerateStatementPdf(sup.id)}
                  >
                    <Download className="size-3 text-cyan-600" /> Statement PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs font-semibold gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${(sup.whatsapp || sup.phone).replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hello ${sup.name}, sending details from Fish N Fresh regarding our catch purchases.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <WhatsAppIcon className="size-3.5 text-emerald-600" /> WhatsApp
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 5. CATCH BATCHES & FOOD SAFETY TRACEABILITY TAB */}
        <TabsContent value="batches" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Catch Batches &amp; Food Safety Traceability
                </h3>
                <span className="rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-[10px] font-extrabold px-2 py-0.5 border border-cyan-500/20">
                  FSSAI Compliant
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track harbour dock origins, trawler vessel IDs, cold-chain temperatures, and execute instant customer recalls.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-8 text-xs font-bold gap-1.5 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => {
                  if (inventoryBatches.length > 0) {
                    setSelectedRecallBatch(inventoryBatches[0].batch_number);
                  }
                  setBatchRecallModalOpen(true);
                }}
              >
                <AlertOctagon className="size-3.5 text-rose-600" /> Batch Recall Tool
              </Button>

              <Button
                size="sm"
                className="rounded-xl h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-2xs"
                onClick={() => setNewBatchModalOpen(true)}
              >
                <Plus className="size-3.5" /> Log Catch Lot
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl p-3 bg-card border-border/70">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Fresh Lots</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {inventoryBatches.filter((b: any) => b.status === "active").length} Lots
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Ready for counter &amp; online sales</p>
            </Card>
            <Card className="rounded-2xl p-3 bg-card border-border/70">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cold Chain Status</p>
              <p className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5 flex items-center gap-1">
                <Snowflake className="size-4" /> &lt; -1.5°C
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">100% Chilled pack compliance</p>
            </Card>
            <Card className="rounded-2xl p-3 bg-card border-border/70">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recalled Lots</p>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                {inventoryBatches.filter((b: any) => b.status === "recalled").length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Food safety quarantined</p>
            </Card>
            <Card className="rounded-2xl p-3 bg-card border-border/70">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Traceable Lots</p>
              <p className="text-xl font-extrabold text-foreground mt-0.5">
                {inventoryBatches.length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Harbour to doorstep logged</p>
            </Card>
          </div>

          {/* Batches Table (Desktop) / Cards (Mobile) */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Lot # / Harbour</th>
                    <th className="p-3">Catch Product &amp; Vessel</th>
                    <th className="p-3">Catch Date</th>
                    <th className="p-3">Cold Chain</th>
                    <th className="p-3 text-right">Qty (Init / Curr)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inventoryBatches.map((b: any) => {
                    const hoursRemaining = Math.round(
                      (new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 3600)
                    );
                    const isExpiringSoon = hoursRemaining > 0 && hoursRemaining <= 24;
                    const isExpired = hoursRemaining <= 0;

                    return (
                      <tr key={b.id} className="hover:bg-muted/10">
                        <td className="p-3">
                          <div className="font-mono font-bold text-foreground">{b.batch_number}</div>
                          <div className="text-[11px] text-muted-foreground">{b.catch_harbour}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{b.product_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Boat: <strong className="text-foreground">{b.boat_number || "Dockside Trawler"}</strong> · {b.quality_grade}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-foreground font-medium">{formatIST(b.catch_date).slice(0, 11)}</div>
                          <div className={`text-[10px] font-semibold ${isExpired ? "text-rose-600" : isExpiringSoon ? "text-amber-600" : "text-emerald-600"}`}>
                            {isExpired ? "Expired" : `Shelf life: ~${hoursRemaining}h left`}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                            <Snowflake className="size-3" /> {b.cold_chain_temp_celsius}°C
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium">
                          <span className="text-foreground font-bold">{b.current_quantity}</span>
                          <span className="text-muted-foreground"> / {b.initial_quantity} {b.unit}</span>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`rounded-full border-0 text-[10px] capitalize ${
                              b.status === "active"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : b.status === "recalled"
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {b.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {b.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 rounded-lg text-rose-600 border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={async () => {
                                  if (!confirm(`Mark lot ${b.batch_number} as RECALLED? This will log a food safety alert.`)) return;
                                  await updateBatchStatus({ data: { batchId: b.id, status: "recalled" } });
                                  toast.warning(`Lot ${b.batch_number} marked as RECALLED`);
                                  refetchBatches();
                                }}
                              >
                                Recall
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 rounded-lg"
                              onClick={() => {
                                setSelectedRecallBatch(b.batch_number);
                                setBatchRecallModalOpen(true);
                              }}
                            >
                              Trace
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-border/60 p-2 space-y-2">
              {inventoryBatches.map((b: any) => (
                <div key={b.id} className="p-2 space-y-1.5 bg-muted/5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-foreground">{b.batch_number}</span>
                    <Badge className="text-[10px] capitalize">{b.status}</Badge>
                  </div>
                  <div className="text-xs font-semibold text-foreground">{b.product_name}</div>
                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>Boat: {b.boat_number || "Harbour"}</span>
                    <span>{b.cold_chain_temp_celsius}°C</span>
                  </div>
                  <div className="text-[11px] flex justify-between pt-1 border-t border-border/40">
                    <span>Stock: <strong>{b.current_quantity} {b.unit}</strong></span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setSelectedRecallBatch(b.batch_number);
                        setBatchRecallModalOpen(true);
                      }}
                    >
                      Audit Trace
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* DEMAND RADAR & PURCHASE ORDERS (P.O.) TAB */}
        <TabsContent value="po_requests" className="space-y-6">
          {/* Hero Banner & KPI Summary */}
          <div className="rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                      Smart Demand Radar &amp; Purchase Orders (P.O.)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      AI replenishment radar flags depleted bestsellers, matches with harbour trawlers, and dispatches 1-tap WhatsApp purchase orders.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  className="rounded-xl h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                  onClick={() => {
                    // Pre-fill with top critical item if any
                    const topCrit = demandRadarItems[0];
                    setPoFormSupplierId(topCrit?.matchedSupplier?.id || suppliers[0]?.id || "");
                    setPoFormItems(
                      topCrit
                        ? [
                            {
                              product_id: topCrit.product.id,
                              product_name: topCrit.product.name,
                              suggested_qty: topCrit.suggestedQty,
                              unit: topCrit.product.unit || "kg",
                              estimated_rate: topCrit.estRate,
                              current_stock: topCrit.stock,
                            },
                          ]
                        : []
                    );
                    setNewPoModalOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Create New P.O.
                </Button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
              <div className="p-3 rounded-2xl bg-background/60 border border-border/70">
                <p className="text-[11px] font-semibold text-muted-foreground">Critical Depleted Catch</p>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {demandRadarItems.filter((i) => i.urgency === "critical").length} items
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-background/60 border border-border/70">
                <p className="text-[11px] font-semibold text-muted-foreground">Low Stock On Radar</p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {demandRadarItems.filter((i) => i.urgency === "urgent").length} items
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-background/60 border border-border/70">
                <p className="text-[11px] font-semibold text-muted-foreground">Active P.O. Orders</p>
                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {purchaseRequests.filter((p) => p.status !== "completed" && p.status !== "cancelled").length} Active
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-background/60 border border-border/70">
                <p className="text-[11px] font-semibold text-muted-foreground">Estimated P.O. Outlay</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatINR(
                    purchaseRequests
                      .filter((p) => p.status !== "completed" && p.status !== "cancelled")
                      .reduce((acc, p) => acc + p.total_estimated_cost, 0)
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Demand Radar Recommendations */}
          <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  Live Seafood Demand Radar — High-Velocity Replenishment Suggestions
                </h3>
                <p className="text-xs text-muted-foreground">
                  Products with high sales volume or low current dock inventory. Matched automatically to specialized supplier trawlers.
                </p>
              </div>
              <Badge variant="outline" className="text-xs self-start sm:self-auto font-mono">
                {demandRadarItems.length} Products Monitored
              </Badge>
            </div>

            {demandRadarItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-sm">All Product Stocks Healthy!</p>
                <p className="text-xs">No seafood items are currently critically low or depleted.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {demandRadarItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 hover:bg-muted/30 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.product.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt=""
                              className="size-10 rounded-xl object-cover border border-border/60 shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0">
                              🐟
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-foreground truncate">{item.product.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Stock:{" "}
                              <strong
                                className={
                                  item.stock === 0
                                    ? "text-rose-600 font-black"
                                    : item.stock <= 10
                                    ? "text-amber-600 font-bold"
                                    : "text-foreground"
                                }
                              >
                                {item.stock} {item.product.unit || "kg"}
                              </strong>
                            </p>
                          </div>
                        </div>

                        {item.urgency === "critical" ? (
                          <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] shrink-0 font-bold">
                            Out of Stock
                          </Badge>
                        ) : item.urgency === "urgent" ? (
                          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] shrink-0 font-semibold">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] shrink-0 font-semibold">
                            Bestseller
                          </Badge>
                        )}
                      </div>

                      {/* Recommended Supplier Matchmaker */}
                      <div className="p-2 rounded-xl bg-background/80 border border-border/60 text-[11px] space-y-0.5">
                        <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                          <Anchor className="size-3 text-sky-600" /> Matched Sourcing Partner:
                        </p>
                        <p className="font-bold text-foreground truncate">
                          {item.matchedSupplier?.name || "Kasimedu Harbour Partner"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.matchedSupplier?.harbour || "Kasimedu Harbour, Chennai"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="text-[11px]">
                        <span className="text-muted-foreground">Need: </span>
                        <strong className="text-foreground">~{item.suggestedQty} kg</strong>
                        <span className="text-muted-foreground text-[10px]"> (@ ~₹{item.estRate}/kg)</span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-7 text-[11px] font-bold border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1 px-2.5"
                        onClick={() => handleQuickAddDemandToPo(item)}
                      >
                        <Plus className="size-3" /> Add to P.O.
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Active Purchase Orders Pipeline */}
          <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-indigo-500" />
                  Purchase Orders Tracker &amp; Inward Conversion
                </h3>
                <p className="text-xs text-muted-foreground">
                  Track supplier commitments. Once the boat lands, click <strong>Convert to Inward</strong> to receive stock automatically.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-semibold h-8"
                  onClick={() => {
                    setPoFormSupplierId(suppliers[0]?.id || "");
                    setPoFormItems([]);
                    setNewPoModalOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1" /> New P.O.
                </Button>
              </div>
            </div>

            {purchaseRequests.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-xs">No purchase orders created yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseRequests.map((po) => {
                  const isFinished = po.status === "completed";
                  return (
                    <div
                      key={po.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isFinished
                          ? "border-border/50 bg-muted/10 opacity-75"
                          : "border-border/90 bg-card hover:border-indigo-500/40 shadow-xs"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-bold text-sm text-foreground">{po.po_number}</span>
                          <span className="text-xs text-muted-foreground">
                            Dated: {new Date(po.created_at).toLocaleDateString("en-IN")}
                          </span>
                          <Badge
                            className={
                              po.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
                                : po.status === "sent"
                                ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px]"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]"
                            }
                          >
                            {po.status === "completed"
                              ? "✓ Inward Received"
                              : po.status === "sent"
                              ? "Sent to Supplier"
                              : "Draft P.O."}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span className="text-xs text-muted-foreground">Target Arrival:</span>
                          <span className="text-xs font-bold font-mono text-foreground">
                            {po.expected_delivery_date}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/25 border border-border/60 text-xs">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Supplier / Sourcing Terminal:</p>
                          <p className="font-bold text-foreground">{po.supplier_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            WhatsApp / Phone: {po.supplier_whatsapp || po.supplier_phone || "Kasimedu Desk"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Requested Items ({po.items.length}):</p>
                          <div className="space-y-0.5 mt-0.5">
                            {po.items.map((it, idx) => (
                              <p key={idx} className="text-foreground truncate font-medium">
                                • {it.product_name} — <strong>{it.suggested_qty} {it.unit}</strong> (~₹{it.estimated_rate}/{it.unit})
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Estimated PO Total:</span>
                          <span className="text-sm font-black text-foreground">
                            {formatINR(po.total_estimated_cost)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 1-Tap WhatsApp Dispatch */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/10 border-[#25D366]/30 gap-1"
                            onClick={() => sendPoWhatsApp(po)}
                            title="Send Purchase Order to Supplier via WhatsApp"
                          >
                            <WhatsAppIcon className="size-3.5" />
                            <span>WhatsApp P.O.</span>
                          </Button>

                          {/* View & Print Slip */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8 text-xs font-semibold text-foreground gap-1"
                            onClick={() => setSelectedPoForView(po)}
                          >
                            <Printer className="size-3.5" /> Slip
                          </Button>

                          {/* Convert to Inward Catch Landing */}
                          {!isFinished && (
                            <Button
                              size="sm"
                              className="rounded-xl h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
                              onClick={() => convertPoToInward(po)}
                              title="Boat has landed! Convert PO into Inward Stock Entry"
                            >
                              <PackagePlus className="size-3.5" /> Convert to Inward
                            </Button>
                          )}

                          {/* Delete PO */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete Purchase Order ${po.po_number}?`)) {
                                setPurchaseRequests((prev) => prev.filter((p) => p.id !== po.id));
                                toast.success("Purchase order removed");
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE NEW PURCHASE ORDER MODAL */}
      <Dialog open={newPoModalOpen} onOpenChange={setNewPoModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-5 sm:p-6 bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="size-5 text-indigo-600" />
              Create Supplier Purchase Order (P.O.)
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Draft formal replenishment request for harbour trawlers or wholesale partners.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Select Supplier / Trawler</Label>
                <select
                  value={poFormSupplierId}
                  onChange={(e) => setPoFormSupplierId(e.target.value)}
                  className="mt-1 w-full h-9 rounded-xl border border-input bg-transparent px-3 text-xs shadow-2xs"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.harbour || "Harbour"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Target Landing / Delivery Date</Label>
                <Input
                  type="date"
                  value={poFormDeliveryDate}
                  onChange={(e) => setPoFormDeliveryDate(e.target.value)}
                  className="mt-1 h-9 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Item Rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Catch Items Requested</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-7 text-[11px]"
                  onClick={() => {
                    const firstProd = products[0];
                    setPoFormItems([
                      ...poFormItems,
                      {
                        product_id: firstProd?.id || "",
                        product_name: firstProd?.name || "Fresh Fish",
                        suggested_qty: 20,
                        unit: firstProd?.unit || "kg",
                        estimated_rate: (firstProd as any)?.cost_price ? Number((firstProd as any).cost_price) : Math.round(Number(firstProd?.price || 300) * 0.7),
                        current_stock: Number(firstProd?.stock) || 0,
                      },
                    ]);
                  }}
                >
                  <Plus className="size-3 mr-1" /> Add Item
                </Button>
              </div>

              {poFormItems.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                  No items added yet. Click &quot;Add Item&quot; above or pick from Demand Radar.
                </div>
              ) : (
                <div className="space-y-2">
                  {poFormItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-border/70 bg-muted/20 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-5">
                        <select
                          value={item.product_id}
                          onChange={(e) => {
                            const found = products.find((p) => p.id === e.target.value);
                            const updated = [...poFormItems];
                            const current = updated[index];
                            if (current) {
                              updated[index] = {
                                ...current,
                                product_id: e.target.value,
                                product_name: found?.name || "Product",
                                suggested_qty: current.suggested_qty || 20,
                                unit: found?.unit || "kg",
                                estimated_rate: (found as any)?.cost_price ? Number((found as any).cost_price) : Math.round(Number(found?.price || 300) * 0.7),
                                current_stock: Number(found?.stock) || 0,
                              };
                              setPoFormItems(updated);
                            }
                          }}
                          className="w-full h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock || 0} {p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-1">
                        <Input
                          type="number"
                          value={item.suggested_qty}
                          onChange={(e) => {
                            const updated = [...poFormItems];
                            if (updated[index]) {
                              updated[index] = {
                                ...updated[index]!,
                                suggested_qty: Math.max(1, Number(e.target.value) || 1),
                              };
                              setPoFormItems(updated);
                            }
                          }}
                          className="h-8 rounded-lg text-xs"
                          placeholder="Qty"
                        />
                        <span className="text-xs text-muted-foreground">{item.unit}</span>
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={item.estimated_rate}
                          onChange={(e) => {
                            const updated = [...poFormItems];
                            if (updated[index]) {
                              updated[index] = {
                                ...updated[index]!,
                                estimated_rate: Math.max(0, Number(e.target.value) || 0),
                              };
                              setPoFormItems(updated);
                            }
                          }}
                          className="h-8 rounded-lg text-xs"
                          placeholder="Rate/kg"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setPoFormItems(poFormItems.filter((_, i) => i !== index))}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Special Instructions / Cold Chain Notes</Label>
              <Textarea
                value={poFormNotes}
                onChange={(e) => setPoFormNotes(e.target.value)}
                placeholder="Morning landing time, chemical-free testing requirement, crushed sea-ice standards..."
                rows={2}
                className="mt-1 text-xs rounded-xl"
              />
            </div>

            {/* Estimated Total Calculation */}
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Estimated P.O. Total Value:</span>
              <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {formatINR(
                  poFormItems.reduce((acc, it) => acc + (it.suggested_qty || 0) * (it.estimated_rate || 0), 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => setNewPoModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                if (poFormItems.length === 0) {
                  toast.error("Please add at least 1 item to the Purchase Order.");
                  return;
                }
                const targetSupplier = suppliers.find((s) => s.id === poFormSupplierId);
                const newPo: PurchaseRequestOrder = {
                  id: `req-${Date.now()}`,
                  po_number: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
                    Math.random() * 900 + 100
                  )}`,
                  supplier_id: poFormSupplierId,
                  supplier_name: targetSupplier?.name || "Harbour Supplier",
                  supplier_phone: targetSupplier?.phone || "",
                  supplier_whatsapp: targetSupplier?.whatsapp || targetSupplier?.phone || "",
                  expected_delivery_date: poFormDeliveryDate,
                  status: "draft",
                  items: poFormItems,
                  total_estimated_cost: poFormItems.reduce(
                    (acc, it) => acc + (it.suggested_qty || 0) * (it.estimated_rate || 0),
                    0
                  ),
                  notes: poFormNotes,
                  created_at: new Date().toISOString(),
                };

                setPurchaseRequests([newPo, ...purchaseRequests]);
                setNewPoModalOpen(false);
                toast.success(`Purchase Order ${newPo.po_number} created successfully!`);
              }}
            >
              Create Purchase Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW & PRINT PURCHASE ORDER SLIP MODAL */}
      <Dialog open={Boolean(selectedPoForView)} onOpenChange={(open) => !open && setSelectedPoForView(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-6 bg-card">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-between">
              <span>Purchase Order Voucher</span>
              <span className="font-mono text-xs text-muted-foreground">{selectedPoForView?.po_number}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPoForView && (
            <div className="space-y-4 py-2 text-xs">
              <div className="border-b pb-3 space-y-1">
                <p className="font-bold text-sm text-foreground">FISH N FRESH HUB</p>
                <p className="text-muted-foreground">Central Seafood Procurement &amp; Cold Storage Terminal</p>
                <p className="text-muted-foreground font-mono">Date: {new Date(selectedPoForView.created_at).toLocaleDateString("en-IN")}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b pb-3">
                <div>
                  <p className="text-muted-foreground text-[11px]">Supplier:</p>
                  <p className="font-bold text-foreground">{selectedPoForView.supplier_name}</p>
                  <p className="text-muted-foreground font-mono">{selectedPoForView.supplier_phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Expected Delivery:</p>
                  <p className="font-bold text-foreground font-mono">{selectedPoForView.expected_delivery_date}</p>
                  <p className="text-muted-foreground">Dock Landing / Central Hub</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-foreground">Requested Items:</p>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground text-[10px]">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Est. Rate</th>
                      <th className="py-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPoForView.items.map((it, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-1 font-medium">{it.product_name}</td>
                        <td className="py-1 text-center font-mono">
                          {it.suggested_qty} {it.unit}
                        </td>
                        <td className="py-1 text-right font-mono">₹{it.estimated_rate}</td>
                        <td className="py-1 text-right font-mono">₹{it.suggested_qty * it.estimated_rate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 font-bold text-sm border-t">
                <span>Total Estimated Outlay:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                  {formatINR(selectedPoForView.total_estimated_cost)}
                </span>
              </div>

              {selectedPoForView.notes && (
                <div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground">
                  <strong>Notes:</strong> {selectedPoForView.notes}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs gap-1"
                  onClick={() => window.print()}
                >
                  <Printer className="size-3.5" /> Print Voucher
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-1"
                  onClick={() => {
                    sendPoWhatsApp(selectedPoForView);
                  }}
                >
                  <WhatsAppIcon className="size-3.5" /> WhatsApp to Supplier
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FOOD SAFETY BATCH RECALL TOOL MODAL */}
      <Dialog open={batchRecallModalOpen} onOpenChange={setBatchRecallModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 bg-card">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <AlertOctagon className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Food Safety Batch Traceability &amp; Customer Recall Tool
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Instantly locate every customer order and phone number that received seafood from this catch lot.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label className="text-xs font-semibold">Select Lot Number to Audit</Label>
                <select
                  value={selectedRecallBatch}
                  onChange={(e) => setSelectedRecallBatch(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border bg-background px-3 text-xs font-mono font-bold mt-1"
                >
                  {inventoryBatches.map((b: any) => (
                    <option key={b.id} value={b.batch_number}>
                      {b.batch_number} — {b.product_name} ({b.catch_harbour})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="self-end h-9 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white px-4"
                disabled={isRecalling || !selectedRecallBatch}
                onClick={async () => {
                  try {
                    setIsRecalling(true);
                    const report = await executeBatchRecall({ data: { batchNumber: selectedRecallBatch } });
                    setRecallReport(report);
                    refetchBatches();
                    toast.success(`Traceability audit complete for ${report.batchNumber}`);
                  } catch (e: any) {
                    toast.error(e.message || "Trace audit failed");
                  } finally {
                    setIsRecalling(false);
                  }
                }}
              >
                {isRecalling ? "Tracing Orders..." : "Run Traceability Audit"}
              </Button>
            </div>

            {recallReport && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border p-2.5 bg-muted/20">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Lot / Catch</p>
                    <p className="font-bold text-xs text-foreground truncate">{recallReport.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{recallReport.catchHarbour}</p>
                  </div>
                  <div className="rounded-xl border p-2.5 bg-muted/20">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Impacted Customers</p>
                    <p className="font-extrabold text-base text-rose-600">{recallReport.totalCustomersImpacted}</p>
                    <p className="text-[10px] text-muted-foreground">Requires phone notification</p>
                  </div>
                  <div className="rounded-xl border p-2.5 bg-muted/20">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Affected Orders</p>
                    <p className="font-extrabold text-base text-foreground">{recallReport.impactedOrders.length}</p>
                    <p className="text-[10px] text-muted-foreground">Orders containing this catch</p>
                  </div>
                </div>

                {recallReport.impactedOrders.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold sticky top-0">
                        <tr>
                          <th className="p-2">Order #</th>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Order Date</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {recallReport.impactedOrders.map((o) => (
                          <tr key={o.orderId}>
                            <td className="p-2 font-mono font-bold">#{o.orderNumber}</td>
                            <td className="p-2 font-medium text-foreground">{o.customerName}</td>
                            <td className="p-2 font-mono">{o.customerPhone}</td>
                            <td className="p-2 text-muted-foreground">{formatIST(o.orderDate).slice(0, 11)}</td>
                            <td className="p-2 text-right font-bold">{formatINR(o.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 text-center text-emerald-700 dark:text-emerald-300">
                    ✅ No customer orders have been dispatched from this lot yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* LOG NEW CATCH LOT MODAL */}
      <Dialog open={newBatchModalOpen} onOpenChange={setNewBatchModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-5 bg-card">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Log Inward Catch Lot (Traceability)
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Record boat registration, harbour source, and cold chain temperature.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!batchForm.productId) {
                toast.error("Please select a seafood product");
                return;
              }
              try {
                const prod = products.find((p) => p.id === batchForm.productId);
                await createInwardBatch({
                  data: {
                    ...batchForm,
                    productName: prod?.name || "Fresh Seafood",
                    initialQuantity: Number(batchForm.initialQuantity),
                    coldChainTempCelsius: Number(batchForm.coldChainTempCelsius),
                    shelfLifeHours: Number(batchForm.shelfLifeHours),
                  },
                });
                toast.success(`Catch lot ${batchForm.batchNumber} registered!`);
                setNewBatchModalOpen(false);
                refetchBatches();
              } catch (err: any) {
                toast.error(err.message || "Failed to log lot");
              }
            }}
            className="space-y-3 pt-2 text-xs"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Batch Lot Number</Label>
                <Input
                  value={batchForm.batchNumber}
                  onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                  className="rounded-xl h-9 text-xs font-mono font-bold mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Select Product</Label>
                <select
                  value={batchForm.productId}
                  onChange={(e) => setBatchForm({ ...batchForm, productId: e.target.value })}
                  className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs mt-1"
                  required
                >
                  <option value="">-- Choose Seafood --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Catch Harbour / Port</Label>
                <Input
                  value={batchForm.catchHarbour}
                  onChange={(e) => setBatchForm({ ...batchForm, catchHarbour: e.target.value })}
                  className="rounded-xl h-9 text-xs mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Trawler / Boat ID</Label>
                <Input
                  value={batchForm.boatNumber}
                  onChange={(e) => setBatchForm({ ...batchForm, boatNumber: e.target.value })}
                  placeholder="e.g. TN-02-MM-1092"
                  className="rounded-xl h-9 text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Catch Qty (kg)</Label>
                <Input
                  type="number"
                  value={batchForm.initialQuantity}
                  onChange={(e) => setBatchForm({ ...batchForm, initialQuantity: e.target.value })}
                  className="rounded-xl h-9 text-xs mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Cold Chain (°C)</Label>
                <Input
                  value={batchForm.coldChainTempCelsius}
                  onChange={(e) => setBatchForm({ ...batchForm, coldChainTempCelsius: e.target.value })}
                  placeholder="-1.8"
                  className="rounded-xl h-9 text-xs mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Shelf Life (Hours)</Label>
                <Input
                  type="number"
                  value={batchForm.shelfLifeHours}
                  onChange={(e) => setBatchForm({ ...batchForm, shelfLifeHours: e.target.value })}
                  className="rounded-xl h-9 text-xs mt-1"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" className="rounded-xl h-9" onClick={() => setNewBatchModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="rounded-xl h-9 font-bold bg-primary text-primary-foreground px-4">
                Save &amp; Inward Lot
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable Inward Voucher Modal */}
      <Dialog open={Boolean(viewVoucher)} onOpenChange={(open) => !open && setViewVoucher(null)}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 print:p-0 print:border-none">
          {viewVoucher && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">FISH N FRESH</h3>
                  <p className="text-xs text-muted-foreground">Catch Inward Receipt & Supplier Voucher</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-bold">VOUCHER #{viewVoucher.reference_no}</p>
                  <p className="text-xs text-muted-foreground">{viewVoucher.inward_date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold text-muted-foreground uppercase">Supplier Information</p>
                  <p className="font-bold text-foreground text-sm mt-0.5">{viewVoucher.supplier_name}</p>
                  <p className="text-muted-foreground">{viewVoucher.supplier_phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-muted-foreground uppercase">Payment Status</p>
                  <p className="font-bold text-foreground text-sm mt-0.5 uppercase">
                    {viewVoucher.payment_status} ({viewVoucher.payment_method})
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-2xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/60 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-2.5 text-left">Item Description</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewVoucher.items.map((itm, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-semibold text-foreground">{itm.product_name}</td>
                        <td className="p-2.5 text-center">{itm.quantity} {itm.unit}</td>
                        <td className="p-2.5 text-right">{formatINR(itm.cost_per_unit)}</td>
                        <td className="p-2.5 text-right font-bold">{formatINR(itm.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs pt-2">
                <div className="space-y-0.5 text-muted-foreground">
                  {viewVoucher.notes && <p>Notes: {viewVoucher.notes}</p>}
                  <p>Quality check verified by Dock Manager.</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-muted-foreground">Total Inward: <strong>{formatINR(viewVoucher.total_amount)}</strong></p>
                  <p className="text-emerald-600 font-bold">Paid: {formatINR(viewVoucher.paid_amount)}</p>
                  <p className="text-sm font-extrabold text-foreground border-t pt-1">
                    Balance: {formatINR(Math.max(0, viewVoucher.total_amount - viewVoucher.paid_amount))}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs font-bold gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="size-3.5" /> Print / Save as PDF
                </Button>
                <Button
                  className="flex-1 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                  asChild
                >
                  <a href={getWhatsAppStatementLink(viewVoucher)} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="size-3.5" /> Send PDF Statement on WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Due Payment Modal */}
      {/* Record Due Payment Modal (Full / Partial Settlement) */}
      <Dialog open={Boolean(recordPaymentOrder)} onOpenChange={(open) => !open && setRecordPaymentOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          {recordPaymentOrder && (() => {
            const due = Math.max(0, recordPaymentOrder.total_amount - recordPaymentOrder.paid_amount);
            return (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold flex items-center gap-1.5">
                    <CreditCard className="size-4 text-primary" /> Disburse Payment to {recordPaymentOrder.supplier_name}
                  </DialogTitle>
                </DialogHeader>

                <div className="rounded-2xl border p-3.5 bg-muted/30 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catch Voucher:</span>
                    <span className="font-mono font-bold text-foreground">#{recordPaymentOrder.reference_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Inward Value:</span>
                    <span className="font-bold text-foreground">{formatINR(recordPaymentOrder.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Settled:</span>
                    <span className="font-bold text-emerald-600">{formatINR(recordPaymentOrder.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-rose-600 dark:text-rose-400 pt-1 border-t border-border/60">
                    <span>Remaining Balance Due:</span>
                    <span>{formatINR(due)}</span>
                  </div>
                </div>

                {/* Mode Selector: Full vs Partial */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Settlement Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentMode === "full" ? "default" : "outline"}
                      className="rounded-xl h-9 text-xs font-bold"
                      onClick={() => {
                        setPaymentMode("full");
                        setAdditionalPayment(due.toString());
                      }}
                    >
                      <CheckCircle2 className="size-3.5 mr-1" /> Full ({formatINR(due)})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={paymentMode === "partial" ? "default" : "outline"}
                      className="rounded-xl h-9 text-xs font-bold"
                      onClick={() => {
                        setPaymentMode("partial");
                        setAdditionalPayment("");
                      }}
                    >
                      Partial Payment
                    </Button>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <Label>Amount to Disburse (₹) *</Label>
                    <span className="text-muted-foreground">Max payable: {formatINR(due)}</span>
                  </div>
                  <Input
                    type="number"
                    value={additionalPayment}
                    onChange={(e) => setAdditionalPayment(e.target.value)}
                    placeholder={`e.g. ${due}`}
                    className="rounded-xl font-bold h-9 text-sm"
                  />
                </div>

                {/* Payment Method & Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Payment Method</Label>
                    <select
                      value={paymentDisburseMethod}
                      onChange={(e) => setPaymentDisburseMethod(e.target.value as any)}
                      className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs font-semibold shadow-2xs"
                    >
                      <option value="upi">Direct UPI Transfer</option>
                      <option value="cash">Cash on Hand</option>
                      <option value="bank">Bank IMPS / NEFT</option>
                      <option value="cheque">Bank Cheque</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="rounded-xl h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Reference / UTR */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Transaction / UTR / Cheque Ref (Optional)</Label>
                  <Input
                    placeholder="e.g. UPI/429381028301 or CHQ-9901"
                    value={paymentRefNumber}
                    onChange={(e) => setPaymentRefNumber(e.target.value)}
                    className="rounded-xl h-9 text-xs font-mono"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Narration / Notes</Label>
                  <Input
                    placeholder="e.g. Paid from HDFC Current Account"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="rounded-xl h-8 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="w-1/3 rounded-xl h-9 text-xs" onClick={() => setRecordPaymentOrder(null)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 rounded-xl h-9 text-xs font-bold bg-primary" onClick={handleRecordPayment}>
                    Confirm & Record Payment
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Supplier Modal */}
      <Dialog open={openAddSupplier} onOpenChange={setOpenAddSupplier}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Seafood Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Supplier / Society Name *</Label>
              <Input
                placeholder="e.g. Kasimedu Deep Sea Fishermen"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                className="rounded-xl text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Harbour / Jetty Location</Label>
                <Input
                  placeholder="e.g. Kasimedu, Chennai"
                  value={newSupplier.harbour ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, harbour: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact Person</Label>
                <Input
                  placeholder="e.g. Murugan"
                  value={newSupplier.contact_person ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Phone Number *</Label>
                <Input
                  placeholder="9843061919"
                  value={newSupplier.phone ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp Number</Label>
                <Input
                  placeholder="9843061919"
                  value={newSupplier.whatsapp ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, whatsapp: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">GSTIN (Optional)</Label>
                <Input
                  placeholder="33AABCT..."
                  value={newSupplier.gstin ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, gstin: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UPI ID (For settlement)</Label>
                <Input
                  placeholder="vendor@upi"
                  value={newSupplier.upi_id ?? ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, upi_id: e.target.value })}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setOpenAddSupplier(false)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl font-bold" onClick={handleSaveSupplier}>
                Save Supplier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
