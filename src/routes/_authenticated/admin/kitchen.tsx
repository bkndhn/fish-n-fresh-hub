import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BUMP_LABEL,
  BUMP_NEXT,
  formatAge,
  stationOf,
  ticketAgeMinutes,
  ticketTier,
  type KitchenStation,
} from "@/lib/kitchenTimers";

export const Route = createFileRoute("/_authenticated/admin/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen Bump Bar | Fish N Fresh Admin" },
      { name: "description", content: "Live kitchen tickets with prep timers and one-tap bump." },
      { property: "og:title", content: "Kitchen Bump Bar | Fish N Fresh Admin" },
      { property: "og:description", content: "Live kitchen tickets with prep timers and one-tap bump." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitchenPage,
});

type Ticket = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string;
  fulfillment_type: string | null;
  table_number: string | null;
  customer_name: string | null;
  notes: string | null;
  items: { name: string; qty: number; unit?: string }[] | null;
};

const STATIONS: { key: KitchenStation; label: string }[] = [
  { key: "all", label: "All active" },
  { key: "dine_in", label: "Dine-in" },
  { key: "counter", label: "Counter" },
  { key: "delivery", label: "Delivery" },
];

const TIER_STYLE = {
  fresh: "border-primary/40",
  active: "border-accent",
  urgent: "border-destructive animate-pulse",
} as const;

function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    /* audio blocked */
  }
}

function KitchenPage() {
  const qc = useQueryClient();
  const [station, setStation] = useState<KitchenStation>("all");
  const [now, setNow] = useState(() => Date.now());
  const [lastBump, setLastBump] = useState<{ id: string; from: string } | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const urgentSeen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const tickets = useQuery({
    queryKey: ["kitchen", "tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, fulfillment_type, table_number, customer_name, notes, items")
        .in("status", ["pending", "confirmed", "packed"])
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("kitchen-bump")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["kitchen", "tickets"] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [qc]);

  // Chime on new tickets and when a ticket turns urgent.
  useEffect(() => {
    const list = tickets.data ?? [];
    let ring = false;
    for (const t of list) {
      if (!seen.current.has(t.id)) {
        if (seen.current.size > 0) ring = true;
        seen.current.add(t.id);
      }
      if (ticketTier(ticketAgeMinutes(t.created_at, now)) === "urgent" && !urgentSeen.current.has(t.id)) {
        urgentSeen.current.add(t.id);
        ring = true;
      }
    }
    if (seen.current.size === 0 && list.length === 0) seen.current.add("__init");
    if (ring) chime();
  }, [tickets.data, now]);

  const bump = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const { error } = await supabase.from("orders").update({ status: to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen", "tickets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (tickets.data ?? []).filter((t) => station === "all" || stationOf(t) === station),
    [tickets.data, station],
  );

  return (
    <AdminShell
      title="Kitchen Bump Bar"
      allow={["admin", "manager", "staff", "cashier"]}
      fullWidth
      action={
        lastBump ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              bump.mutate({ id: lastBump.id, to: lastBump.from });
              setLastBump(null);
              toast.success("Bump undone");
            }}
          >
            <Undo2 className="mr-1 h-4 w-4" /> Undo bump
          </Button>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {STATIONS.map((s) => (
          <Button key={s.key} size="sm" variant={station === s.key ? "default" : "outline"} onClick={() => setStation(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No active tickets. Kitchen is clear.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => {
            const age = ticketAgeMinutes(t.created_at, now);
            const tier = ticketTier(age);
            const st = stationOf(t);
            return (
              <div key={t.id} className={`flex flex-col rounded-xl border-4 bg-card p-4 ${TIER_STYLE[tier]}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold">#{t.order_number ?? t.id.slice(0, 6)}</span>
                  <Badge variant={tier === "urgent" ? "destructive" : tier === "active" ? "secondary" : "default"}>
                    {formatAge(t.created_at, now)}
                  </Badge>
                </div>
                <div className="mb-2 flex flex-wrap gap-1 text-xs">
                  <Badge variant="outline">{st === "dine_in" ? `Table ${t.table_number ?? ""}` : st === "delivery" ? "Delivery" : "Counter"}</Badge>
                  <Badge variant="outline">
                    {t.status === "pending" ? "New" : t.status === "confirmed" ? "Preparing" : "Ready"}
                  </Badge>
                  {t.customer_name && <span className="text-muted-foreground">{t.customer_name}</span>}
                </div>
                <ul className="mb-3 flex-1 space-y-1 text-sm">
                  {(t.items ?? []).map((it, i) => (
                    <li key={i}>
                      <span className="font-semibold">{it.qty}{it.unit ? ` ${it.unit}` : "×"}</span> {it.name}
                    </li>
                  ))}
                </ul>
                {t.notes && <p className="mb-3 rounded bg-muted p-2 text-xs">{t.notes}</p>}
                <Button
                  size="lg"
                  className="w-full"
                  disabled={bump.isPending}
                  onClick={() => {
                    const to = BUMP_NEXT[t.status];
                    if (!to) return;
                    setLastBump({ id: t.id, from: t.status });
                    bump.mutate({ id: t.id, to });
                  }}
                >
                  {BUMP_LABEL[t.status] ?? "Bump"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
