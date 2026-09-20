import { supabase } from "@/integrations/supabase/client";

export async function requestReturn(orderId: string, reason: string) {
  const { error } = await supabase
    .from("orders")
    .update({
      return_status: "requested",
      return_reason: reason,
      return_requested_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw error;
  return true;
}

export async function updateReturnStatus(orderId: string, status: "approved" | "rejected" | "returned") {
  const updateData: any = { return_status: status };
  if (status === "returned") {
    updateData.returned_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

  if (error) throw error;
  return true;
}

export async function processRefundToWallet(orderId: string, customerId: string, amount: number) {
  // Use a transaction or edge function in production, but here we'll do sequential updates.
  // 1. Get current wallet
  const { data: wallet, error: walletErr } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", customerId)
    .single();
    
  if (walletErr && walletErr.code !== 'PGRST116') throw walletErr;

  if (!wallet) {
    // Create wallet
    const { error: createErr } = await supabase.from("wallets").insert({
      user_id: customerId,
      balance: amount,
    });
    if (createErr) throw createErr;
  } else {
    const { error: updateWalletErr } = await supabase
      .from("wallets")
      .update({ balance: Number(wallet.balance) + amount })
      .eq("user_id", customerId);
    if (updateWalletErr) throw updateWalletErr;
  }

  // Log transaction
  await supabase.from("wallet_transactions").insert({
    user_id: customerId,
    amount: amount,
    type: "credit",
    description: `Refund for order #${orderId}`,
    metadata: { order_id: orderId },
  });

  // 2. Mark order as refunded
  const { error: orderErr } = await supabase
    .from("orders")
    .update({
      refund_status: "processed",
      refund_processed_at: new Date().toISOString(),
      refund_amount: amount,
    })
    .eq("id", orderId);

  if (orderErr) throw orderErr;
  return true;
}
