import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { FileText, Calculator } from "lucide-react";
import type { CartItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/gst-reports")({
  component: GstReportsAdmin,
});

function GstReportsAdmin() {
  const [range, setRange] = useState<"today" | "this_month" | "last_month" | "this_quarter">("this_month");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin", "gst_reports", range],
    queryFn: async () => {
      let start = new Date();
      start.setHours(0, 0, 0, 0);
      let end = new Date();
      end.setHours(23, 59, 59, 999);

      if (range === "this_month") {
        start.setDate(1);
      } else if (range === "last_month") {
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        end.setDate(0);
      } else if (range === "this_quarter") {
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3);
        start.setDate(1);
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, items, status, customer_name")
        .neq("status", "cancelled")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate GST summaries
  const { gstSummary, hsnSummary, totalTaxCollected, totalTaxableValue } = useMemo(() => {
    // Map of GST% -> totals
    const gstMap: Record<number, { taxable: number; taxAmount: number }> = {};
    // Map of HSN -> totals
    const hsnMap: Record<string, { qty: number; taxable: number; taxAmount: number }> = {};
    let totalTaxCollected = 0;
    let totalTaxableValue = 0;

    (orders || []).forEach((order) => {
      const items = (order.items as CartItem[]) || [];
      items.forEach((item) => {
        const g = item.gst_percentage || 0;
        const hsn = item.hsn_code || "UNKNOWN";
        const lineTotal = Number(item.price) * Number(item.qty);

        // Calculate reverse inclusive tax
        const taxable = lineTotal / (1 + g / 100);
        const taxAmount = lineTotal - taxable;

        totalTaxableValue += taxable;
        totalTaxCollected += taxAmount;

        // GST % Map
        if (!gstMap[g]) gstMap[g] = { taxable: 0, taxAmount: 0 };
        gstMap[g].taxable += taxable;
        gstMap[g].taxAmount += taxAmount;

        // HSN Map
        if (!hsnMap[hsn]) hsnMap[hsn] = { qty: 0, taxable: 0, taxAmount: 0 };
        hsnMap[hsn].qty += Number(item.qty);
        hsnMap[hsn].taxable += taxable;
        hsnMap[hsn].taxAmount += taxAmount;
      });
    });

    return {
      gstSummary: Object.entries(gstMap)
        .map(([rate, data]) => ({ rate: Number(rate), ...data }))
        .sort((a, b) => a.rate - b.rate),
      hsnSummary: Object.entries(hsnMap)
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.taxable - a.taxable),
      totalTaxCollected,
      totalTaxableValue,
    };
  }, [orders]);

  return (
    <AdminShell title="GST & Tax Reports">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">GST & Tax Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              GSTR-1, GSTR-3B, and HSN-wise summaries for tax filing. Note: All calculations assume prices are inclusive of GST.
            </p>
          </div>
          <Select value={range} onValueChange={(v: any) => setRange(v)}>
            <SelectTrigger className="w-48 rounded-xl bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Top level KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-xs border-indigo-100">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calculator className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-medium">Total Taxable Value</h3>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{formatINR(totalTaxableValue)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs border-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-medium">Total GST Collected</h3>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{formatINR(totalTaxCollected)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GST Rate Wise Summary (GSTR-3B) */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Rate Wise Summary (GSTR-3B)</CardTitle>
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">Export CSV</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
            ) : gstSummary.length > 0 ? (
              <div className="rounded-xl border border-border/50 overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">GST Rate</th>
                      <th className="px-4 py-3 text-right font-semibold">Taxable Value</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Tax Amount</th>
                      <th className="px-4 py-3 text-right font-semibold text-emerald-600">CGST (50%)</th>
                      <th className="px-4 py-3 text-right font-semibold text-sky-600">SGST (50%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {gstSummary.map((row) => (
                      <tr key={row.rate} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-semibold text-foreground">{row.rate}%</td>
                        <td className="px-4 py-3 text-right font-mono">{formatINR(row.taxable)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(row.taxAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatINR(row.taxAmount / 2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sky-600">{formatINR(row.taxAmount / 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No tax data available for the selected period.
              </div>
            )}
          </CardContent>
        </Card>

        {/* HSN Code Wise Summary (GSTR-1) */}
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">HSN Summary (GSTR-1)</CardTitle>
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs">Export CSV</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Loading...</div>
            ) : hsnSummary.length > 0 ? (
              <div className="rounded-xl border border-border/50 overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">HSN Code</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Quantity</th>
                      <th className="px-4 py-3 text-right font-semibold">Taxable Value</th>
                      <th className="px-4 py-3 text-right font-semibold">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {hsnSummary.map((row) => (
                      <tr key={row.code} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-semibold text-foreground">{row.code || "N/A"}</td>
                        <td className="px-4 py-3 text-right">{row.qty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatINR(row.taxable)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatINR(row.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No HSN data available for the selected period.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AdminShell>
  );
}
