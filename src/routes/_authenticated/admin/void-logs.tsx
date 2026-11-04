import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatIST } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/void-logs")({
  component: VoidLogsPage,
});

type VoidLog = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  amount: number | null;
  payment_method: string | null;
  action: string | null;
  reason: string | null;
  done_by: string | null;
  done_by_name: string | null;
  created_at: string;
};

function VoidLogsPage() {
  const { data: logs = [], isLoading } = useQuery<VoidLog[]>({
    queryKey: ["bill_void_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_void_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as VoidLog[];
    },
    staleTime: 30_000,
  });

  return (
    <AdminShell title="Void & Refund Audit Log" allow={["admin", "manager"]}>
      <div className="space-y-4">
        {isLoading && (
          <p className="text-muted-foreground text-sm">Loading void logs…</p>
        )}

        {!isLoading && logs.length === 0 && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No void or refund actions recorded yet.</p>
              <p className="text-xs mt-1">
                Voids and cancellations confirmed with the Owner PIN will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {logs.map((log) => (
          <Card key={log.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {log.order_number || log.order_id || "Unknown order"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatIST(log.created_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    By:{" "}
                    <span className="font-medium text-foreground">
                      {log.done_by_name || "Unknown"}
                    </span>
                  </div>
                  {log.reason && (
                    <div className="text-xs mt-1 text-foreground">
                      Reason: {log.reason}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge
                    variant={log.action === "refund" ? "destructive" : "secondary"}
                  >
                    {log.action === "refund" ? "Refund" : "Cancel"}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {formatINR(log.amount || 0)}
                  </span>
                  {log.payment_method && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {log.payment_method.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
