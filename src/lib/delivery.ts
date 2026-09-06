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

export const deliveryWindowsQuery = queryOptions({
  queryKey: ["delivery-windows", "active"],
  queryFn: async (): Promise<DeliveryWindow[]> => {
    const { data, error } = await supabase
      .from("delivery_windows")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as unknown as DeliveryWindow[];
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
