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
  const { error } = await supabase
    .from("orders")
    .update(
      status === "returned"
        ? { return_status: status, returned_at: new Date().toISOString() }
        : { return_status: status },
    )
    .eq("id", orderId);

  if (error) throw error;
  return true;
}

export async function processRefundToWallet(orderId: string, customerId: string, amount: number) {
  // 1. Get current wallet
  const { data: wallet, error: walletErr } = await supabase
    .from("customer_wallets")
    .select("user_id, balance")
    .eq("user_id", customerId)
    .maybeSingle();

  if (walletErr && walletErr.code !== "PGRST116") throw walletErr;

  if (!wallet) {
    const { error: createErr } = await supabase.from("customer_wallets").insert({
      user_id: customerId,
      balance: amount,
      referral_code: `FNF-${customerId.slice(0, 5).toUpperCase()}`,
    });
    if (createErr) throw createErr;
  } else {
    const { error: updateWalletErr } = await supabase
      .from("customer_wallets")
      .update({ balance: Number(wallet.balance ?? 0) + amount })
      .eq("user_id", customerId);
    if (updateWalletErr) throw updateWalletErr;
  }

  // Log transaction
  await supabase.from("wallet_transactions").insert({
    wallet_id: customerId,
    amount,
    type: "credit",
    description: `Refund for order #${orderId}`,
    order_id: orderId,
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
