import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryWindow = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  capacity: number;
  cutoff_minutes: number;
  active: boolean;
  sort_order: number;
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function windowText(w: Pick<DeliveryWindow, "label" | "start_time" | "end_time">) {
  return `${w.label} (${w.start_time}–${w.end_time})`;
}

export const DEFAULT_DELIVERY_WINDOWS: DeliveryWindow[] = [
  {
    id: "slot-morning",
    label: "Morning Harbor Fresh",
    start_time: "07:00",
    end_time: "10:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    capacity: 50,
    cutoff_minutes: 60,
    active: true,
    sort_order: 1,
  },
  {
    id: "slot-noon",
    label: "Afternoon Catch",
    start_time: "11:00",
    end_time: "14:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    capacity: 50,
    cutoff_minutes: 60,
    active: true,
    sort_order: 2,
  },
  {
    id: "slot-evening",
    label: "Evening Harbor Fresh",
    start_time: "17:00",
    end_time: "20:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    capacity: 50,
    cutoff_minutes: 60,
    active: true,
    sort_order: 3,
  },
];

export const deliveryWindowsQuery = queryOptions({
  queryKey: ["delivery-windows", "active"],
  queryFn: async (): Promise<DeliveryWindow[]> => {
    try {
      const { data, error } = await supabase
        .from("delivery_windows")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error || !data || data.length === 0) {
        return DEFAULT_DELIVERY_WINDOWS;
      }
      return data as unknown as DeliveryWindow[];
    } catch {
      return DEFAULT_DELIVERY_WINDOWS;
    }
  },
});

export const adminDeliveryWindowsQuery = queryOptions({
  queryKey: ["admin", "delivery-windows"],
  queryFn: async (): Promise<DeliveryWindow[]> => {
    const { data, error } = await supabase
      .from("delivery_windows")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as DeliveryWindow[];
  },
});
