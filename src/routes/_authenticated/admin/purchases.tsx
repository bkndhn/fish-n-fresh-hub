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
import type { Supplier, PurchaseOrder, PurchaseItem, Product } from "@/lib/types";

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

  // Filter state for ledger
  const [searchLedger, setSearchLedger] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [activeTab, setActiveTab] = useState<"ledger" | "new" | "suppliers">("ledger");

  // Modals
  const [viewVoucher, setViewVoucher] = useState<PurchaseOrder | null>(null);
  const [openAddSupplier, setOpenAddSupplier] = useState(false);
  const [recordPaymentOrder, setRecordPaymentOrder] = useState<PurchaseOrder | null>(null);
  const [additionalPayment, setAdditionalPayment] = useState<string>("");

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

  // Record additional balance payment
  const handleRecordPayment = () => {
    if (!recordPaymentOrder) return;
    const addPay = Number(additionalPayment);
    if (isNaN(addPay) || addPay <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const newPaid = recordPaymentOrder.paid_amount + addPay;
    const newStatus: "paid" | "partial" | "pending" =
      newPaid >= recordPaymentOrder.total_amount ? "paid" : "partial";

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

    toast.success(`Payment of ${formatINR(addPay)} recorded successfully!`);
    setRecordPaymentOrder(null);
    setAdditionalPayment("");
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
          <TabsList className="rounded-2xl p-1 bg-muted/60">
            <TabsTrigger value="ledger" className="rounded-xl text-xs font-bold">
              <FileText className="mr-1.5 size-3.5" /> Purchase Ledger
            </TabsTrigger>
            <TabsTrigger value="new" className="rounded-xl text-xs font-bold">
              <PackagePlus className="mr-1.5 size-3.5" /> Inward Catch (New)
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="rounded-xl text-xs font-bold">
              <Building2 className="mr-1.5 size-3.5" /> Suppliers Directory ({suppliers.length})
            </TabsTrigger>
          </TabsList>

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

                      {balance > 0 && (
                        <Button
                          size="sm"
                          className="rounded-xl h-8 text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground ml-auto"
                          onClick={() => {
                            setRecordPaymentOrder(po);
                            setAdditionalPayment(balance.toString());
                          }}
                        >
                          <CreditCard className="size-3.5" /> Pay Due ({formatINR(balance)})
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

                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs font-semibold gap-1.5"
                    asChild
                  >
                    <a href={`tel:${sup.phone}`}>
                      <Phone className="size-3" /> Call
                    </a>
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
      <Dialog open={Boolean(recordPaymentOrder)} onOpenChange={(open) => !open && setRecordPaymentOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          {recordPaymentOrder && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  Disburse Payment to {recordPaymentOrder.supplier_name}
                </DialogTitle>
              </DialogHeader>

              <div className="rounded-2xl border p-3 bg-muted/30 text-xs space-y-1">
                <p>Voucher: <strong>#{recordPaymentOrder.reference_no}</strong></p>
                <p>Total Purchase: <strong>{formatINR(recordPaymentOrder.total_amount)}</strong></p>
                <p>Already Paid: <strong>{formatINR(recordPaymentOrder.paid_amount)}</strong></p>
                <p className="text-rose-600 font-bold text-sm pt-1 border-t">
                  Remaining Due: {formatINR(recordPaymentOrder.total_amount - recordPaymentOrder.paid_amount)}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payment Amount (₹)</Label>
                <Input
                  type="number"
                  value={additionalPayment}
                  onChange={(e) => setAdditionalPayment(e.target.value)}
                  className="rounded-xl font-bold"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="w-1/3 rounded-xl" onClick={() => setRecordPaymentOrder(null)}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-xl font-bold" onClick={handleRecordPayment}>
                  Confirm Payment
                </Button>
              </div>
            </div>
          )}
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
