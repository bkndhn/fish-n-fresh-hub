import { supabase } from "@/integrations/supabase/client";
import type { CustomerWallet, WalletTransaction } from "./types";

/**
 * Fetch or auto-provision the signed-in customer's FreshCash wallet.
 * Creation happens in a trusted database function so balances can never be
 * invented on the client.
 */
export async function getOrCreateUserWallet(userId: string): Promise<CustomerWallet | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase.rpc("ensure_my_wallet");
    if (error) {
      console.warn("Wallet unavailable:", error.message);
      return null;
    }
    return (data as unknown as CustomerWallet) ?? null;
  } catch (err) {
    console.error("Failed to getOrCreateUserWallet:", err);
    return null;
  }
}

/**
 * Fetch wallet transaction ledger for user
 */
export async function getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching wallet transactions:", error);
      return [];
    }

    return (data as WalletTransaction[]) || [];
  } catch {
    return [];
  }
}

/**
 * Validate a referral code entered during checkout or onboarding
 */
export async function validateReferralCode(code: string, currentUserId?: string): Promise<{
  valid: boolean;
  message: string;
  referrerWallet?: CustomerWallet;
}> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: "Please enter a referral code" };
  }

  try {
    const { data, error } = await supabase
      .from("customer_wallets")
      .select("*")
      .eq("referral_code", cleanCode)
      .maybeSingle();

    if (error || !data) {
      return { valid: false, message: "Invalid or expired referral code" };
    }

    if (currentUserId && data.user_id === currentUserId) {
      return { valid: false, message: "You cannot use your own referral code" };
    }

    return {
      valid: true,
      message: "Valid referral code! You will get ₹50 FreshCash discount",
      referrerWallet: data as CustomerWallet,
    };
  } catch {
    return { valid: false, message: "Could not verify referral code at this moment" };
  }
}

/**
 * Compute the maximum redeemable wallet amount for an order subtotal
 */
export function calculateMaxRedeemable(
  walletBalance: number,
  orderSubtotal: number,
  maxBurnPercent: number = 50
): number {
  if (walletBalance <= 0 || orderSubtotal <= 0) return 0;
  const maxAllowableFromOrder = Math.floor((orderSubtotal * maxBurnPercent) / 100);
  return Math.min(Math.floor(walletBalance), maxAllowableFromOrder);
}

/**
 * Deduct wallet balance during checkout.
 * The balance check and deduction happen atomically in the database, so a
 * customer cannot reuse the same balance on multiple orders. Returns false when
 * the deduction did not happen — callers must then drop the wallet discount.
 */
export async function redeemWalletBalance(params: {
  userId: string;
  amount: number;
  orderId?: string;
}): Promise<boolean> {
  const { userId, amount, orderId } = params;
  if (!userId || amount <= 0) return false;

  try {
    const { data, error } = await supabase.rpc("redeem_wallet_balance", {
      p_amount: amount,
      ...(orderId ? { p_order_id: orderId } : {}),
    });

    if (error) {
      console.warn("Wallet redemption failed:", error.message);
      return false;
    }
    const result = (data ?? {}) as { success?: boolean };
    return Boolean(result.success);
  } catch (err) {
    console.error("Wallet redemption error:", err);
    return false;
  }
}

/**
 * Credit cashback for a completed order. The amount is computed server-side
 * from the order total and store settings, and can only be claimed once.
 */
export async function creditWalletCashback(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  try {
    const { data, error } = await supabase.rpc("credit_wallet_cashback", { p_order_id: orderId });
    if (error) {
      console.warn("Cashback credit failed:", error.message);
      return false;
    }
    const result = (data ?? {}) as { success?: boolean };
    return Boolean(result.success);
  } catch (err) {
    console.error("Failed to credit wallet:", err);
    return false;
  }
}
