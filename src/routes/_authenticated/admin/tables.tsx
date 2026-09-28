import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  QrCode,
  Printer,
  ExternalLink,
  Copy,
  Check,
  Utensils,
  Sliders,
  Eye,
  RefreshCw,
  Layers,
  ShieldCheck,
  Download,
  AlertCircle,
  Wifi,
  Sparkles,
  Store,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/tables")({
  head: () => ({
    meta: [
      { title: "Table QR Studio & Standee Generator | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Manage restaurant dine-in tables, monitor live table occupancy, and print acrylic QR standees.",
      },
    ],
  }),
  component: TableQrStudioPage,
});

interface ActiveOrderInfo {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
  table_number: string | null;
}

function TableQrStudioPage() {
  const { data: settings } = useQuery(settingsQuery);

  // Table Count state (1 to 30) persisted in localStorage
  const [tableCount, setTableCount] = useState<number>(() => {
    if (typeof window === "undefined") return 12;
    try {
      const saved = localStorage.getItem("fnf_table_count");
      return saved ? Math.min(30, Math.max(1, Number(saved))) : 12;
    } catch {
      return 12;
    }
  });

  // Set of disabled/maintenance tables persisted in localStorage
  const [inactiveTables, setInactiveTables] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("fnf_inactive_tables");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Cached generated QR data URLs
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [activeFilter, setActiveFilter] = useState<"all" | "free" | "occupied" | "inactive">("all");
  const [previewTable, setPreviewTable] = useState<number | null>(null);
  const [copiedTable, setCopiedTable] = useState<number | null>(null);
  const [isBulkPrinting, setIsBulkPrinting] = useState<boolean>(false);

  // Query live active dine-in orders to compute occupancy
  const { data: activeOrders = [], refetch: refetchOrders, isRefetching } = useQuery<ActiveOrderInfo[]>({
    queryKey: ["admin_table_occupancy_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total, status, created_at, table_number")
        .in("fulfillment_type", ["dine_in", "pos", "table"])
        .not("table_number", "is", null)
        .not("status", "in", '("delivered","cancelled","completed")')
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data as any) || [];
    },
    refetchInterval: 8000,
  });

  // Map table numbers to their active order (if any)
  const occupancyMap = useMemo(() => {
    const map = new Map<number, ActiveOrderInfo>();
    activeOrders.forEach((o) => {
      if (o.table_number) {
        const num = parseInt(o.table_number.replace(/\D/g, ""), 10);
        if (!isNaN(num) && !map.has(num)) {
          map.set(num, o);
        }
      }
    });
    return map;
  }, [activeOrders]);

  // Generate crisp QR code data URLs for all tables
  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;

    const generateQrs = async () => {
      const nextMap: Record<number, string> = {};
      for (let t = 1; t <= tableCount; t++) {
        const targetUrl = `${origin}/table/${t}`;
        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            width: 480,
            margin: 2,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
            errorCorrectionLevel: "H",
          });
          nextMap[t] = dataUrl;
        } catch (err) {
          console.error("QR generation error for table", t, err);
        }
      }
      setQrMap(nextMap);
    };

    void generateQrs();
  }, [tableCount]);

  const handleUpdateTableCount = (next: number) => {
    const clamped = Math.min(30, Math.max(1, next));
    setTableCount(clamped);
    try {
      localStorage.setItem("fnf_table_count", String(clamped));
      toast.success(`Active tables configured: ${clamped} tables`);
    } catch {}
  };

  const handleToggleTableActive = (tableNo: number) => {
    const next = new Set(inactiveTables);
    if (next.has(tableNo)) {
      next.delete(tableNo);
      toast.success(`Table ${tableNo} marked active for ordering`);
    } else {
      next.add(tableNo);
      toast.info(`Table ${tableNo} set to maintenance/inactive`);
    }
    setInactiveTables(next);
    try {
      localStorage.setItem("fnf_inactive_tables", JSON.stringify(Array.from(next)));
    } catch {}
  };

  const handleCopyLink = (tableNo: number) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/table/${tableNo}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTable(tableNo);
      toast.success(`Copied Table ${tableNo} ordering URL to clipboard`);
      setTimeout(() => setCopiedTable(null), 2500);
    });
  };

  const handleDownloadQr = (tableNo: number) => {
    const dataUrl = qrMap[tableNo];
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `table-${String(tableNo).padStart(2, "0")}-qr.png`;
    link.href = dataUrl;
    link.click();
    toast.success(`Downloaded QR code for Table ${tableNo}`);
  };

  const handlePrintSingleStandee = (tableNo: number) => {
    setPreviewTable(tableNo);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handlePrintAllStandees = () => {
    setIsBulkPrinting(true);
    setTimeout(() => {
      window.print();
      setIsBulkPrinting(false);
    }, 400);
  };

  // Filtered tables list
  const tables = useMemo(() => {
    const list: number[] = [];
    for (let t = 1; t <= tableCount; t++) {
      const isInactive = inactiveTables.has(t);
      const isOccupied = occupancyMap.has(t);

      if (activeFilter === "inactive" && !isInactive) continue;
      if (activeFilter === "occupied" && (!isOccupied || isInactive)) continue;
      if (activeFilter === "free" && (isOccupied || isInactive)) continue;
      list.push(t);
    }
    return list;
  }, [tableCount, inactiveTables, occupancyMap, activeFilter]);

  const storeName = (settings as any)?.firm_name || (settings as any)?.store_name || "FISH N FRESH HUB";
  const storeAddress = (settings as any)?.shop_address || "Kasimedu Marine Terminal, Chennai";

  return (
    <AdminShell title="Table QR Studio & Standee Generator">
      {/* ─── PRINT ONLY: Bulk All Standees Template (Hidden on screen) ─── */}
      <div className="hidden print:block print-all-standees-container">
        {(isBulkPrinting ? Array.from({ length: tableCount }, (_, i) => i + 1) : previewTable ? [previewTable] : []).map(
          (t) => (
            <div
              key={t}
              className="page-standee w-[4in] h-[6in] max-w-[4in] max-h-[6in] mx-auto p-6 bg-white text-slate-900 border-4 border-slate-900 rounded-3xl flex flex-col justify-between items-center text-center shadow-none mb-0"
              style={{ pageBreakAfter: "always" }}
            >
              {/* Header */}
              <div className="w-full space-y-1 border-b-2 border-slate-900 pb-3">
                <div className="text-[11px] font-black uppercase tracking-widest text-primary">
                  ★ Contactless Table Ordering ★
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                  {storeName}
                </h1>
                <p className="text-[10px] text-slate-600 line-clamp-1">{storeAddress}</p>
              </div>

              {/* Big Table Badge */}
              <div className="my-2 bg-slate-900 text-white rounded-2xl px-6 py-2 shadow-sm">
                <span className="text-xs uppercase tracking-widest block font-bold text-slate-300">
                  You Are Seated At
                </span>
                <span className="text-2xl font-black tracking-wider">
                  TABLE {String(t).padStart(2, "0")}
                </span>
              </div>

              {/* Central Crisp QR Code */}
              <div className="relative p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-xs">
                {qrMap[t] ? (
                  <img
                    src={qrMap[t]}
                    alt={`QR Code Table ${t}`}
                    className="size-48 object-contain"
                  />
                ) : (
                  <div className="size-48 bg-slate-100 flex items-center justify-center text-xs">
                    Generating...
                  </div>
                )}
                <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  Scan With Any Phone Camera
                </div>
              </div>

              {/* Instruction Steps */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] text-left space-y-1 font-semibold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] shrink-0">
                    1
                  </span>
                  <span>Point camera at QR code above (No app required)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] shrink-0">
                    2
                  </span>
                  <span>Browse live menu &amp; customize your order</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] shrink-0">
                    3
                  </span>
                  <span>Food served hot directly to Table {String(t).padStart(2, "0")}</span>
                </div>
              </div>

              {/* Accepted Payment Badges */}
              <div className="w-full pt-2 border-t border-slate-200">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Pay At Table or Counter:
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-700 flex-wrap">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">GPay</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded">PhonePe</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded">Paytm</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded">UPI</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded">Cash</span>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ─── SCREEN UI: Table Studio Workspace ─── */}
      <div className="space-y-6 max-w-7xl mx-auto pb-16 print:hidden">
        {/* Header Hero Banner */}
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-[280px]">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                <QrCode className="size-5" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                Table QR Studio &amp; Acrylic Standees
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Generate instant table-side ordering QR codes, monitor live table occupancy status, and print
              high-impact acrylic tent cards for your restaurant or dining hall.
            </p>
          </div>

          {/* Quick Global Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOrders()}
              className="rounded-2xl h-10 text-xs font-semibold gap-1.5 border-border"
              title="Refresh live table occupancy"
            >
              <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin text-primary" : ""}`} />
              <span>Refresh Status</span>
            </Button>

            <Button
              onClick={handlePrintAllStandees}
              className="rounded-2xl h-10 text-xs font-bold px-4.5 bg-primary text-primary-foreground gap-2 shadow-sm"
              title="Print 4x6 acrylic tent cards for all configured tables"
            >
              <Printer className="size-4" />
              <span>Print All Standees ({tableCount})</span>
            </Button>
          </div>
        </div>

        {/* Configuration & Filter Toolbar */}
        <Card className="rounded-3xl border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            {/* Table Count Adjuster */}
            <div className="flex items-center gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-foreground block">
                  Total Active Tables ({tableCount})
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Range: 1 to 30 dining tables
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={tableCount <= 1}
                  onClick={() => handleUpdateTableCount(tableCount - 1)}
                  className="size-8 p-0 rounded-xl"
                >
                  -
                </Button>
                <span className="w-8 text-center font-mono font-bold text-sm">
                  {tableCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={tableCount >= 30}
                  onClick={() => handleUpdateTableCount(tableCount + 1)}
                  className="size-8 p-0 rounded-xl"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl text-xs">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "all"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({tableCount})
              </button>
              <button
                onClick={() => setActiveFilter("free")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "free"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🟢 Free ({tableCount - occupancyMap.size - inactiveTables.size})
              </button>
              <button
                onClick={() => setActiveFilter("occupied")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "occupied"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🔴 Occupied ({occupancyMap.size})
              </button>
              <button
                onClick={() => setActiveFilter("inactive")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "inactive"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚪ Inactive ({inactiveTables.size})
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((t) => {
            const isInactive = inactiveTables.has(t);
            const activeOrder = occupancyMap.get(t);
            const isOccupied = Boolean(activeOrder) && !isInactive;
            const dataUrl = qrMap[t];
            const tablePad = String(t).padStart(2, "0");

            return (
              <Card
                key={t}
                className={`rounded-3xl border transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                  isInactive
                    ? "opacity-60 bg-muted/20 border-border/60"
                    : isOccupied
                    ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500"
                    : "border-border/80 hover:border-primary/50"
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-8 rounded-xl font-mono font-black text-xs flex items-center justify-center ${
                          isInactive
                            ? "bg-muted text-muted-foreground"
                            : isOccupied
                            ? "bg-rose-500 text-white"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {tablePad}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-extrabold text-foreground">
                          Table {tablePad}
                        </CardTitle>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          /table/{t}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isInactive ? (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-muted-foreground/30 text-muted-foreground">
                        Maintenance
                      </Badge>
                    ) : isOccupied ? (
                      <Badge className="text-[10px] px-2 py-0.5 bg-rose-600 text-white font-bold animate-pulse">
                        🔴 Occupied
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/40 text-emerald-600 bg-emerald-500/5">
                        🟢 Free
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                  {/* QR Image Box */}
                  <div className="p-3 bg-white dark:bg-slate-900 border border-border/80 rounded-2xl flex flex-col items-center justify-center relative group">
                    {dataUrl ? (
                      <img
                        src={dataUrl}
                        alt={`QR for Table ${t}`}
                        className="size-36 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="size-36 flex items-center justify-center text-xs text-muted-foreground">
                        Rendering QR...
                      </div>
                    )}

                    {/* Hover Quick Actions */}
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewTable(t)}
                        className="h-8 text-xs font-bold rounded-xl gap-1"
                      >
                        <Eye className="size-3.5" />
                        <span>Preview</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadQr(t)}
                        className="h-8 text-xs font-bold rounded-xl p-2"
                        title="Download PNG"
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Occupancy Info / Active Order Card */}
                  {isOccupied && activeOrder && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-rose-700 dark:text-rose-300">
                        <span>Order #{activeOrder.order_number || activeOrder.id.slice(0, 6)}</span>
                        <span className="font-extrabold">{formatINR(activeOrder.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[120px]">
                          {activeOrder.customer_name || "Dine-in Guest"}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 uppercase border-rose-500/30 text-rose-600">
                          {activeOrder.status}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Card Controls */}
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-muted-foreground">In Service:</span>
                      <Switch
                        checked={!isInactive}
                        onCheckedChange={() => handleToggleTableActive(t)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintSingleStandee(t)}
                        className="h-8 text-[11px] font-bold rounded-xl gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Printer className="size-3" />
                        <span>Print Card</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(t)}
                        className="h-8 text-[11px] font-bold rounded-xl gap-1"
                        title="Copy direct ordering URL"
                      >
                        {copiedTable === t ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span>{copiedTable === t ? "Copied" : "Copy URL"}</span>
                      </Button>
                    </div>

                    {/* Direct Test Customer Menu Link */}
                    <a
                      href={`/table/${t}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 py-0.5"
                    >
                      <span>Open Customer Menu</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Individual Standee Acrylic Preview Modal ─── */}
      <Dialog open={previewTable !== null} onOpenChange={(open) => !open && setPreviewTable(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Table {previewTable ? String(previewTable).padStart(2, "0") : ""} Acrylic Standee</span>
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                4&quot; × 6&quot; / A6
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preview how this table tent card will look when printed on acrylic or cardstock.
            </DialogDescription>
          </DialogHeader>

          {previewTable && (
            <div className="space-y-4 pt-2">
              {/* Standee Mock Preview */}
              <div className="w-[280px] h-[420px] mx-auto p-4 bg-white text-slate-900 border-2 border-slate-900 rounded-3xl flex flex-col justify-between items-center text-center shadow-lg">
                <div className="w-full space-y-0.5 border-b border-slate-900 pb-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-primary">
                    ★ Table-Side Ordering ★
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">
                    {storeName}
                  </h3>
                  <p className="text-[9px] text-slate-500 truncate">{storeAddress}</p>
                </div>

                <div className="bg-slate-900 text-white rounded-xl px-4 py-1.5">
                  <span className="text-[9px] uppercase tracking-wider block font-bold text-slate-300">
                    SEATED AT
                  </span>
                  <span className="text-lg font-black tracking-wider">
                    TABLE {String(previewTable).padStart(2, "0")}
                  </span>
                </div>

                <div className="p-2 bg-white border border-slate-900 rounded-xl">
                  {qrMap[previewTable] && (
                    <img
                      src={qrMap[previewTable]}
                      alt="QR Preview"
                      className="size-32 object-contain"
                    />
                  )}
                  <div className="text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                    Scan With Phone Camera
                  </div>
                </div>

                <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[8px] text-left space-y-0.5 font-semibold text-slate-700">
                  <div>1. Point camera at QR (No app needed)</div>
                  <div>2. Select dishes &amp; place order</div>
                  <div>3. Served directly to your table</div>
                </div>

                <div className="w-full pt-1.5 border-t border-slate-200">
                  <div className="flex items-center justify-center gap-1.5 text-[8px] font-bold text-slate-600">
                    <span>GPay</span> &bull; <span>PhonePe</span> &bull; <span>Paytm</span> &bull; <span>UPI</span> &bull; <span>Cash</span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewTable(null)}
                  className="rounded-2xl h-10 text-xs px-4"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadQr(previewTable)}
                    className="rounded-2xl h-10 text-xs font-semibold gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Download QR</span>
                  </Button>
                  <Button
                    onClick={() => handlePrintSingleStandee(previewTable)}
                    className="rounded-2xl h-10 text-xs font-bold px-4 bg-primary text-primary-foreground gap-1.5 shadow-sm"
                  >
                    <Printer className="size-3.5" />
                    <span>Print Standee</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
