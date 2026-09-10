import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminProductsQuery } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatIST, formatStockDisplay } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  const productsQueryObj = useQuery(adminProductsQuery);
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
  const [activeTab, setActiveTab] = useState<"ledger" | "outstanding" | "new" | "suppliers">("ledger");
  const [statementSupplierFilter, setStatementSupplierFilter] = useState<string>("all");

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

  return (
    <AdminShell title="Catch Inward & Suppliers" allow={["admin", "staff"]}>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="overflow-x-auto no-scrollbar max-w-full pb-0.5">
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
              <TabsTrigger value="suppliers" className="rounded-xl text-xs font-bold whitespace-nowrap shrink-0">
                <Building2 className="mr-1.5 size-3.5" /> Suppliers Directory ({suppliers.length})
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
      </Tabs>

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
