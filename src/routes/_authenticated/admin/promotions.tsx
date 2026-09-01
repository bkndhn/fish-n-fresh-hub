import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPromotionsQuery } from "@/lib/admin";
import { formatINR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions | Fish N Fresh Admin" },
      { name: "description", content: "Create and toggle seafood discount codes and offer campaigns." },
      { property: "og:title", content: "Promotions | Fish N Fresh Admin" },
      { property: "og:description", content: "Create and toggle seafood discount codes and offer campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PromotionsAdmin,
});

function PromotionsAdmin() {
  const qc = useQueryClient();
  const promos = useQuery(adminPromotionsQuery);

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("promotions").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion updated");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Promotions">
      <div className="space-y-3">
        {(promos.data ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-6">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.code ? `${p.code} · ` : ""}
                  {p.discount_type === "percent" ? `${p.value}% off` : `${formatINR(p.value)} off`} · min{" "}
                  {formatINR(p.min_order)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Paused"}</Badge>
                <Switch checked={p.active} onCheckedChange={(active) => toggle.mutate({ id: p.id, active })} />
              </div>
            </CardContent>
          </Card>
        ))}
        {(promos.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No promotions yet.</p>}
      </div>
    </AdminShell>
  );
}
