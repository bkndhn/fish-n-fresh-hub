import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Search,
  Printer,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  TrendingDown,
  Scale,
  PieChart,
  CheckCircle2,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WasteEntry, Product } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/waste")({
  head: () => ({
    meta: [
      { title: "Waste & Loss Management | Fish N Fresh Admin" },
      { name: "description", content: "Track trimming loss, spoilage, transit damage and auto-deduct wasted inventory." },
    ],
  }),
  component: WasteAdmin,
});

const DEFAULT_WASTE_ENTRIES: WasteEntry[] = [
  {
    id: "w-1",
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    product_id: "prod-vanjaram",
    product_name: "Vanjaram / Seer Fish",
    quantity: 4.5,
    unit: "kg",
    reason: "trimming_loss",
    cost_loss: 1890,
    notes: "Head and intestine removal loss during steak cutting.",
    logged_by: "Store Manager",
    created_at: new Date().toISOString(),
  },
  {
    id: "w-2",
    date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
    product_id: "prod-sardine",
    product_name: "Mathi / Sardines",
    quantity: 6,
    unit: "kg",
    reason: "spoilage",
    cost_loss: 900,
    notes: "Ice box melted overnight during storm power fluctuation.",
    logged_by: "Cold Room Supervisor",
    created_at: new Date().toISOString(),
  },
  {
    id: "w-3",
    date: new Date(Date.now() - 259200000).toISOString().slice(0, 10),
    product_id: "prod-crab",
    product_name: "Blue Sea Crab",
    quantity: 3,
    unit: "kg",
    reason: "transit_damage",
    cost_loss: 1200,
    notes: "Cracked shells during dock unloading.",
    logged_by: "Dock Manager",
    created_at: new Date().toISOString(),
  },
];

const REASONS = [
  { value: "trimming_loss", label: "Cleaning & Cutting Loss (Gutting / Scaling)", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  { value: "spoilage", label: "Spoilage / Ice Melting / Expiry", color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  { value: "transit_damage", label: "Transit & Handling Damage", color: "text-orange-600 bg-orange-500/10 border-orange-500/20" },
  { value: "customer_return", label: "Customer Rejection / Return", color: "text-purple-600 bg-purple-500/10 border-purple-500/20" },
  { value: "other", label: "Other Loss / Quality Discard", color: "text-muted-foreground bg-muted border-border" },
] as const;

function WasteAdmin() {
  const qc = useQueryClient();
  const productsQueryObj = useQuery(adminProductsQuery());
  const products = productsQueryObj.data ?? [];

  const [wasteList, setWasteList] = useState<WasteEntry[]>(() => {
    try {
      const saved = localStorage.getItem("fnf_waste");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_WASTE_ENTRIES;
  });

  useEffect(() => {
    localStorage.setItem("fnf_waste", JSON.stringify(wasteList));
  }, [wasteList]);

  const [openLogModal, setOpenLogModal] = useState(false);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  // New Waste Form State
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [wasteQty, setWasteQty] = useState<string>("2");
  const [wasteReason, setWasteReason] = useState<WasteEntry["reason"]>("trimming_loss");
  const [wasteNotes, setWasteNotes] = useState<string>("");
  const [wasteDate, setWasteDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [autoDeductStock, setAutoDeductStock] = useState<boolean>(true);
  const [costLossCustom, setCostLossCustom] = useState<string>("");

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Auto calculate cost loss based on product price if not manually entered
  const estimatedCost = selectedProduct
    ? (Number(wasteQty) || 0) * (Number(selectedProduct.price) * 0.75) // 75% of retail price approximate cost
    : (Number(wasteQty) || 0) * 250;

  const handleSaveWaste = async () => {
    if (!selectedProductId) {
      toast.error("Please select a seafood product");
      return;
    }
    const qty = Number(wasteQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid waste quantity");
      return;
    }

    const calculatedLoss = costLossCustom ? Number(costLossCustom) : Math.round(estimatedCost);

    const newEntry: WasteEntry = {
      id: `w-${Date.now()}`,
      date: wasteDate,
      product_id: selectedProductId,
      product_name: selectedProduct?.name || "Seafood Item",
      quantity: qty,
      unit: selectedProduct?.unit || "kg",
      reason: wasteReason,
      cost_loss: calculatedLoss,
      notes: wasteNotes.trim() || null,
      logged_by: "Store Admin",
      created_at: new Date().toISOString(),
    };

    // Auto deduct from live product stock in Supabase database
    if (autoDeductStock && selectedProduct) {
      const currentStock = Number(selectedProduct.stock || 0);
      const newStock = Math.max(0, currentStock - qty);
      await supabase
        .from("products")
        .update({ stock: newStock } as any)
        .eq("id", selectedProductId);

      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    }

    setWasteList([newEntry, ...wasteList]);
    toast.success(`Waste logged. ${autoDeductStock ? "Inventory stock deducted." : ""}`);
    setOpenLogModal(false);
    setSelectedProductId("");
    setWasteQty("2");
    setWasteNotes("");
    setCostLossCustom("");
  };

  // KPIs
  const totalCostLoss = wasteList.reduce((acc, w) => acc + (w.cost_loss || 0), 0);
  const totalWeightWastedKg = wasteList.reduce(
    (acc, w) => acc + (w.unit === "kg" ? w.quantity : 0),
    0
  );
  const trimmingLossCount = wasteList.filter((w) => w.reason === "trimming_loss").length;
  const spoilageCount = wasteList.filter((w) => w.reason === "spoilage").length;

  const filteredList = wasteList.filter((w) => {
    if (reasonFilter !== "all" && w.reason !== reasonFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      w.product_name.toLowerCase().includes(term) ||
      (w.notes && w.notes.toLowerCase().includes(term)) ||
      w.reason.toLowerCase().includes(term)
    );
  });

  const wasteExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "date", label: "Date (IST)", type: "date" },
      { key: "product_name", label: "Product / Fish", type: "string" },
      {
        key: "quantity",
        label: "Wasted Qty",
        type: "string",
        format: (v, r) => `${v} ${r.unit || "kg"}`,
      },
      {
        key: "reason",
        label: "Loss Reason",
        type: "string",
        format: (v) =>
          v === "trimming_loss"
            ? "Trimming / Cutting Loss"
            : v === "spoilage"
            ? "Cold Chain Spoilage"
            : v === "transit_damage"
            ? "Transit Damage"
            : v === "customer_return"
            ? "Customer Return"
            : v,
      },
      { key: "cost_loss", label: "Cost Loss (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "logged_by", label: "Logged By", type: "string" },
      { key: "notes", label: "Notes / Root Cause", type: "string" },
    ];
    return {
      filename: `waste-and-loss-log-${new Date().toISOString().slice(0, 10)}`,
      title: "Waste, Trimming & Spoilage Incident Register",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | ${filteredList.length} incidents logged`,
      columns,
      data: filteredList,
      orientation: "landscape",
    };
  }, [filteredList]);

  return (
    <AdminShell title="Waste & Loss Management" allow={["admin", "manager", "inventory_manager", "staff"]}>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Financial Loss</p>
          <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
            {formatINR(totalCostLoss)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{wasteList.length} incidents logged</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Wasted Weight</p>
          <p className="text-xl font-extrabold text-foreground mt-0.5">
            {totalWeightWastedKg.toFixed(1)} kg
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Trimming & spoilage combined</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Trimming Loss</p>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
            {trimmingLossCount} logs
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Natural cutting & gutting loss</p>
        </Card>

        <Card className="rounded-2xl border-border/80 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Spoilage Incidents</p>
          <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
            {spoilageCount} logs
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Ice melting / cold chain delay</p>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search product, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 rounded-xl text-xs"
            />
          </div>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="flex h-8 rounded-xl border border-input bg-background px-2.5 py-1 text-xs shadow-2xs"
          >
            <option value="all">All Loss Types</option>
            <option value="trimming_loss">Trimming / Cutting</option>
            <option value="spoilage">Spoilage</option>
            <option value="transit_damage">Transit Damage</option>
            <option value="customer_return">Customer Return</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <ExportDropdown options={wasteExportOptions} buttonLabel="Export Waste Log" />
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 text-xs font-bold gap-1"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" /> Print Log
          </Button>

          <Button
            size="sm"
            className="rounded-xl h-8 text-xs font-bold gap-1 bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
            onClick={() => setOpenLogModal(true)}
          >
            <Plus className="size-3.5" /> Log Stock Waste
          </Button>
        </div>
      </div>

      {/* Waste Ledger Table */}
      <div className="space-y-2.5">
        {filteredList.map((entry) => {
          const reasonMeta = REASONS.find((r) => r.value === entry.reason) || REASONS[4];
          return (
            <Card key={entry.id} className="rounded-2xl border-border/80 shadow-2xs hover:shadow-xs transition">
              <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <Calendar className="size-3" /> {entry.date}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${reasonMeta.color}`}>
                      {reasonMeta.label.split("(")[0]}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{entry.product_name}</h4>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Wasted Qty</p>
                    <p className="text-sm font-extrabold text-foreground">
                      {entry.quantity} {entry.unit}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Cost Loss</p>
                    <p className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                      {formatINR(entry.cost_loss)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredList.length === 0 && (
          <p className="text-center py-10 text-sm text-muted-foreground">
            No waste records match your filter. Click "Log Stock Waste" to record cutting or spoilage loss.
          </p>
        )}
      </div>

      {/* Log Stock Waste Modal */}
      <Dialog open={openLogModal} onOpenChange={setOpenLogModal}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <TrendingDown className="size-5 text-rose-500" /> Log Stock Loss & Waste
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Select Fish / Seafood Item *</Label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs"
              >
                <option value="">Select seafood from inventory...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Live Stock: {formatStockDisplay(p.stock, p.unit)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  Wasted Qty ({selectedProduct?.unit || "kg"}) *
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Incident Date</Label>
                <Input
                  type="date"
                  value={wasteDate}
                  onChange={(e) => setWasteDate(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Reason for Loss *</Label>
              <select
                value={wasteReason}
                onChange={(e) => setWasteReason(e.target.value as any)}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs shadow-xs"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Estimated Financial Cost Loss (₹)</Label>
              <Input
                type="number"
                placeholder={Math.round(estimatedCost).toString()}
                value={costLossCustom}
                onChange={(e) => setCostLossCustom(e.target.value)}
                className="rounded-xl h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Auto-estimated at ₹{Math.round(estimatedCost)} based on wholesale purchase value.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Notes / Explanation</Label>
              <Textarea
                placeholder="e.g. Skinning & gutting wastage, melted ice on top layer..."
                value={wasteNotes}
                onChange={(e) => setWasteNotes(e.target.value)}
                className="rounded-xl text-xs min-h-[60px]"
              />
            </div>

            {/* Auto Deduct Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground cursor-pointer">
                  Auto-Deduct from Live Inventory
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Immediately reduce {wasteQty} {selectedProduct?.unit || "kg"} from live stock.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoDeductStock}
                onChange={(e) => setAutoDeductStock(e.target.checked)}
                className="size-5 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="w-1/3 rounded-xl text-xs font-semibold"
                onClick={() => setOpenLogModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
                onClick={handleSaveWaste}
              >
                Confirm & Log Loss
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
