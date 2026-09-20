import { supabase } from "@/integrations/supabase/client";

export async function addTransitCheckpoint(orderId: string, location: string, statusText: string) {
  // First get current transit log
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("transit_log")
    .eq("id", orderId)
    .single();

  if (fetchErr) throw fetchErr;

  const currentLog = Array.isArray(order.transit_log) ? order.transit_log : [];
  const newCheckpoint = {
    timestamp: new Date().toISOString(),
    location: location.trim(),
    status: statusText.trim(),
  };

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      transit_log: [...currentLog, newCheckpoint],
    })
    .eq("id", orderId);

  if (updateErr) throw updateErr;
  return true;
}

export async function updateCourierDetails(orderId: string, partner: string, awb: string, url: string) {
  const { error } = await supabase
    .from("orders")
    .update({
      courier_partner: partner.trim() || null,
      awb_number: awb.trim() || null,
      tracking_url: url.trim() || null,
      shipped_at: new Date().toISOString(),
      status: "shipped", // Update order status to shipped when AWB is added
    })
    .eq("id", orderId);

  if (error) throw error;
  return true;
}
