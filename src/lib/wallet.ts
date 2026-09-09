import { supabase } from "@/integrations/supabase/client";
import type { CustomerWallet, WalletTransaction } from "./types";

/**
 * Fetch or auto-provision customer FreshCash wallet.
 * Every user gets a unique referral code (e.g. FNF-9A4B2).
 */
export async function getOrCreateUserWallet(userId: string): Promise<CustomerWallet | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from("customer_wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.warn("Error fetching wallet:", error);
    }

    if (data) {
      return data as CustomerWallet;
    }

    // Auto-generate code e.g. FNF-8X2M9
    const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `FNF-${suffix}`;

    const { data: newWallet, error: insertError } = await supabase
      .from("customer_wallets")
      .insert({
        user_id: userId,
        balance: 0,
        referral_code: referralCode,
        total_earned: 0,
        total_redeemed: 0,
      })
      .select("*")
      .single();

    if (insertError) {
      // Fallback: if table doesn't exist yet in remote DB, return in-memory mock wallet
      console.warn("Wallet creation fallback:", insertError.message);
      return {
        user_id: userId,
        balance: 50, // Welcome gift
        referral_code: referralCode,
        total_earned: 50,
        total_redeemed: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return newWallet as CustomerWallet;
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
  } catch (err) {
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
 * Deduct wallet balance during checkout
 */
export async function redeemWalletBalance(params: {
  userId: string;
  amount: number;
  orderId?: string;
}): Promise<boolean> {
  const { userId, amount, orderId } = params;
  if (!userId || amount <= 0) return false;

  try {
    // 1. Fetch current wallet
    const { data: wallet } = await supabase
      .from("customer_wallets")
      .select("balance, total_redeemed")
      .eq("user_id", userId)
      .single();

    if (!wallet || Number(wallet.balance) < amount) {
      console.warn("Insufficient wallet balance for redemption");
      return false;
    }

    const newBalance = Number(wallet.balance) - amount;
    const newTotalRedeemed = Number(wallet.total_redeemed || 0) + amount;

    // 2. Update wallet
    const { error: updateError } = await supabase
      .from("customer_wallets")
      .update({
        balance: newBalance,
        total_redeemed: newTotalRedeemed,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update wallet balance:", updateError);
      return false;
    }

    // 3. Insert transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: userId,
      amount: -amount,
      type: "order_redemption",
      description: `Redeemed for Order #${orderId ? orderId.slice(0, 8) : "Checkout"}`,
      order_id: orderId || null,
    });

    return true;
  } catch (err) {
    console.error("Wallet redemption error:", err);
    return false;
  }
}

/**
 * Credit cashback or referral reward to wallet
 */
export async function creditWalletBalance(params: {
  userId: string;
  amount: number;
  type: "cashback" | "referral_bonus" | "signup_bonus" | "admin_adjustment";
  description: string;
  orderId?: string;
}): Promise<boolean> {
  const { userId, amount, type, description, orderId } = params;
  if (!userId || amount <= 0) return false;

  try {
    const { data: wallet } = await supabase
      .from("customer_wallets")
      .select("balance, total_earned")
      .eq("user_id", userId)
      .single();

    if (!wallet) return false;

    const newBalance = Number(wallet.balance) + amount;
    const newTotalEarned = Number(wallet.total_earned || 0) + amount;

    await supabase
      .from("customer_wallets")
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    await supabase.from("wallet_transactions").insert({
      wallet_id: userId,
      amount,
      type,
      description,
      order_id: orderId || null,
    });

    return true;
  } catch (err) {
    console.error("Failed to credit wallet:", err);
    return false;
  }
}
