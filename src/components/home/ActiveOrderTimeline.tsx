import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, ChefHat, Bike, PackageCheck, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";
import { inr } from "@/lib/format";

export const TIMELINE_STAGES = [
  { key: "cashier", label: "Confirmed", icon: Receipt },
  { key: "kitchen", label: "Kitchen", icon: ChefHat },
  { key: "driver", label: "On the way", icon: Bike },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
] as const;

/** Map an order status to timeline stage index (0-3). */
export function timelineStage(status: string): number {
  switch (status) {
    case "pending":
    case "confirmed": return 0;
    case "processing":
    case "preparing":
    case "packed":
    case "ready": return 1;
    case "assigned":
    case "picked_up":
    case "out_for_delivery":
    case "nearby": return 2;
    case "delivered": return 3;
    default: return 0;
  }
}

const STAGE_HINT = [
  "Billed at the counter — sending to kitchen",
  "Being cleaned, cut & packed fresh",
  "Your rider is heading over",
  "Delivered. Enjoy your meal!",
];

export function OrderTimeline({ status }: { status: string }) {
  const stage = timelineStage(status);
  return (
    <div className="relative mt-3">
      <div className="absolute left-4 right-4 top-4 h-1 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(stage / 3) * 100}%` }} />
      </div>
      <ol className="relative flex justify-between">
        {TIMELINE_STAGES.map((s, i) => {
          const Icon = s.icon;
          const done = i < stage, current = i === stage;
          return (
            <li key={s.key} className="flex w-16 flex-col items-center gap-1">
              <span className={`relative flex size-9 items-center justify-center rounded-full border-2 transition-all ${
                done || current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                {current && i < 3 && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
                <Icon className="relative size-4" />
              </span>
              <span className={`text-[10px] font-semibold ${current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ActiveOrderTimeline() {
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["active-order-timeline", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total, eta_minutes, created_at")
        .eq("user_id", user!.id)
        .not("status", "in", "(cancelled)")
        .order("created_at", { ascending: false })
        .limit(5);
      const dayAgo = Date.now() - 86400000;
      return (data ?? []).filter((o) => o.status !== "delivered" || new Date(o.created_at).getTime() > Date.now() - 3600000)
        .filter((o) => new Date(o.created_at).getTime() > dayAgo).slice(0, 2);
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`home-order-timeline-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["active-order-timeline"] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  if (!orders?.length) return null;
  return (
    <section className="mb-4 space-y-2.5" aria-label="Live order status">
      {orders.map((o) => {
        const stage = timelineStage(o.status);
        return (
          <Link key={o.id} to="/track/$id" params={{ id: o.id }}
            className="block rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {stage < 3 && <span className="size-1.5 animate-pulse rounded-full bg-primary" />} Live order
                </p>
                <p className="truncate text-sm font-bold">#{o.order_number ?? o.id.slice(0, 8)} · {inr(Number(o.total))}</p>
                <p className="text-xs text-muted-foreground">{STAGE_HINT[stage]}</p>
              </div>
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {o.eta_minutes && stage < 3 ? `~${o.eta_minutes} min` : "Track"} <ChevronRight className="size-3" />
              </span>
            </div>
            <OrderTimeline status={o.status} />
          </Link>
        );
      })}
    </section>
  );
}
