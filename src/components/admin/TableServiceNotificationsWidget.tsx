import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Coffee,
  DollarSign,
  Droplet,
  MessageSquare,
  Sparkles,
  Utensils,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { soundEngine } from "@/lib/realtime";
import { formatIST } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

export function getRequestTypeInfo(type: string) {
  switch (type) {
    case "waiter_call":
      return {
        label: "Call Waiter",
        icon: Bell,
        color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
        badge: "Steward Request",
        badgeVariant: "destructive" as const,
      };
    case "bill_request":
      return {
        label: "Request Bill",
        icon: DollarSign,
        color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
        badge: "Cashier Settlement",
        badgeVariant: "default" as const,
      };
    case "water":
      return {
        label: "Drinking Water",
        icon: Droplet,
        color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
        badge: "Beverage",
        badgeVariant: "secondary" as const,
      };
    case "cutlery":
      return {
        label: "Cutlery / Plates",
        icon: Utensils,
        color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
        badge: "Tableware",
        badgeVariant: "outline" as const,
      };
    case "cleaning":
      return {
        label: "Clean Table",
        icon: Sparkles,
        color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
        badge: "Housekeeping",
        badgeVariant: "outline" as const,
      };
    case "custom":
    default:
      return {
        label: "Custom Request",
        icon: MessageSquare,
        color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
        badge: "Special Note",
        badgeVariant: "secondary" as const,
      };
  }
}

export function TableServiceNotificationsWidget({
  compact = false,
  onSettleBill,
}: {
  compact?: boolean;
  onSettleBill?: (tableNo: string) => void;
}) {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "waiter" | "bill" | "floor">("all");

  // Query active service requests
  const { data: requests = [], refetch } = useQuery<TableServiceRequest[]>({
    queryKey: ["admin_table_service_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_service_requests")
        .select("*")
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

  // Realtime subscription for incoming service calls
  useEffect(() => {
    const channel = supabase
      .channel("admin_service_requests_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_service_requests",
        },
        (payload) => {
          refetch();
          if (payload.eventType === "INSERT") {
            const newReq = payload.new as TableServiceRequest;
            soundEngine.playStatusChime();
            const info = getRequestTypeInfo(newReq.request_type);
            toast.warning(`🔔 Table #${newReq.table_number}: ${info.label}!`, {
              description: newReq.details || "Floor assistance requested by diner.",
              duration: 8000,
              action: {
                label: "View",
                onClick: () => setIsOpen(true),
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Mutation to update request status
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "acknowledged" | "resolved" | "cancelled";
    }) => {
      const { error } = await supabase
        .from("table_service_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return { id, status };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin_table_service_requests"] });
      if (vars.status === "acknowledged") {
        toast.info("Request acknowledged. Diner informed that staff is on the way.");
      } else if (vars.status === "resolved") {
        toast.success("Request resolved!");
      } else {
        toast.info("Request dismissed.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update request");
    },
  });

  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status === "pending").length;
  }, [requests]);

  const billRequestsCount = useMemo(() => {
    return requests.filter((r) => r.request_type === "bill_request" && r.status === "pending").length;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (activeTab === "waiter") {
      return requests.filter((r) => r.request_type === "waiter_call");
    }
    if (activeTab === "bill") {
      return requests.filter((r) => r.request_type === "bill_request");
    }
    if (activeTab === "floor") {
      return requests.filter((r) => ["water", "cutlery", "cleaning", "custom"].includes(r.request_type));
    }
    return requests;
  }, [requests, activeTab]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative rounded-xl h-9 text-xs font-semibold gap-1.5 transition-all ${
            pendingCount > 0
              ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 animate-pulse"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
          title="Floor Service Requests"
        >
          {pendingCount > 0 ? (
            <BellRing className="size-4 animate-bounce text-amber-500" />
          ) : (
            <Bell className="size-4" />
          )}
          {!compact && <span>Table Calls</span>}
          {pendingCount > 0 && (
            <Badge
              variant="destructive"
              className="px-1.5 py-0 h-4 text-[10px] font-black rounded-full shrink-0"
            >
              {pendingCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md p-5 flex flex-col justify-between">
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <SheetHeader className="text-left space-y-1 pb-2 border-b border-border">
            <SheetTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BellRing className="size-5 text-amber-500" />
                <span>Live Table Service Requests</span>
              </span>
              <Badge
                variant={pendingCount > 0 ? "destructive" : "outline"}
                className="text-xs px-2 py-0.5"
              >
                {pendingCount} Pending
              </Badge>
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              Real-time guest calls: Waiter, Bill settlement, Cutlery, Water &amp; Cleaning.
            </p>
          </SheetHeader>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("waiter")}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === "waiter"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Waiter
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bill")}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === "bill"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bills {billRequestsCount > 0 && `(${billRequestsCount})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("floor")}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === "floor"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Floor Items
            </button>
          </div>

          {/* Request List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
            {filteredRequests.length === 0 ? (
              <div className="py-16 text-center space-y-2 border border-dashed border-border rounded-2xl bg-muted/10">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto opacity-70" />
                <p className="text-xs font-semibold text-foreground">All Clear!</p>
                <p className="text-[11px] text-muted-foreground">
                  No active service requests pending from tables.
                </p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const info = getRequestTypeInfo(req.request_type);
                const IconComponent = info.icon;
                const isPending = req.status === "pending";

                return (
                  <Card
                    key={req.id}
                    className={`rounded-2xl border transition-all ${
                      isPending
                        ? "border-amber-500/50 bg-amber-500/5 shadow-xs"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`size-8 rounded-xl flex items-center justify-center shrink-0 border ${info.color}`}
                          >
                            <IconComponent className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-sm text-foreground">
                                Table #{req.table_number}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  isPending
                                    ? "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-bold"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {isPending ? "⏳ Pending" : "🏃 Staff En Route"}
                              </Badge>
                            </div>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {info.label}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="size-3" />
                          {formatIST(req.created_at)}
                        </span>
                      </div>

                      {req.details && (
                        <div className="p-2 rounded-xl bg-muted/40 border border-border/60 text-xs text-foreground italic">
                          "{req.details}"
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 gap-2">
                        {req.request_type === "bill_request" && onSettleBill ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              onSettleBill(req.table_number);
                              setIsOpen(false);
                            }}
                            className="h-7 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3"
                          >
                            <DollarSign className="size-3" />
                            <span>Settle in POS</span>
                          </Button>
                        ) : null}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updateStatusMutation.isPending}
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: req.id,
                                  status: "acknowledged",
                                })
                              }
                              className="h-7 text-[11px] font-semibold rounded-lg border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                            >
                              Acknowledge
                            </Button>
                          )}

                          <Button
                            size="sm"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: req.id,
                                status: "resolved",
                              })
                            }
                            className="h-7 text-[11px] font-bold rounded-lg bg-primary text-primary-foreground gap-1 px-2.5"
                          >
                            <CheckCircle2 className="size-3" />
                            <span>Done</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={updateStatusMutation.isPending}
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: req.id,
                                status: "cancelled",
                              })
                            }
                            className="size-7 text-muted-foreground hover:text-destructive"
                            title="Dismiss"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Fish N Fresh Floor Dispatch</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-[11px] gap-1"
          >
            Refresh
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
