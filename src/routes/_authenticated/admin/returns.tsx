import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, RotateCcw, TrendingUp, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  component: ReturnsLogisticsAdmin,
});

function ReturnsLogisticsAdmin() {
  // Query the view we created in the migration
  const { data: courierStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "courier_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courier_performance_stats").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: returnsData, isLoading: returnsLoading } = useQuery({
    queryKey: ["admin", "returns_data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, return_status, return_reason, refund_amount, returned_at")
        .not("return_status", "is", null)
        .order("returned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <AdminShell title="Post-Purchase Logistics">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Post-Purchase Logistics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor courier performance, track returns, and view refund analytics.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-xs border-indigo-100">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-medium">Total Courier Deliveries</h3>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{courierStats?.reduce((acc: any, c: any) => acc + c.total_shipments, 0) || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs border-rose-100">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <RotateCcw className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-medium">Total Return Requests</h3>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{returnsData?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xs border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Courier Partner Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Loading stats...</div>
            ) : courierStats && courierStats.length > 0 ? (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Courier Partner</th>
                      <th className="px-4 py-3 text-left font-semibold">Total Shipments</th>
                      <th className="px-4 py-3 text-left font-semibold">Delivered</th>
                      <th className="px-4 py-3 text-left font-semibold">RTOs (Returns)</th>
                      <th className="px-4 py-3 text-left font-semibold">RTO Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {courierStats.map((stat: any) => (
                      <tr key={stat.courier_partner} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-semibold text-foreground">{stat.courier_partner}</td>
                        <td className="px-4 py-3">{stat.total_shipments}</td>
                        <td className="px-4 py-3 text-emerald-600 font-medium">{stat.delivered_shipments}</td>
                        <td className="px-4 py-3 text-rose-600">{stat.rto_shipments}</td>
                        <td className="px-4 py-3 font-mono">{stat.rto_rate_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No courier data available. Mark orders as shipped via third-party couriers to see performance here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
