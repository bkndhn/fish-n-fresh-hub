import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminCustomersQuery, adminSuspensionsQuery, type CustomerRow, type OrderRow } from "@/lib/admin";
import { formatINR, formatIST } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Fish N Fresh Admin" },
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

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "repeat" | "new" | "suspended">("all");
  const [sortBy, setSortBy] = useState<"spent" | "orders" | "recent" | "name">("spent");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  // Fetch full orders for selected customer
  const customerOrdersQuery = useQuery({
    queryKey: ["admin", "customer-orders", selectedCustomer?.phone],
    enabled: Boolean(selectedCustomer?.phone),
    queryFn: async (): Promise<OrderRow[]> => {
      if (!selectedCustomer?.phone) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_phone", selectedCustomer.phone)
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

  // Filter and sort customers
  const filtered = rows.filter((c) => {
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
  });

  filtered.sort((a, b) => {
    if (sortBy === "spent") return b.spent - a.spent;
    if (sortBy === "orders") return b.orders - a.orders;
    if (sortBy === "recent") return new Date(b.last_order).getTime() - new Date(a.last_order).getTime();
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Orders", "Lifetime Spend", "Last Order"];
    const csv = [
      headers.join(","),
      ...filtered.map((c) => `"${c.name}","${c.phone}",${c.orders},${c.spent},"${formatIST(c.last_order)}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  // Extract unique addresses from the selected customer's orders
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
    <AdminShell title="Customers">
      {/* Top Header Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">All Customers ({filtered.length})</h2>
          <p className="text-xs text-muted-foreground">View customer profiles, search, and see past order histories.</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl self-start sm:self-auto" onClick={exportCSV}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 grid gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or phone..."
            className="pl-9 pr-8 rounded-xl"
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

        <div className="sm:col-span-3">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Filter customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({rows.length})</SelectItem>
              <SelectItem value="repeat">Repeat Customers ({rows.filter((r) => r.orders > 1).length})</SelectItem>
              <SelectItem value="new">New Customers ({rows.filter((r) => r.orders === 1).length})</SelectItem>
              <SelectItem value="suspended">Suspended ({Object.keys(susMap).length})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="rounded-xl">
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

      {/* Customers List */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const isSuspended = Boolean(susMap[c.phone]);
          return (
            <Card
              key={c.phone}
              className={`transition-all hover:border-primary/40 hover:shadow-xs ${isSuspended ? "border-destructive/40 bg-destructive/5" : ""}`}
            >
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
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
                        href={`https://wa.me/91${c.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition"
                      >
                        <MessageCircle className="size-3" /> WhatsApp
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
                    <p className="text-xs text-muted-foreground">{c.orders} total {c.orders === 1 ? "order" : "orders"}</p>
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
                      className={`h-8 rounded-xl text-xs ${isSuspended ? "text-green-600 border-green-200 hover:bg-green-50" : "text-destructive hover:bg-destructive/10"}`}
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
                        <Badge variant="destructive" className="text-xs">Suspended</Badge>
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
                      href={`https://wa.me/91${selectedCustomer.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
                    >
                      <MessageCircle className="size-3.5" /> WhatsApp
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
                      <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 p-2 text-xs">
                        <p className="text-foreground">{addr}</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(addr, "Address")}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Copy address"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No delivery addresses recorded (or pickup orders).</p>
                )}
              </div>

              {/* Past Orders List */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <ShoppingBag className="size-4 text-primary" /> Past Order History ({customerOrders.length})
                  </h4>
                  {customerOrdersQuery.isLoading && (
                    <span className="text-xs text-muted-foreground animate-pulse">Loading orders...</span>
                  )}
                </div>

                <div className="space-y-3">
                  {customerOrders.map((order) => {
                    const statusColors: Record<string, string> = {
                      delivered: "bg-green-100 text-green-700 border-green-200",
                      cancelled: "bg-red-100 text-red-700 border-red-200",
                      out_for_delivery: "bg-blue-100 text-blue-700 border-blue-200",
                      packed: "bg-amber-100 text-amber-700 border-amber-200",
                      confirmed: "bg-indigo-100 text-indigo-700 border-indigo-200",
                      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
                    };

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-border/80 bg-muted/20 p-3.5 transition hover:border-primary/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                          <div>
                            <span className="font-mono text-xs font-semibold text-primary">
                              #{order.order_number || order.id.slice(0, 8)}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {formatIST(order.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                statusColors[order.status] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>
                            <span className="font-bold text-sm text-foreground">
                              {formatINR(order.total)}
                            </span>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="mt-2.5 space-y-1">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">
                                {item.name}{" "}
                                <span className="text-muted-foreground">
                                  × {item.qty} {item.unit || ""}
                                </span>
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {formatINR(item.price * item.qty)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Meta */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="capitalize font-medium text-foreground">
                              {order.fulfillment_type || "Delivery"}
                            </span>
                            <span>•</span>
                            <span className="uppercase">{order.payment_method} ({order.payment_status || "completed"})</span>
                          </div>

                          <Link
                            to="/track/$id"
                            params={{ id: order.id }}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            Track Order <ExternalLink className="size-3" />
                          </Link>
                        </div>

                        {order.customer_address && (
                          <div className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="size-3 shrink-0 mt-0.5 text-primary" />
                            <span>{order.customer_address}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!customerOrdersQuery.isLoading && customerOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">
                      No order details found for this phone number.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
