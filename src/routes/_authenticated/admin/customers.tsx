import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  MessageCircle,
  Phone,
  Search,
  X,
  MapPin,
  Clock,
  ExternalLink,
  ShoppingBag,
  Copy,
  ChevronRight,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  ShieldCheck,
  Sparkles,
  Flame,
  Repeat,
  PackageCheck,
  Hourglass,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCustomersQuery, adminSuspensionsQuery, type CustomerRow, type OrderRow } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExportDropdown, type ExportColumn, type ExportOptions } from "@/lib/exportUtils";
import {
  listAllCustomersDetailed,
  type RegisteredCustomer,
  type PurchaseTier,
} from "@/lib/customer.functions";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers & User Registry | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Registered customer profiles, purchase frequency segmentation, login history, and order lifetime analytics.",
      },
    ],
  }),
  component: CustomersAdmin,
});

function CustomersAdmin() {
  const queryClient = useQueryClient();
  const customers = useQuery(adminCustomersQuery);
  const suspensions = useQuery(adminSuspensionsQuery);
  const rows = customers.data ?? [];
  const susMap = suspensions.data ?? {};

  // Registered customers server function
  const fetchRegisteredFn = useServerFn(listAllCustomersDetailed);
  const registeredQuery = useQuery({
    queryKey: ["admin", "registered-customers"],
    queryFn: () => fetchRegisteredFn(),
    staleTime: 60 * 1000,
  });
  const registeredRows = registeredQuery.data ?? [];

  // Tab State: "orders" is default as requested
  const [mainTab, setMainTab] = useState<"orders" | "registered">("orders");

  // Tab 1 (Orders) Filter & Sort State
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "repeat" | "new" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"spent" | "orders" | "recent" | "name">("spent");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  // Tab 2 (Registered Customers) Filter & Sort State
  const [regSearch, setRegSearch] = useState("");
  const [regTierFilter, setRegTierFilter] = useState<"all" | PurchaseTier>("all");
  const [regSortBy, setRegSortBy] = useState<"spent" | "orders" | "recent_login" | "joined" | "name">("spent");
  const [selectedRegCustomer, setSelectedRegCustomer] = useState<RegisteredCustomer | null>(null);

  // Fetch full orders for selected customer
  const activeModalPhone = selectedCustomer?.phone || selectedRegCustomer?.phone;
  const customerOrdersQuery = useQuery({
    queryKey: ["admin", "customer-orders", activeModalPhone],
    enabled: Boolean(activeModalPhone),
    queryFn: async (): Promise<OrderRow[]> => {
      if (!activeModalPhone) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_phone", activeModalPhone)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: async ({ phone, suspend }: { phone: string; suspend: boolean }) => {
      if (suspend) {
        const { error } = await supabase.from("customer_suspensions").insert({ phone, reason: "Admin suspended" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_suspensions").delete().eq("phone", phone);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Customer status updated");
      queryClient.invalidateQueries({ queryKey: ["admin", "suspensions"] });
    },
    onError: (err: any) => {
      toast.error(`Failed to update customer: ${err?.message || "Unknown error"}`);
    },
  });

  // Filter and sort Tab 1 (Orders Customers)
  const filtered = useMemo(() => {
    return rows
      .filter((c) => {
        const term = search.trim().toLowerCase();
        const matchesSearch =
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term);

        if (!matchesSearch) return false;

        if (filterType === "repeat") return c.orders > 1;
        if (filterType === "new") return c.orders === 1;
        if (filterType === "suspended") return Boolean(susMap[c.phone]);

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "spent") return b.spent - a.spent;
        if (sortBy === "orders") return b.orders - a.orders;
        if (sortBy === "recent") return new Date(b.last_order).getTime() - new Date(a.last_order).getTime();
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [rows, search, filterType, sortBy, susMap]);

  // Tab 2 (Registered Customers) Filtering & Metrics
  const regCounts = useMemo(() => {
    return {
      total: registeredRows.length,
      frequent: registeredRows.filter((r) => r.purchaseTier === "frequent").length,
      sometimes: registeredRows.filter((r) => r.purchaseTier === "sometimes").length,
      one_time: registeredRows.filter((r) => r.purchaseTier === "one_time").length,
      never: registeredRows.filter((r) => r.purchaseTier === "never").length,
    };
  }, [registeredRows]);

  const filteredRegistered = useMemo(() => {
    return registeredRows
      .filter((c) => {
        const term = regSearch.trim().toLowerCase();
        const matches =
          !term ||
          c.fullName.toLowerCase().includes(term) ||
          c.phone.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term);

        if (!matches) return false;

        if (regTierFilter !== "all" && c.purchaseTier !== regTierFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (regSortBy === "spent") return b.lifetimeSpent - a.lifetimeSpent;
        if (regSortBy === "orders") return b.ordersCount - a.ordersCount;
        if (regSortBy === "recent_login") {
          const tA = a.lastSignInAt ? new Date(a.lastSignInAt).getTime() : 0;
          const tB = b.lastSignInAt ? new Date(b.lastSignInAt).getTime() : 0;
          return tB - tA;
        }
        if (regSortBy === "joined") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (regSortBy === "name") return a.fullName.localeCompare(b.fullName);
        return 0;
      });
  }, [registeredRows, regSearch, regTierFilter, regSortBy]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Export options for Tab 1 (Orders Customers)
  const ordersExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "name", label: "Customer Name", type: "string" },
      { key: "phone", label: "Phone Number", type: "string" },
      { key: "orders", label: "Total Orders", type: "number" },
      { key: "spent", label: "Lifetime Spend (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      { key: "last_order", label: "Last Order Date (IST)", type: "date", format: (v) => formatIST(v) },
    ];
    return {
      filename: `fishnfresh-order-customers-${new Date().toISOString().slice(0, 10)}`,
      title: "Active Order Customers Registry",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | ${filtered.length} customers`,
      columns,
      data: filtered,
    };
  }, [filtered]);

  // Export options for Tab 2 (Registered Customers)
  const registeredExportOptions: ExportOptions = useMemo(() => {
    const columns: ExportColumn[] = [
      { key: "fullName", label: "Full Name", type: "string" },
      { key: "phone", label: "Phone Number", type: "string" },
      { key: "email", label: "Email Address", type: "string" },
      {
        key: "purchaseTier",
        label: "Purchase Frequency",
        type: "string",
        format: (v) =>
          v === "frequent"
            ? "Frequent (3+ Orders)"
            : v === "sometimes"
            ? "Repeat (2 Orders)"
            : v === "one_time"
            ? "First-Time (1 Order)"
            : "Never Purchased (0 Orders)",
      },
      { key: "ordersCount", label: "Orders Placed", type: "number" },
      { key: "lifetimeSpent", label: "Total Spent (₹)", type: "currency", format: (v) => formatINR(Number(v || 0)) },
      {
        key: "lastSignInAt",
        label: "Last Sign-In (IST)",
        type: "date",
        format: (v) => (v ? formatIST(v) : "Never logged in"),
      },
      { key: "createdAt", label: "Registration Date (IST)", type: "date", format: (v) => formatIST(v) },
    ];
    return {
      filename: `fishnfresh-registered-customers-${new Date().toISOString().slice(0, 10)}`,
      title: "All Registered & Signed-In Customers Directory",
      subtitle: `Exported on ${new Date().toLocaleDateString("en-IN")} | Filter: ${regTierFilter.toUpperCase()} | ${filteredRegistered.length} users`,
      columns,
      data: filteredRegistered,
      orientation: "landscape",
    };
  }, [filteredRegistered, regTierFilter]);

  // Extract unique addresses for active customer modal
  const customerOrders = customerOrdersQuery.data ?? [];
  const uniqueAddresses = Array.from(
    new Set(customerOrders.map((o) => o.customer_address).filter(Boolean))
  ) as string[];

  const completedOrdersCount = customerOrders.filter((o) => o.status === "delivered").length;
  const avgOrderValue = customerOrders.length > 0
    ? Math.round(
        customerOrders.reduce((acc, o) => acc + (o.status !== "cancelled" ? Number(o.total) : 0), 0) /
          Math.max(1, customerOrders.filter((o) => o.status !== "cancelled").length)
      )
    : 0;

  return (
    <AdminShell
      title="Customer Relationship Management"
      allow={["admin", "manager", "support_staff"]}
    >
      <Tabs
        value={mainTab}
        onValueChange={(v) => setMainTab(v as "orders" | "registered")}
        className="w-full space-y-4"
      >
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/80 pb-3">
          <TabsList className="w-full sm:w-auto overflow-x-auto no-scrollbar flex-nowrap shrink-0 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger
              value="orders"
              className="rounded-xl text-xs font-bold whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-xs px-4"
            >
              <ShoppingBag className="mr-1.5 size-3.5" />
              Active Customers ({rows.length})
            </TabsTrigger>
            <TabsTrigger
              value="registered"
              className="rounded-xl text-xs font-bold whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-xs px-4"
            >
              <Users className="mr-1.5 size-3.5" />
              All Registered Customers ({registeredRows.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {mainTab === "orders" ? (
              <ExportDropdown options={ordersExportOptions} buttonLabel="Export Customers" />
            ) : (
              <ExportDropdown options={registeredExportOptions} buttonLabel="Export Registry" />
            )}
          </div>
        </div>

        {/* TAB 1: ACTIVE ORDER-BASED CUSTOMERS (DEFAULT TAB) */}
        <TabsContent value="orders" className="space-y-4 mt-0">
          {/* Header Description */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground">Order Customers Directory ({filtered.length})</h2>
              <p className="text-xs text-muted-foreground">
                Aggregated lifetime spend and order history from customer checkouts.
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="space-y-2.5 sm:space-y-0 sm:grid sm:gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-6">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer name or phone..."
                className="pl-9 pr-8 rounded-xl h-10 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:col-span-6">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Filter customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({rows.length})</SelectItem>
                  <SelectItem value="repeat">Repeat ({rows.filter((r) => r.orders > 1).length})</SelectItem>
                  <SelectItem value="new">New ({rows.filter((r) => r.orders === 1).length})</SelectItem>
                  <SelectItem value="suspended">Suspended ({Object.keys(susMap).length})</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spent">Highest Spend</SelectItem>
                  <SelectItem value="orders">Most Orders</SelectItem>
                  <SelectItem value="recent">Recently Active</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Customer Cards List */}
          <div className="space-y-3">
            {filtered.map((c) => {
              const isSuspended = Boolean(susMap[c.phone]);
              return (
                <Card
                  key={c.phone}
                  className={`transition-all hover:border-primary/40 hover:shadow-xs ${
                    isSuspended ? "border-destructive/40 bg-destructive/5" : ""
                  }`}
                >
                  <CardContent className="flex flex-col gap-3 p-3.5 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="truncate text-base font-semibold hover:text-primary hover:underline text-left"
                        >
                          {c.name || "Unnamed Customer"}
                        </button>
                        {c.orders > 1 ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[10px]">
                            Repeated ({c.orders})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">
                            New Customer
                          </Badge>
                        )}
                        {isSuspended && (
                          <Badge variant="destructive" className="text-[10px]">
                            Suspended
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono font-medium text-foreground">{c.phone}</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={getWhatsAppUrl(c.phone, `Hello ${c.name || "Customer"}, this is Fish N Fresh Hub.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition"
                          >
                            <WhatsAppIcon className="size-3.5" /> WhatsApp
                          </a>
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Phone className="size-3" /> Call
                          </a>
                        </div>
                      </div>

                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" /> Last active: {formatIST(c.last_order)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="font-bold text-foreground sm:text-base">{formatINR(c.spent)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.orders} total {c.orders === 1 ? "order" : "orders"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl text-xs"
                          onClick={() => setSelectedCustomer(c)}
                        >
                          View Past Orders <ChevronRight className="ml-1 size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={isSuspended ? "outline" : "ghost"}
                          className={`h-8 rounded-xl text-xs ${
                            isSuspended
                              ? "text-green-600 border-green-200 hover:bg-green-50"
                              : "text-destructive hover:bg-destructive/10"
                          }`}
                          onClick={() => toggleSuspend.mutate({ phone: c.phone, suspend: !isSuspended })}
                          disabled={toggleSuspend.isPending}
                        >
                          {isSuspended ? "Unsuspend" : "Suspend"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                {search ? "No customers found matching your search." : "No customers found."}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: ALL REGISTERED & SIGNED-IN CUSTOMERS */}
        <TabsContent value="registered" className="space-y-4 mt-0">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <div
              onClick={() => setRegTierFilter("all")}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                regTierFilter === "all"
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Total Registered</span>
                <Users className="size-3.5 text-primary" />
              </div>
              <div className="mt-1.5 text-xl font-bold text-foreground">{regCounts.total}</div>
              <span className="text-[10px] text-muted-foreground">All app users</span>
            </div>

            <div
              onClick={() => setRegTierFilter("frequent")}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                regTierFilter === "frequent"
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span className="text-xs font-semibold">Frequent (3+)</span>
                <Flame className="size-3.5" />
              </div>
              <div className="mt-1.5 text-xl font-bold text-emerald-700 dark:text-emerald-300">{regCounts.frequent}</div>
              <span className="text-[10px] text-emerald-600/80">Loyal repeat buyers</span>
            </div>

            <div
              onClick={() => setRegTierFilter("sometimes")}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                regTierFilter === "sometimes"
                  ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/20 shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
                <span className="text-xs font-semibold">Repeat (2)</span>
                <Repeat className="size-3.5" />
              </div>
              <div className="mt-1.5 text-xl font-bold text-sky-700 dark:text-sky-300">{regCounts.sometimes}</div>
              <span className="text-[10px] text-sky-600/80">2 purchases made</span>
            </div>

            <div
              onClick={() => setRegTierFilter("one_time")}
              className={`cursor-pointer rounded-2xl border p-3 transition-all ${
                regTierFilter === "one_time"
                  ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                <span className="text-xs font-semibold">One-Time (1)</span>
                <PackageCheck className="size-3.5" />
              </div>
              <div className="mt-1.5 text-xl font-bold text-amber-700 dark:text-amber-300">{regCounts.one_time}</div>
              <span className="text-[10px] text-amber-600/80">1 order placed</span>
            </div>

            <div
              onClick={() => setRegTierFilter("never")}
              className={`cursor-pointer col-span-2 sm:col-span-1 rounded-2xl border p-3 transition-all ${
                regTierFilter === "never"
                  ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/20 shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                <span className="text-xs font-semibold">Never Bought (0)</span>
                <Hourglass className="size-3.5" />
              </div>
              <div className="mt-1.5 text-xl font-bold text-rose-700 dark:text-rose-300">{regCounts.never}</div>
              <span className="text-[10px] text-rose-600/80">Ready for 1st deal</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="space-y-2.5 sm:space-y-0 sm:grid sm:gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-6">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="pl-9 pr-8 rounded-xl h-10 text-sm"
              />
              {regSearch && (
                <button
                  type="button"
                  onClick={() => setRegSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:col-span-6">
              <Select
                value={regTierFilter}
                onValueChange={(v) => setRegTierFilter(v as typeof regTierFilter)}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Purchase status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({regCounts.total})</SelectItem>
                  <SelectItem value="frequent">🔥 Frequent (3+) ({regCounts.frequent})</SelectItem>
                  <SelectItem value="sometimes">🔁 Sometimes (2) ({regCounts.sometimes})</SelectItem>
                  <SelectItem value="one_time">📦 One-Time (1) ({regCounts.one_time})</SelectItem>
                  <SelectItem value="never">⏳ Never Bought (0) ({regCounts.never})</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={regSortBy}
                onValueChange={(v) => setRegSortBy(v as typeof regSortBy)}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spent">Highest Spend</SelectItem>
                  <SelectItem value="orders">Most Orders</SelectItem>
                  <SelectItem value="recent_login">Recent Log-in</SelectItem>
                  <SelectItem value="joined">Recently Joined</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Frequency Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <Button
              size="sm"
              variant={regTierFilter === "all" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs"
              onClick={() => setRegTierFilter("all")}
            >
              All ({regCounts.total})
            </Button>
            <Button
              size="sm"
              variant={regTierFilter === "frequent" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              onClick={() => setRegTierFilter("frequent")}
            >
              🔥 Frequent ({regCounts.frequent})
            </Button>
            <Button
              size="sm"
              variant={regTierFilter === "sometimes" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800"
              onClick={() => setRegTierFilter("sometimes")}
            >
              🔁 Sometimes ({regCounts.sometimes})
            </Button>
            <Button
              size="sm"
              variant={regTierFilter === "one_time" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
              onClick={() => setRegTierFilter("one_time")}
            >
              📦 One-Time ({regCounts.one_time})
            </Button>
            <Button
              size="sm"
              variant={regTierFilter === "never" ? "default" : "outline"}
              className="rounded-xl h-7 text-xs text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800"
              onClick={() => setRegTierFilter("never")}
            >
              ⏳ Never Purchased ({regCounts.never})
            </Button>
          </div>

          {/* Registered Customers List */}
          {registeredQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <div className="size-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              <span>Loading customer directory...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRegistered.map((c) => {
                const isNever = c.purchaseTier === "never";
                const isFrequent = c.purchaseTier === "frequent";
                const isSometimes = c.purchaseTier === "sometimes";

                const whatsappMsg = isNever
                  ? `Hello ${c.fullName}! Welcome to Fish N Fresh Hub. We noticed you joined our store! Enjoy ₹100 OFF on your first dock-fresh catch order today. Use coupon code FRESH100 at checkout: https://fishnfreshhub.com`
                  : `Hello ${c.fullName}! Thank you for being a valued customer at Fish N Fresh Hub. We have fresh dock catches arriving today! Check them out: https://fishnfreshhub.com`;

                return (
                  <Card
                    key={c.id}
                    className="transition-all hover:border-primary/40 hover:shadow-xs border border-border/80"
                  >
                    <CardContent className="flex flex-col gap-3 p-3.5 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRegCustomer(c);
                              setSelectedCustomer({
                                phone: c.phone,
                                name: c.fullName,
                                orders: c.ordersCount,
                                spent: c.lifetimeSpent,
                                last_order: c.lastOrderAt || c.createdAt,
                              });
                            }}
                            className="truncate text-base font-semibold hover:text-primary hover:underline text-left"
                          >
                            {c.fullName || "Customer"}
                          </button>

                          {/* Purchase Status Pill */}
                          {isFrequent && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold">
                              🔥 Frequent ({c.ordersCount} orders)
                            </Badge>
                          )}
                          {isSometimes && (
                            <Badge className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold">
                              🔁 Repeat ({c.ordersCount} orders)
                            </Badge>
                          )}
                          {c.purchaseTier === "one_time" && (
                            <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold">
                              📦 One-Time Buyer
                            </Badge>
                          )}
                          {isNever && (
                            <Badge
                              variant="outline"
                              className="border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-semibold"
                            >
                              ⏳ Never Bought (0 Orders)
                            </Badge>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {c.phone ? (
                            <span className="font-mono font-medium text-foreground">{c.phone}</span>
                          ) : (
                            <span className="text-muted-foreground italic">No phone</span>
                          )}

                          {c.email && (
                            <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                              <Mail className="size-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            {c.phone && (
                              <>
                                <a
                                  href={getWhatsAppUrl(c.phone, whatsappMsg)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition"
                                >
                                  <WhatsAppIcon className="size-3" /> WhatsApp
                                </a>
                                <a
                                  href={`tel:${c.phone}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition"
                                >
                                  <Phone className="size-3" /> Call
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Timing details */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-primary" />
                            Last Log-in:{" "}
                            <span className="font-medium text-foreground">
                              {c.lastSignInAt ? formatIST(c.lastSignInAt) : "Never logged in"}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            Joined: {formatIST(c.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Spend & Action Buttons */}
                      <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-foreground sm:text-base">
                            {formatINR(c.lifetimeSpent)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.ordersCount} {c.ordersCount === 1 ? "order" : "orders"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {c.ordersCount > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl text-xs"
                              onClick={() => {
                                setSelectedCustomer({
                                  phone: c.phone,
                                  name: c.fullName,
                                  orders: c.ordersCount,
                                  spent: c.lifetimeSpent,
                                  last_order: c.lastOrderAt || c.createdAt,
                                });
                              }}
                            >
                              Past Orders <ChevronRight className="ml-1 size-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                              onClick={() => {
                                if (c.phone) {
                                  window.open(getWhatsAppUrl(c.phone, whatsappMsg), "_blank");
                                } else {
                                  toast.info("No phone number available to message.");
                                }
                              }}
                            >
                              Send First Offer <Sparkles className="ml-1 size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredRegistered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                  {regSearch
                    ? "No registered customers matched your search query."
                    : "No customers in this filter segment."}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Customer Full Detail & Past Orders Modal */}
      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-5">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      {selectedCustomer.name || "Customer Profile"}
                      {susMap[selectedCustomer.phone] && (
                        <Badge variant="destructive" className="text-xs">
                          Suspended
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex items-center gap-2 font-mono text-sm text-foreground">
                      {selectedCustomer.phone}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedCustomer.phone, "Phone number")}
                        className="text-muted-foreground hover:text-foreground"
                        title="Copy phone"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={getWhatsAppUrl(
                        selectedCustomer.phone,
                        `Hello ${selectedCustomer.name || ""}, this is Fish N Fresh Hub regarding your order.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
                      title="Open WhatsApp chat directly"
                    >
                      <WhatsAppIcon className="size-3.5" /> WhatsApp
                    </a>
                    <a
                      href={`tel:${selectedCustomer.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
                    >
                      <Phone className="size-3.5" /> Call
                    </a>
                  </div>
                </div>
              </DialogHeader>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 my-2">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Lifetime Spent</p>
                  <p className="text-lg font-bold text-primary">{formatINR(selectedCustomer.spent)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Total Orders</p>
                  <p className="text-lg font-bold text-foreground">{selectedCustomer.orders}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Delivered</p>
                  <p className="text-lg font-bold text-green-600">{completedOrdersCount}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Avg Order Value</p>
                  <p className="text-lg font-bold text-foreground">{formatINR(avgOrderValue)}</p>
                </div>
              </div>

              {/* Delivery Addresses Used */}
              <div className="mt-4 rounded-xl border border-border bg-card p-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                  <MapPin className="size-3.5 text-primary" /> Delivery Addresses ({uniqueAddresses.length})
                </h4>
                {uniqueAddresses.length > 0 ? (
                  <div className="space-y-2">
                    {uniqueAddresses.map((addr, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-2.5 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground leading-relaxed">{addr}</p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                          >
                            <ExternalLink className="size-3" /> Open in Google Maps
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(addr, "Address")}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Copy address"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No delivery addresses logged yet.</p>
                )}
              </div>

              {/* Order History Timeline */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2.5">
                  <ShoppingBag className="size-3.5 text-primary" /> Past Orders History ({customerOrders.length})
                </h4>
                {customerOrdersQuery.isLoading ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading orders...</div>
                ) : customerOrders.length > 0 ? (
                  <div className="space-y-2.5">
                    {customerOrders.map((o) => (
                      <div
                        key={o.id}
                        className="rounded-xl border border-border/80 bg-card p-3 text-xs flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
                              {o.order_number ?? `#${o.id.slice(0, 8)}`}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                o.status === "delivered"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : o.status === "cancelled"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }
                            >
                              {o.status}
                            </Badge>
                          </div>
                          <span className="font-bold text-foreground">{formatINR(o.total)}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                          <span>{formatIST(o.created_at)}</span>
                          <span className="capitalize">
                            {o.fulfillment_type || "delivery"} • {o.payment_method || "cod"}
                          </span>
                        </div>

                        {/* Items list preview */}
                        {o.items && o.items.length > 0 && (
                          <div className="pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                            {o.items.map((it, idx) => (
                              <span key={idx} className="mr-2">
                                {it.name} × {it.qty}
                                {idx < o.items.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No previous orders found.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

export default CustomersAdmin;
