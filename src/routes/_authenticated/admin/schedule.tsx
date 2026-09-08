import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Edit2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  adminDeliveryWindowsQuery,
  WEEKDAY_LABELS,
  type DeliveryWindow,
} from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/schedule")({
  head: () => ({
    meta: [
      { title: "Delivery Schedule | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Set the daily delivery windows Fish N Fresh customers can pick at checkout.",
      },
      { property: "og:title", content: "Delivery Schedule | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Create morning, midday and evening delivery windows with capacity and cut-off times.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulePage,
});

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function SchedulePage() {
  const qc = useQueryClient();
  const windows = useQuery(adminDeliveryWindowsQuery);
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [cutoff, setCutoff] = useState("60");
  const [days, setDays] = useState<number[]>(ALL_DAYS);

  // Edit window modal state
  const [editingWindow, setEditingWindow] = useState<DeliveryWindow | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "delivery-windows"] });
    qc.invalidateQueries({ queryKey: ["delivery-windows"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Give the window a name");
      const { error } = await supabase.from("delivery_windows").insert({
        label: label.trim(),
        start_time: start,
        end_time: end,
        weekdays: days.length ? days : ALL_DAYS,
        capacity: Number(capacity) || 20,
        cutoff_minutes: Number(cutoff) || 60,
        sort_order: (windows.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      toast.success("Delivery window added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DeliveryWindow> }) => {
      const { error } = await supabase.from("delivery_windows").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Window updated successfully");
      setEditingWindow(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Window removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = windows.data ?? [];

  return (
    <AdminShell title="Delivery schedule" allow={["admin", "staff"]}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a delivery window</CardTitle>
            <CardDescription>Customers pick one of these when they check out.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="w-label">Name</Label>
                <Input
                  id="w-label"
                  placeholder="Morning 7–10 AM"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="w-start">Starts</Label>
                  <Input id="w-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="w-end">Ends</Label>
                  <Input id="w-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="w-cap">Orders per window</Label>
                  <Input
                    id="w-cap"
                    inputMode="numeric"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="w-cut">Cut-off (min before)</Label>
                  <Input
                    id="w-cut"
                    inputMode="numeric"
                    value={cutoff}
                    onChange={(e) => setCutoff(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${
                        days.includes(d)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                <Plus className="mr-1.5 size-4" /> Add window
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your windows</CardTitle>
            <CardDescription>Switch a window off to hide it from checkout, or edit details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {windows.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No windows yet.</p>
            ) : (
              list.map((w) => (
                <div key={w.id} className="rounded-xl border border-border p-3 transition hover:border-primary/40">
                  <div className="flex flex-wrap items-center gap-3">
                    <Clock className="size-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{w.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.start_time}–{w.end_time} · up to {w.capacity} orders · cut-off {w.cutoff_minutes} min
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(w.weekdays ?? []).map((d) => WEEKDAY_LABELS[d]).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={w.active}
                        onCheckedChange={(checked) =>
                          update.mutate({ id: w.id, patch: { active: checked } })
                        }
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 rounded-lg"
                        onClick={() => setEditingWindow({ ...w })}
                        title={`Edit ${w.label}`}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => remove.mutate(w.id)}
                        aria-label={`Remove ${w.label}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Delivery Window Dialog */}
      <Dialog open={Boolean(editingWindow)} onOpenChange={(open) => !open && setEditingWindow(null)}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle>Edit Delivery Window</DialogTitle>
            <DialogDescription>
              Update timings, capacity, cut-off time, and active days.
            </DialogDescription>
          </DialogHeader>

          {editingWindow && (
            <form
              className="space-y-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingWindow.label.trim()) {
                  toast.error("Window name cannot be empty");
                  return;
                }
                update.mutate({
                  id: editingWindow.id,
                  patch: {
                    label: editingWindow.label.trim(),
                    start_time: editingWindow.start_time,
                    end_time: editingWindow.end_time,
                    capacity: Number(editingWindow.capacity) || 20,
                    cutoff_minutes: Number(editingWindow.cutoff_minutes) || 60,
                    weekdays: editingWindow.weekdays?.length ? editingWindow.weekdays : ALL_DAYS,
                    active: editingWindow.active,
                  },
                });
              }}
            >
              <div className="space-y-1.5">
                <Label>Window Name</Label>
                <Input
                  value={editingWindow.label}
                  onChange={(e) => setEditingWindow({ ...editingWindow, label: e.target.value })}
                  placeholder="e.g. Morning 7–10 AM"
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={editingWindow.start_time}
                    onChange={(e) => setEditingWindow({ ...editingWindow, start_time: e.target.value })}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={editingWindow.end_time}
                    onChange={(e) => setEditingWindow({ ...editingWindow, end_time: e.target.value })}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Max Orders</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingWindow.capacity}
                    onChange={(e) => setEditingWindow({ ...editingWindow, capacity: Number(e.target.value) })}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cut-off (Mins Before)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingWindow.cutoff_minutes}
                    onChange={(e) => setEditingWindow({ ...editingWindow, cutoff_minutes: Number(e.target.value) })}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Days Active</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((d) => {
                    const activeDays = editingWindow.weekdays ?? ALL_DAYS;
                    const isSelected = activeDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const updated = isSelected
                            ? activeDays.filter((x) => x !== d)
                            : [...activeDays, d].sort();
                          setEditingWindow({ ...editingWindow, weekdays: updated });
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-medium"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {WEEKDAY_LABELS[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 p-3 mt-2">
                <div>
                  <p className="text-xs font-semibold">Active at checkout</p>
                  <p className="text-[11px] text-muted-foreground">Turn off to temporarily disable this slot</p>
                </div>
                <Switch
                  checked={editingWindow.active}
                  onCheckedChange={(active) => setEditingWindow({ ...editingWindow, active })}
                />
              </div>

              <DialogFooter className="mt-4 flex gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingWindow(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl" disabled={update.isPending}>
                  {update.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
