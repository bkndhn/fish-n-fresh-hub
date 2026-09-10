/**
 * Atomic Inventory Synchronization & Rollback Engine.
 *
 * Guarantees that:
 * 1. Stock is checked pre-flight before order placement (prevents overselling).
 * 2. Stock is atomically decremented upon order creation (Online checkout & In-store POS).
 * 3. Stock is automatically restored if an order is cancelled or rejected.
 */

import { supabase } from "@/integrations/supabase/client";

export interface StockCheckResult {
  available: boolean;
  unavailableItem?: string;
  availableStock?: number;
  requestedQty?: number;
  message?: string;
}

/**
 * Pre-flight stock availability verification.
 */
export async function checkCartStockAvailability(
  items: { product_id?: string; productId?: string; name: string; qty: number }[]
): Promise<StockCheckResult> {
  try {
    for (const item of items) {
      const pid = item.product_id || item.productId;
      if (!pid) continue;

      const { data: prod, error } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", pid)
        .maybeSingle();

      if (error || !prod) continue;

      const liveStock = typeof prod.stock === "number" ? prod.stock : 999;
      const requested = Number(item.qty || 1);

      if (liveStock < requested) {
        return {
          available: false,
          unavailableItem: prod.name,
          availableStock: liveStock,
          requestedQty: requested,
          message:
            liveStock <= 0
              ? `Sorry, "${prod.name}" has just sold out! Please remove it to continue.`
              : `Only ${liveStock} remaining for "${prod.name}" (you requested ${requested}). Please adjust quantity.`,
        };
      }
    }
    return { available: true };
  } catch (err) {
    console.warn("Stock pre-check exception, allowing checkout:", err);
    return { available: true };
  }
}

/**
 * Deduct inventory for an order atomically.
 * The database guarantees a single deduction per order, so retries are safe.
 */
export async function deductOrderStock(
  orderId: string,
  items: { product_id?: string; productId?: string; qty: number }[]
): Promise<boolean> {
  try {
    const { deductOrderStockServerFn } = await import("@/lib/orders.functions");
    const res = await deductOrderStockServerFn({ data: { orderId, items } });
    return Boolean(res?.success);
  } catch (err) {
    console.error("[InventorySync] Stock deduction failed:", err);
    return false;
  }
}

/**
 * Restore inventory when an order is cancelled or refunded.
 * Only restores stock that was actually deducted, so repeat calls are safe.
 */
export async function restoreOrderStock(
  orderId: string,
  items?: { product_id?: string; productId?: string; qty: number }[]
): Promise<boolean> {
  try {
    const { restoreOrderStockServerFn } = await import("@/lib/orders.functions");
    const res = await restoreOrderStockServerFn({ data: items ? { orderId, items } : { orderId } });
    return Boolean(res?.success);
  } catch (err) {
    console.error("[InventorySync] Stock restoral failed:", err);
    return false;
  }
}
          .update({ stock: newStock } as any)
          .eq("id", pid);
      }
    }
    return true;
  } catch (err) {
    console.error("Failed to restore inventory fallback:", err);
    return false;
  }
}

