import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SiteSettings } from "@/lib/types";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Store,
  CalendarDays,
  Truck,
  Sparkles,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  adminDeliveryWindowsQuery,
  WEEKDAY_LABELS,
  type DeliveryWindow,
} from "@/lib/delivery";
import { settingsQuery } from "@/lib/queries";
import {
  ALL_WEEKDAYS,
  WEEKDAY_NAMES,
  getStoreStatus,
  formatTime12h,
  type CustomHoliday,
} from "@/lib/storeSchedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      { title: "Schedule & Operating Hours | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Configure shop working hours, weekly off days, custom holidays, and delivery windows.",
      },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const qc = useQueryClient();
  const windows = useQuery(adminDeliveryWindowsQuery);
  const { data: settings } = useQuery(settingsQuery);

  // Delivery slot form state
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("10:00");
  const [capacity, setCapacity] = useState("20");
  const [cutoff, setCutoff] = useState("60");
  const [days, setDays] = useState<number[]>(ALL_WEEKDAYS);

  // Edit window modal state
  const [editingWindow, setEditingWindow] = useState<DeliveryWindow | null>(null);

  // Shop hours & holiday state
  const [openTime, setOpenTime] = useState("07:00");
  const [closeTime, setCloseTime] = useState("21:00");
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [lunchStart, setLunchStart] = useState("13:00");
  const [lunchEnd, setLunchEnd] = useState("14:30");
  const [blockDuringLunch, setBlockDuringLunch] = useState(true);
  const [workingDays, setWorkingDays] = useState<number[]>(ALL_WEEKDAYS);
  const [allowPreorders, setAllowPreorders] = useState(true);
  const [closedMessage, setClosedMessage] = useState("");
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);

  // New holiday form
  const [newHolDate, setNewHolDate] = useState("");
  const [newHolReason, setNewHolReason] = useState("");

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      if ((settings as SiteSettings).open_time) setOpenTime((settings as SiteSettings).open_time);
      if ((settings as SiteSettings).close_time) setCloseTime((settings as SiteSettings).close_time);
      if ((settings as SiteSettings).lunch_start) {
        setLunchStart((settings as SiteSettings).lunch_start);
        setLunchEnabled(true);
      }
      if ((settings as SiteSettings).lunch_end) setLunchEnd((settings as SiteSettings).lunch_end);
      if ((settings as SiteSettings).block_during_lunch !== undefined) {
        setBlockDuringLunch(Boolean((settings as SiteSettings).block_during_lunch));
      }
      if ((settings as SiteSettings).working_days) {
        const wd = (settings as SiteSettings).working_days;
        setWorkingDays(Array.isArray(wd) ? wd : typeof wd === "string" ? JSON.parse(wd) : ALL_WEEKDAYS);
      }
      if ((settings as SiteSettings).allow_preorders_when_closed !== undefined) {
        setAllowPreorders(Boolean((settings as SiteSettings).allow_preorders_when_closed));
      }
      if ((settings as SiteSettings).closed_message) setClosedMessage((settings as SiteSettings).closed_message);
      if ((settings as SiteSettings).custom_holidays) {
        const ch = (settings as SiteSettings).custom_holidays;
        setCustomHolidays(Array.isArray(ch) ? ch : typeof ch === "string" ? JSON.parse(ch) : []);
      }
    }
  }, [settings]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "delivery-windows"] });
    qc.invalidateQueries({ queryKey: ["delivery-windows"] });
    qc.invalidateQueries({ queryKey: ["store_settings"] });
  };

  // Delivery window mutations
  const create = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Give the window a name");
      const { error } = await supabase.from("delivery_windows").insert({
        label: label.trim(),
        start_time: start,
        end_time: end,
        weekdays: days.length ? days : ALL_WEEKDAYS,
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
      const { error } = await supabase.from("delivery_windows").update(patch as Record<string, unknown>).eq("id", id);
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

  // Toggle instant store open/pause status
  const toggleStoreOpen = useMutation({
    mutationFn: async (newIsOpen: boolean) => {
      if (!settings?.id) return;
      const { error } = await supabase.from("store_settings").update({
        is_open: newIsOpen,
      } as Record<string, unknown>).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: (_, newIsOpen) => {
      toast.success(newIsOpen ? "Store is now OPEN and accepting orders!" : "Store is now PAUSED.");
      invalidate();
    },
    onError: (e: any) => toast.error(`Failed to update store status: ${e.message}`),
  });

  // Save Shop Hours & Holiday settings
  const saveScheduleSettings = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase.from("store_settings").update({
        open_time: openTime,
        close_time: closeTime,
        lunch_start: lunchEnabled && lunchStart.trim() ? lunchStart.trim() : null,
        lunch_end: lunchEnabled && lunchEnd.trim() ? lunchEnd.trim() : null,
        block_during_lunch: blockDuringLunch,
        working_days: workingDays,
        custom_holidays: customHolidays,
        allow_preorders_when_closed: allowPreorders,
        closed_message: closedMessage.trim() || null,
      } as Record<string, unknown>).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shop working hours & holiday settings saved!");
      invalidate();
    },
    onError: (e: any) => {
      toast.error(`Failed to save: ${e.message}`);
    },
  });

  const addCustomHoliday = () => {
    if (!newHolDate) {
      toast.error("Please pick a holiday date");
      return;
    }
    if (customHolidays.some((h) => h.date === newHolDate)) {
      toast.error("A holiday is already scheduled for this date");
      return;
    }
    const newEntry: CustomHoliday = {
      id: String(Date.now()),
      date: newHolDate,
      reason: newHolReason.trim() || "Store Holiday",
    };
    setCustomHolidays([...customHolidays, newEntry].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHolDate("");
    setNewHolReason("");
    toast.info(`Added holiday for ${newHolDate}. Remember to click 'Save Shop Settings'!`);
  };

  const removeCustomHoliday = (id: string) => {
    setCustomHolidays(customHolidays.filter((h) => h.id !== id));
    toast.info("Holiday removed. Remember to click 'Save Shop Settings'!");
  };

  const list = windows.data ?? [];

  // Live status calculation for display
  const liveStatus = getStoreStatus({
    is_open: settings?.is_open,
    open_time: openTime,
    close_time: closeTime,
    lunch_start: lunchEnabled ? lunchStart : null,
    lunch_end: lunchEnabled ? lunchEnd : null,
    block_during_lunch: blockDuringLunch,
    working_days: workingDays,
    custom_holidays: customHolidays,
    allow_preorders_when_closed: allowPreorders,
    closed_message: closedMessage,
  });

  return (
    <AdminShell title="Store Schedule & Operating Hours" allow={["admin", "manager", "staff"]}>
      {/* Live Store Status Banner */}
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-xs ${
          liveStatus.isOpen
            ? "border-green-300 bg-green-50/70 dark:border-green-900 dark:bg-green-950/30"
            : liveStatus.canAcceptOrder
              ? "border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
              : "border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex size-8 items-center justify-center rounded-xl text-white ${
              liveStatus.isOpen ? "bg-green-600" : liveStatus.canAcceptOrder ? "bg-amber-600" : "bg-destructive"
            }`}
          >
            {liveStatus.isOpen ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{liveStatus.statusTitle}</h3>
              <Badge
                variant={liveStatus.isOpen ? "default" : liveStatus.canAcceptOrder ? "outline" : "destructive"}
                className="text-[10px]"
              >
                {liveStatus.isOpen
                  ? "LIVE: OPEN"
                  : liveStatus.canAcceptOrder
                    ? "PRE-ORDERS ONLY"
                    : "ORDERS BLOCKED"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{liveStatus.statusDescription}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right text-xs text-muted-foreground hidden sm:block">
            <p>
              Operating Hours: <strong className="text-foreground">{formatTime12h(openTime)} – {formatTime12h(closeTime)}</strong>
            </p>
            <p className="mt-0.5">
              Next Open Delivery Day: <strong className="text-primary">{liveStatus.nextWorkingDate}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/80 px-3 py-2 shadow-2xs backdrop-blur-xs">
            <div className="text-right text-xs">
              <span className="font-bold block text-foreground leading-tight">
                {settings?.is_open !== false ? "Store Orders Open" : "Store Orders Paused"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {settings?.is_open !== false ? "Toggle to pause checkout" : "Toggle to resume orders"}
              </span>
            </div>
            <Switch
              checked={settings?.is_open !== false}
              disabled={toggleStoreOpen.isPending}
              onCheckedChange={(checked) => toggleStoreOpen.mutate(checked)}
              aria-label="Toggle store open status"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="hours" className="space-y-4 w-full min-w-0 max-w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md rounded-xl">
          <TabsTrigger value="hours" className="rounded-lg text-xs flex items-center justify-center gap-1.5 px-2">
            <Store className="size-3.5 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Hours & Offs</span>
              <span className="hidden sm:inline">Working Hours & Holidays</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="slots" className="rounded-lg text-xs flex items-center justify-center gap-1.5 px-2">
            <Truck className="size-3.5 shrink-0" />
            <span className="truncate">Delivery Slots ({list.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Shop Operating Hours, Weekly Offs & Holidays */}
        <TabsContent value="hours" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Operating Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4 text-primary" /> Daily Operating Hours
                </CardTitle>
                <CardDescription>Set the daily store opening and closing times.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Opens At</Label>
                    <Input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="rounded-xl"
                    />
                    <p className="text-[11px] text-muted-foreground">{formatTime12h(openTime)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Closes At</Label>
                    <Input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="rounded-xl"
                    />
                    <p className="text-[11px] text-muted-foreground">{formatTime12h(closeTime)}</p>
                  </div>
                </div>

                {/* Daily Lunch Break & Counter Restocking */}
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" /> Daily Lunch Break / Restocking
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Pause orders during afternoon counter restock or staff lunch break
                      </p>
                    </div>
                    <Switch
                      checked={lunchEnabled}
                      onCheckedChange={setLunchEnabled}
                      aria-label="Enable daily lunch break"
                    />
                  </div>

                  {lunchEnabled && (
                    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Lunch Starts</Label>
                          <Input
                            type="time"
                            value={lunchStart}
                            onChange={(e) => setLunchStart(e.target.value)}
                            className="rounded-xl"
                          />
                          <p className="text-[11px] text-muted-foreground">{formatTime12h(lunchStart)}</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Lunch Ends</Label>
                          <Input
                            type="time"
                            value={lunchEnd}
                            onChange={(e) => setLunchEnd(e.target.value)}
                            className="rounded-xl"
                          />
                          <p className="text-[11px] text-muted-foreground">{formatTime12h(lunchEnd)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <Label className="text-xs font-medium">Block Checkout During Lunch</Label>
                          <p className="text-[10px] text-muted-foreground">
                            {blockDuringLunch ? "Strictly pauses checkout until lunch ends" : "Allows pre-orders for evening delivery"}
                          </p>
                        </div>
                        <Switch
                          checked={blockDuringLunch}
                          onCheckedChange={setBlockDuringLunch}
                          aria-label="Block checkout during lunch"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Weekly Operating Days */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold">Weekly Working Days & Weekly Off</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Click a day to toggle between <strong>Open</strong> and <strong>Weekly Off</strong>.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ALL_WEEKDAYS.map((d) => {
                      const isWorking = workingDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setWorkingDays(
                              isWorking ? workingDays.filter((x) => x !== d) : [...workingDays, d].sort()
                            );
                          }}
                          className={`flex flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-xs transition ${
                            isWorking
                              ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "border-destructive/40 bg-destructive/10 text-destructive font-medium"
                          }`}
                        >
                          <span>{WEEKDAY_NAMES[d]?.slice(0, 3) ?? ""}</span>
                          <span className="text-[9px] uppercase tracking-tight">
                            {isWorking ? "Open" : "Off"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Order Acceptance Policy */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold">Order Acceptance Policy (Non-Working Hours & Holidays)</Label>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowPreorders(true)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        allowPreorders
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary">
                        {allowPreorders && <div className="size-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Accept Pre-Orders for Next Working Day (Recommended)
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Customers can place orders anytime. If placed after closing or on holiday, delivery is automatically scheduled for the next open working slot.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAllowPreorders(false)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        !allowPreorders
                          ? "border-destructive bg-destructive/5 ring-1 ring-destructive"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-destructive">
                        {!allowPreorders && <div className="size-2 rounded-full bg-destructive" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-destructive">
                          Strictly Block Orders when Closed / on Holiday
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Checkout is disabled during non-working hours and holidays. Customers cannot place orders until the store reopens.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Holidays & Blackout Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" /> Custom Holidays & Blackout Dates
                </CardTitle>
                <CardDescription>
                  Schedule festive holidays (Diwali, Pongal), maintenance days, or emergencies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Holiday Form */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold">Schedule a Holiday / Store Closure</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Holiday Date</Label>
                      <Input
                        type="date"
                        value={newHolDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setNewHolDate(e.target.value)}
                        className="mt-1 rounded-xl text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Reason / Festival</Label>
                      <Input
                        placeholder="e.g. Diwali / Pongal"
                        value={newHolReason}
                        onChange={(e) => setNewHolReason(e.target.value)}
                        className="mt-1 rounded-xl text-xs h-8"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-xl text-xs h-8 mt-1"
                    onClick={addCustomHoliday}
                  >
                    <Plus className="mr-1 size-3.5" /> Add Holiday Date
                  </Button>
                </div>

                {/* Holiday List */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Scheduled Holidays ({customHolidays.length})
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customHolidays.map((h) => {
                      const dateObj = new Date(`${h.date}T00:00:00`);
                      const dayName = WEEKDAY_NAMES[dateObj.getDay()];
                      return (
                        <div
                          key={h.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-card p-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {h.reason || "Store Holiday"}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3 text-primary" /> {h.date} ({dayName})
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 rounded-lg text-destructive hover:bg-destructive/10"
                            onClick={() => removeCustomHoliday(h.id)}
                            title="Remove holiday"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}

                    {customHolidays.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-3 text-center">
                        No custom holidays scheduled. Store operates on regular weekly schedule.
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Closed Message */}
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs font-semibold">Custom Notice Message for Customers</Label>
                  <Textarea
                    placeholder="e.g. We are closed today for Diwali! Pre-orders will be delivered tomorrow morning fresh."
                    value={closedMessage}
                    onChange={(e) => setClosedMessage(e.target.value)}
                    className="rounded-xl resize-none text-xs"
                    rows={2}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    This message is displayed to customers on the checkout page when the store is closed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveScheduleSettings.mutate()}
              disabled={saveScheduleSettings.isPending}
              className="rounded-xl px-6"
            >
              {saveScheduleSettings.isPending ? "Saving..." : "Save Operating Hours & Policies"}
            </Button>
          </div>
        </TabsContent>

        {/* TAB 2: Delivery Windows */}
        <TabsContent value="slots" className="space-y-4">
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
                      className="rounded-xl"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="w-start">Starts</Label>
                      <Input
                        id="w-start"
                        type="time"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="w-end">Ends</Label>
                      <Input
                        id="w-end"
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="rounded-xl"
                      />
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
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="w-cut">Cut-off (min before)</Label>
                      <Input
                        id="w-cut"
                        inputMode="numeric"
                        value={cutoff}
                        onChange={(e) => setCutoff(e.target.value.replace(/\D/g, ""))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Days</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_WEEKDAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDays((prev) =>
                              prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            days.includes(d)
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {WEEKDAY_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full rounded-xl" disabled={create.isPending}>
                    <Plus className="mr-1.5 size-4" /> Add window
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Delivery Windows</CardTitle>
                <CardDescription>Switch a window off to hide it from checkout, or edit details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {windows.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No delivery windows configured yet.</p>
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
        </TabsContent>
      </Tabs>

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
                    weekdays: editingWindow.weekdays?.length ? editingWindow.weekdays : ALL_WEEKDAYS,
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
                  {ALL_WEEKDAYS.map((d) => {
                    const activeDays = editingWindow.weekdays ?? ALL_WEEKDAYS;
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
