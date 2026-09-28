import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Plus,
  Trash2,
  Edit2,
  Users,
  Power,
  MessageSquare,
  Save,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import type { RestaurantTable, SiteSettings } from "@/lib/types";

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

const DEFAULT_SECTIONS = [
  "Main Hall",
  "AC Dining",
  "Rooftop",
  "Outdoor Garden",
  "Bar Counter",
  "VIP Booth",
];

const DEFAULT_TABLES: RestaurantTable[] = Array.from({ length: 12 }, (_, i) => {
  const num = i + 1;
  return {
    id: String(num),
    name: `Table ${String(num).padStart(2, "0")}`,
    seating_capacity: 4,
    section: i < 6 ? "Main Hall" : "AC Dining",
    status: "active",
  };
});

function TableQrStudioPage() {
  const qc = useQueryClient();
  const { data: rawSettings } = useQuery(settingsQuery);
  const settings = rawSettings as (SiteSettings & {
    table_ordering_enabled?: boolean | null;
    table_ordering_offline_message?: string | null;
    restaurant_tables?: RestaurantTable[] | null;
  }) | null;

  // Master switch state
  const [masterEnabled, setMasterEnabled] = useState<boolean>(true);
  const [offlineMessage, setOfflineMessage] = useState<string>(
    "Table ordering is currently offline. Please call our steward or visit the counter."
  );
  const [isEditingOfflineMsg, setIsEditingOfflineMsg] = useState(false);

  // Local tables state
  const [tables, setTables] = useState<RestaurantTable[]>(DEFAULT_TABLES);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  // Sync settings when loaded from DB
  useEffect(() => {
    if (settings) {
      if (settings.table_ordering_enabled !== undefined && settings.table_ordering_enabled !== null) {
        setMasterEnabled(Boolean(settings.table_ordering_enabled));
      }
      if (settings.table_ordering_offline_message) {
        setOfflineMessage(settings.table_ordering_offline_message);
      }
      if (Array.isArray(settings.restaurant_tables) && settings.restaurant_tables.length > 0) {
        setTables(settings.restaurant_tables as RestaurantTable[]);
      }
      setIsInitialLoaded(true);
    }
  }, [settings]);

  // Dialog states for Add & Edit
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  // Form states for Add table
  const [newTableId, setNewTableId] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableSection, setNewTableSection] = useState("Main Hall");
  const [newTableCustomSection, setNewTableCustomSection] = useState("");
  const [newTableStatus, setNewTableStatus] = useState<"active" | "maintenance" | "reserved">("active");

  // Filter tabs
  const [activeFilter, setActiveFilter] = useState<string>("all"); // "all" | "free" | "occupied" | "maint_reserved" | section name
  const [previewTableId, setPreviewTableId] = useState<string | null>(null);
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);
  const [isBulkPrinting, setIsBulkPrinting] = useState<boolean>(false);

  // Cached generated QR data URLs by table.id
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

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

  // Map table IDs / numbers to active orders
  const occupancyMap = useMemo(() => {
    const map = new Map<string, ActiveOrderInfo>();
    activeOrders.forEach((o) => {
      if (o.table_number) {
        const raw = o.table_number.trim();
        const digits = raw.replace(/\D/g, "");
        if (!map.has(raw)) map.set(raw, o);
        if (digits && !map.has(digits)) map.set(digits, o);
        if (digits && !map.has(String(parseInt(digits, 10)))) {
          map.set(String(parseInt(digits, 10)), o);
        }
      }
    });
    return map;
  }, [activeOrders]);

  // Generate crisp QR code data URLs for all tables
  useEffect(() => {
    if (typeof window === "undefined" || tables.length === 0) return;
    const origin = window.location.origin;

    const generateQrs = async () => {
      const nextMap: Record<string, string> = {};
      for (const t of tables) {
        const targetUrl = `${origin}/table/${t.id}`;
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
          nextMap[t.id] = dataUrl;
        } catch (err) {
          console.error("QR generation error for table", t.id, err);
        }
      }
      setQrMap(nextMap);
    };

    void generateQrs();
  }, [tables]);

  // Mutation to persist store_settings changes
  const saveSettingsMutation = useMutation({
    mutationFn: async (patch: {
      table_ordering_enabled?: boolean;
      table_ordering_offline_message?: string;
      restaurant_tables?: RestaurantTable[];
    }) => {
      if (!settings?.id) {
        throw new Error("Store settings ID not loaded");
      }
      const { error } = await supabase
        .from("store_settings")
        .update(patch as never)
        .eq("id", settings.id);

      if (error) throw error;
      return patch;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: settingsQuery.queryKey });
      if (vars.table_ordering_enabled !== undefined) {
        toast.success(
          vars.table_ordering_enabled
            ? "Table QR Ordering is now ONLINE 🟢"
            : "Table QR Ordering is now PAUSED / OFFLINE 🔴"
        );
      } else if (vars.restaurant_tables) {
        toast.success("Tables configuration saved successfully!");
      } else if (vars.table_ordering_offline_message) {
        toast.success("Offline message updated!");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update table settings");
    },
  });

  const handleToggleMaster = (nextVal: boolean) => {
    setMasterEnabled(nextVal);
    saveSettingsMutation.mutate({ table_ordering_enabled: nextVal });
  };

  const handleSaveOfflineMessage = () => {
    saveSettingsMutation.mutate({ table_ordering_offline_message: offlineMessage });
    setIsEditingOfflineMsg(false);
  };

  const handleSaveTablesToDb = (newTablesList: RestaurantTable[]) => {
    setTables(newTablesList);
    saveSettingsMutation.mutate({ restaurant_tables: newTablesList });
  };

  // Add Table
  const handleAddNewTable = () => {
    const trimmedId = newTableId.trim().toLowerCase().replace(/\s+/g, "-");
    const trimmedName = newTableName.trim() || `Table ${trimmedId}`;
    const section = newTableSection === "__custom__"
      ? (newTableCustomSection.trim() || "Main Hall")
      : newTableSection;

    if (!trimmedId) {
      toast.error("Please enter a valid Table ID or number");
      return;
    }

    if (tables.some((t) => t.id.toLowerCase() === trimmedId.toLowerCase())) {
      toast.error(`Table ID "${trimmedId}" already exists. Please choose a unique ID.`);
      return;
    }

    const created: RestaurantTable = {
      id: trimmedId,
      name: trimmedName,
      seating_capacity: Number(newTableCapacity) || 4,
      section: section || "Main Hall",
      status: newTableStatus,
    };

    const nextList = [...tables, created];
    handleSaveTablesToDb(nextList);
    setIsAddOpen(false);
    setNewTableId("");
    setNewTableName("");
    setNewTableCapacity(4);
    setNewTableCustomSection("");
    toast.success(`Added ${created.name} (${created.section})!`);
  };

  // Edit Table
  const handleUpdateTable = () => {
    if (!editingTable) return;
    const nextList = tables.map((t) =>
      t.id === editingTable.id ? editingTable : t
    );
    handleSaveTablesToDb(nextList);
    setEditingTable(null);
    toast.success(`Updated ${editingTable.name}!`);
  };

  // Delete Table
  const handleDeleteTable = (idToDelete: string) => {
    const nextList = tables.filter((t) => t.id !== idToDelete);
    handleSaveTablesToDb(nextList);
    setEditingTable(null);
    toast.success("Table deleted successfully.");
  };

  // Quick toggle status between active & maintenance
  const handleToggleTableActive = (t: RestaurantTable) => {
    const nextStatus: "active" | "maintenance" = t.status === "active" ? "maintenance" : "active";
    const nextList = tables.map((item) =>
      item.id === t.id ? { ...item, status: nextStatus } : item
    );
    handleSaveTablesToDb(nextList);
  };

  const handleCopyLink = (tableId: string) => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/table/${tableId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTableId(tableId);
      toast.success(`Copied Table ${tableId} URL to clipboard`);
      setTimeout(() => setCopiedTableId(null), 2500);
    });
  };

  const handleDownloadQr = (table: RestaurantTable) => {
    const dataUrl = qrMap[table.id];
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `${table.name.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    link.href = dataUrl;
    link.click();
    toast.success(`Downloaded QR code for ${table.name}`);
  };

  const handlePrintSingleStandee = (tableId: string) => {
    setPreviewTableId(tableId);
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

  // Distinct sections
  const uniqueSections = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set);
  }, [tables]);

  // Filtered tables list
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const isOccupied = occupancyMap.has(t.id) || occupancyMap.has(t.name);
      const isMaintOrReserved = t.status === "maintenance" || t.status === "reserved";

      if (activeFilter === "all") return true;
      if (activeFilter === "free") return !isOccupied && !isMaintOrReserved;
      if (activeFilter === "occupied") return isOccupied && !isMaintOrReserved;
      if (activeFilter === "maint_reserved") return isMaintOrReserved;
      // Filter by section name
      return t.section === activeFilter;
    });
  }, [tables, occupancyMap, activeFilter]);

  const storeName = (settings as any)?.firm_name || (settings as any)?.store_name || "FISH N FRESH HUB";
  const storeAddress = (settings as any)?.shop_address || "Kasimedu Marine Terminal, Chennai";

  const freeCount = useMemo(() => {
    return tables.filter(
      (t) =>
        t.status === "active" &&
        !occupancyMap.has(t.id) &&
        !occupancyMap.has(t.name)
    ).length;
  }, [tables, occupancyMap]);

  const occupiedCount = useMemo(() => {
    return tables.filter(
      (t) =>
        t.status === "active" &&
        (occupancyMap.has(t.id) || occupancyMap.has(t.name))
    ).length;
  }, [tables, occupancyMap]);

  const maintReservedCount = useMemo(() => {
    return tables.filter((t) => t.status === "maintenance" || t.status === "reserved").length;
  }, [tables]);

  const previewTableObj = useMemo(() => {
    return tables.find((t) => t.id === previewTableId) || null;
  }, [tables, previewTableId]);

  return (
    <AdminShell title="Table QR Studio & Standee Generator">
      {/* ─── PRINT ONLY: Bulk All Standees Template (Hidden on screen) ─── */}
      <div className="hidden print:block print-all-standees-container">
        {(isBulkPrinting ? filteredTables : previewTableObj ? [previewTableObj] : []).map(
          (t) => (
            <div
              key={t.id}
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
                <span className="text-2xl font-black tracking-wider uppercase">
                  {t.name}
                </span>
                <span className="text-[10px] text-slate-300 block font-medium">
                  {t.section} • {t.seating_capacity} Seater
                </span>
              </div>

              {/* Central Crisp QR Code */}
              <div className="relative p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-xs">
                {qrMap[t.id] ? (
                  <img
                    src={qrMap[t.id]}
                    alt={`QR Code ${t.name}`}
                    className="size-44 object-contain"
                  />
                ) : (
                  <div className="size-44 bg-slate-100 flex items-center justify-center text-xs">
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
                  <span>Browse live menu &amp; customize spice &amp; notes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] shrink-0">
                    3
                  </span>
                  <span>Food served hot directly to {t.name}</span>
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
        {/* Header Hero Banner with Master QR Toggle */}
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-[280px]">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                <QrCode className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  <span>Table QR Studio &amp; Acrylic Standees</span>
                  {masterEnabled ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                      🟢 Online
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] font-bold animate-pulse">
                      🔴 Paused / Offline
                    </Badge>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed mt-0.5">
                  Manage unlimited dining tables, custom sections, seating capacity, live occupancy, and print acrylic QR tent cards.
                </p>
              </div>
            </div>
          </div>

          {/* Master QR Switch & Top Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Master Toggle Pill */}
            <div className="flex items-center gap-2.5 bg-card border border-border p-2 px-3 rounded-2xl shadow-xs">
              <Power className={`size-4 ${masterEnabled ? "text-emerald-500" : "text-rose-500"}`} />
              <div className="text-xs">
                <p className="font-bold text-foreground">Master QR Ordering</p>
                <p className="text-[10px] text-muted-foreground">
                  {masterEnabled ? "Ordering Active" : "Ordering Paused"}
                </p>
              </div>
              <Switch
                checked={masterEnabled}
                onCheckedChange={handleToggleMaster}
                disabled={saveSettingsMutation.isPending}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingOfflineMsg(true)}
              className="rounded-2xl h-10 text-xs font-semibold gap-1.5 border-border"
              title="Configure offline customer message"
            >
              <MessageSquare className="size-3.5" />
              <span>Offline Message</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOrders()}
              className="rounded-2xl h-10 text-xs font-semibold gap-1.5 border-border"
              title="Refresh live table occupancy"
            >
              <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin text-primary" : ""}`} />
              <span>Refresh</span>
            </Button>

            <Button
              onClick={() => setIsAddOpen(true)}
              className="rounded-2xl h-10 text-xs font-bold px-4 bg-primary text-primary-foreground gap-1.5 shadow-sm"
            >
              <Plus className="size-4" />
              <span>Add Table</span>
            </Button>

            <Button
              variant="secondary"
              onClick={handlePrintAllStandees}
              className="rounded-2xl h-10 text-xs font-bold px-4 gap-1.5 shadow-xs"
              title="Print acrylic tent cards for all visible tables"
            >
              <Printer className="size-4" />
              <span>Print Standees ({filteredTables.length})</span>
            </Button>
          </div>
        </div>

        {/* Offline Banner Notice if Master is disabled */}
        {!masterEnabled && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Table QR ordering is currently offline for customers.</strong> Message displayed: &quot;{offlineMessage}&quot;
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleToggleMaster(true)}
              className="h-7 text-xs rounded-xl font-bold border-amber-500/40 text-amber-700 dark:text-amber-300"
            >
              Turn On Now
            </Button>
          </div>
        )}

        {/* Filter Toolbar & Section Pills */}
        <Card className="rounded-3xl border-border/80 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl text-xs flex-wrap">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "all"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Tables ({tables.length})
              </button>

              {/* Dynamic Section Filter Tabs */}
              {uniqueSections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setActiveFilter(sec)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    activeFilter === sec
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sec} ({tables.filter((t) => t.section === sec).length})
                </button>
              ))}

              <button
                onClick={() => setActiveFilter("free")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "free"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🟢 Free ({freeCount})
              </button>

              <button
                onClick={() => setActiveFilter("occupied")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "occupied"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🔴 Occupied ({occupiedCount})
              </button>

              <button
                onClick={() => setActiveFilter("maint_reserved")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeFilter === "maint_reserved"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚪ Maintenance / Reserved ({maintReservedCount})
              </button>
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Showing <strong>{filteredTables.length}</strong> of <strong>{tables.length}</strong> tables
            </div>
          </CardContent>
        </Card>

        {/* Tables Grid */}
        {filteredTables.length === 0 ? (
          <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-3xl space-y-3">
            <Utensils className="size-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm font-semibold text-foreground">No tables found matching this filter</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveFilter("all")}
              className="rounded-xl text-xs"
            >
              Show All Tables
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTables.map((t) => {
              const isMaintenance = t.status === "maintenance";
              const isReserved = t.status === "reserved";
              const activeOrder = occupancyMap.get(t.id) || occupancyMap.get(t.name);
              const isOccupied = Boolean(activeOrder) && t.status === "active";
              const dataUrl = qrMap[t.id];

              return (
                <Card
                  key={t.id}
                  className={`rounded-3xl border transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                    isMaintenance
                      ? "opacity-60 bg-muted/20 border-border/60"
                      : isReserved
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                      : isOccupied
                      ? "border-rose-500/40 bg-rose-500/5 hover:border-rose-500"
                      : "border-border/80 hover:border-primary/50"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`size-9 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                            isMaintenance
                              ? "bg-muted text-muted-foreground"
                              : isReserved
                              ? "bg-amber-500 text-white"
                              : isOccupied
                              ? "bg-rose-500 text-white"
                              : "bg-primary/20 text-primary"
                          }`}
                        >
                          {t.id.slice(0, 4).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-extrabold text-foreground truncate">
                            {t.name}
                          </CardTitle>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                            <span>{t.section}</span>
                            <span>•</span>
                            <span>{t.seating_capacity} seats</span>
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isMaintenance ? (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-muted-foreground/30 text-muted-foreground shrink-0">
                          Maintenance
                        </Badge>
                      ) : isReserved ? (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-500/40 text-amber-700 bg-amber-500/10 shrink-0">
                          Reserved
                        </Badge>
                      ) : isOccupied ? (
                        <Badge className="text-[10px] px-2 py-0.5 bg-rose-600 text-white font-bold animate-pulse shrink-0">
                          🔴 Occupied
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/40 text-emerald-600 bg-emerald-500/5 shrink-0">
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
                          alt={`QR for ${t.name}`}
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
                          onClick={() => setPreviewTableId(t.id)}
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
                          checked={t.status === "active"}
                          onCheckedChange={() => handleToggleTableActive(t)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintSingleStandee(t.id)}
                          className="h-8 text-[11px] font-bold rounded-xl gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Printer className="size-3" />
                          <span>Print Card</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTable(t)}
                          className="h-8 text-[11px] font-bold rounded-xl gap-1"
                        >
                          <Edit2 className="size-3" />
                          <span>Edit</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyLink(t.id)}
                          className="h-7 text-[10px] font-semibold rounded-xl gap-1 text-muted-foreground"
                          title="Copy direct ordering URL"
                        >
                          {copiedTableId === t.id ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          <span>{copiedTableId === t.id ? "Copied" : "Copy URL"}</span>
                        </Button>

                        <a
                          href={`/table/${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 rounded-xl"
                        >
                          <span>Open Menu</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Add Table Dialog ─── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              <span>Add New Dining Table</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure a new table for QR code ordering and live dining occupancy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Table ID / Number *</label>
              <Input
                value={newTableId}
                onChange={(e) => setNewTableId(e.target.value)}
                placeholder="e.g. 13, rooftop-4, vip-2"
                className="h-9 rounded-xl text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Used in the customer URL: /table/{newTableId || "id"}
              </span>
            </div>

            <div>
              <label className="font-semibold block mb-1">Display Name *</label>
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g. Table 13, Rooftop Garden 4, Family AC Booth 2"
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Seating Capacity</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="h-9 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Initial Status</label>
                <Select
                  value={newTableStatus}
                  onValueChange={(v: "active" | "maintenance" | "reserved") => setNewTableStatus(v)}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="maintenance">⚪ Maintenance</SelectItem>
                    <SelectItem value="reserved">🟡 Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Section / Floor</label>
              <Select
                value={newTableSection}
                onValueChange={(val) => setNewTableSection(val)}
              >
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_SECTIONS.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">➕ Custom Section...</SelectItem>
                </SelectContent>
              </Select>

              {newTableSection === "__custom__" && (
                <Input
                  value={newTableCustomSection}
                  onChange={(e) => setNewTableCustomSection(e.target.value)}
                  placeholder="Enter custom section name (e.g. Poolside Terrace)"
                  className="h-9 rounded-xl text-xs mt-2"
                />
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNewTable}
              className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground"
            >
              Create Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Table Dialog ─── */}
      <Dialog open={editingTable !== null} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="size-5 text-primary" />
              <span>Edit Table — {editingTable?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {editingTable && (
            <div className="space-y-3.5 pt-2 text-xs">
              <div>
                <label className="font-semibold block mb-1">Display Name</label>
                <Input
                  value={editingTable.name}
                  onChange={(e) =>
                    setEditingTable({ ...editingTable, name: e.target.value })
                  }
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Seating Capacity</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={editingTable.seating_capacity}
                    onChange={(e) =>
                      setEditingTable({
                        ...editingTable,
                        seating_capacity: Number(e.target.value) || 2,
                      })
                    }
                    className="h-9 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Status</label>
                  <Select
                    value={editingTable.status}
                    onValueChange={(v: "active" | "maintenance" | "reserved") =>
                      setEditingTable({ ...editingTable, status: v })
                    }
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">🟢 Active</SelectItem>
                      <SelectItem value="maintenance">⚪ Maintenance</SelectItem>
                      <SelectItem value="reserved">🟡 Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Section</label>
                <Input
                  value={editingTable.section}
                  onChange={(e) =>
                    setEditingTable({ ...editingTable, section: e.target.value })
                  }
                  placeholder="e.g. Rooftop, Main Hall"
                  className="h-9 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteTable(editingTable.id)}
                  className="rounded-xl h-9 text-xs gap-1 font-bold"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Table</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditingTable(null)}
                    className="rounded-xl h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateTable}
                    className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Offline Message Config Dialog ─── */}
      <Dialog open={isEditingOfflineMsg} onOpenChange={setIsEditingOfflineMsg}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <span>Table Ordering Offline Screen</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Customize the message shown to guests when Master QR Ordering is turned off.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Customer Offline Notice</label>
              <textarea
                rows={4}
                value={offlineMessage}
                onChange={(e) => setOfflineMessage(e.target.value)}
                placeholder="Enter offline notice message for diners..."
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditingOfflineMsg(false)}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveOfflineMessage}
              disabled={saveSettingsMutation.isPending}
              className="rounded-xl h-9 text-xs font-bold bg-primary text-primary-foreground gap-1.5"
            >
              <Save className="size-3.5" />
              <span>Save Notice</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Individual Standee Acrylic Preview Modal ─── */}
      <Dialog open={previewTableId !== null} onOpenChange={(open) => !open && setPreviewTableId(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>{previewTableObj?.name} Acrylic Standee</span>
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                4&quot; × 6&quot; / A6
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preview how this table tent card will look when printed on acrylic or cardstock.
            </DialogDescription>
          </DialogHeader>

          {previewTableObj && (
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
                  <span className="text-lg font-black tracking-wider uppercase">
                    {previewTableObj.name}
                  </span>
                  <span className="text-[9px] text-slate-300 block">
                    {previewTableObj.section} • {previewTableObj.seating_capacity} Seater
                  </span>
                </div>

                <div className="p-2 bg-white border border-slate-900 rounded-xl">
                  {qrMap[previewTableObj.id] && (
                    <img
                      src={qrMap[previewTableObj.id]}
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
                  onClick={() => setPreviewTableId(null)}
                  className="rounded-2xl h-10 text-xs px-4"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadQr(previewTableObj)}
                    className="rounded-2xl h-10 text-xs font-semibold gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Download QR</span>
                  </Button>
                  <Button
                    onClick={() => handlePrintSingleStandee(previewTableObj.id)}
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
