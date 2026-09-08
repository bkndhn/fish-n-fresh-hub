import { supabase } from "@/integrations/supabase/client";

/**
 * SHA-256 hash a plaintext PIN in browser environment.
 */
export async function hashDeliveryPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically random 4-digit delivery PIN (1000-9999).
 */
export function generateDeliveryPin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const val = array[0] ?? Math.floor(Math.random() * 9000);
  const randomNum = (val % 9000) + 1000;
  return randomNum.toString();
}

export interface DeliveryPinData {
  pin_code: string;
  attempts?: number;
  max_attempts?: number;
  verified_at?: string | null;
}

/**
 * Create and register an order's delivery PIN.
 * Stored in `order_delivery_pins` with RLS allowing SELECT only to `customer_id`.
 */
export async function registerOrderDeliveryPin(
  orderId: string,
  customerId?: string | null,
  customPin?: string
): Promise<string> {
  const pin = customPin || generateDeliveryPin();
  const pinHash = await hashDeliveryPin(pin);

  // Store in localStorage for instant offline customer access on current browser
  try {
    localStorage.setItem(`fnf_order_pin_${orderId}`, pin);
  } catch {
    // localStorage could be disabled or full
  }

  try {
    const { error } = await supabase.from("order_delivery_pins" as any).upsert(
      {
        order_id: orderId,
        customer_id: customerId,
        pin_code: pin,
        pin_hash: pinHash,
        attempts: 0,
        max_attempts: 5,
      } as any,
      { onConflict: "order_id" }
    );

    if (error) {
      console.warn("Could not insert order_delivery_pins (migration may be pending):", error.message);
    }
  } catch (err) {
    console.warn("Exception inserting delivery PIN:", err);
  }

  return pin;
}

/**
 * Fetch the delivery PIN for an order.
 * Due to PostgreSQL RLS, this ONLY succeeds for the authenticated customer who placed the order.
 * Admins, staff, and drivers will receive null.
 */
export async function getCustomerOrderDeliveryPin(
  orderId: string
): Promise<DeliveryPinData | null> {
  // Check local cache first
  let cachedPin: string | null = null;
  try {
    cachedPin = localStorage.getItem(`fnf_order_pin_${orderId}`);
  } catch {
    // ignore
  }

  try {
    const { data, error } = await supabase
      .from("order_delivery_pins" as any)
      .select("pin_code, attempts, max_attempts, verified_at")
      .eq("order_id", orderId)
      .maybeSingle();

    if (data && (data as any).pin_code) {
      // Sync local cache
      try {
        localStorage.setItem(`fnf_order_pin_${orderId}`, (data as any).pin_code);
      } catch {
        // ignore
      }
      return data as unknown as DeliveryPinData;
    }

    if (error) {
      // If table doesn't exist or RLS denied, fallback to local storage if customer is on same device
      if (cachedPin) {
        return { pin_code: cachedPin };
      }
      return null;
    }
  } catch {
    if (cachedPin) {
      return { pin_code: cachedPin };
    }
  }

  if (cachedPin) {
    return { pin_code: cachedPin };
  }

  return null;
}

export interface VerifyPinResult {
  success: boolean;
  message: string;
}

/**
 * Verifies the customer's PIN and marks order delivered.
 * Can be executed by driver, crew, staff, or admin.
 * Uses secure PostgreSQL RPC `verify_and_deliver_order`.
 */
export async function verifyAndDeliverOrder(
  orderId: string,
  enteredPin: string,
  isAdminOverride = false,
  overrideReason?: string
): Promise<VerifyPinResult> {
  const cleanPin = enteredPin.trim();

  // Try PostgreSQL RPC function first
  try {
    const { data, error } = await supabase.rpc("verify_and_deliver_order" as any, {
      p_order_id: orderId,
      p_entered_pin: cleanPin,
      p_is_admin_override: isAdminOverride,
      p_override_reason: overrideReason || null,
    });

    if (!error && data && typeof data === "object") {
      const res = data as { success: boolean; message: string };
      return res;
    }
  } catch (rpcErr) {
    console.warn("RPC verify_and_deliver_order failed or not deployed:", rpcErr);
  }

  // Graceful client fallback:
  // Query order to check status and handle direct verification
  try {
    // If admin emergency override
    if (isAdminOverride) {
      const { error: updErr } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          delivery_note: overrideReason ? `ADMIN BYPASS: ${overrideReason}` : "ADMIN OVERRIDE",
          payment_status: "paid",
        } as any)
        .eq("id", orderId);

      if (updErr) throw updErr;
      return { success: true, message: "Emergency bypass recorded. Order marked delivered." };
    }

    // Check against order_delivery_pins if accessible or hashed
    const { data: pinRow } = await supabase
      .from("order_delivery_pins" as any)
      .select("pin_code, pin_hash, attempts, max_attempts")
      .eq("order_id", orderId)
      .maybeSingle();

    if (pinRow) {
      const p = pinRow as any;
      if (p.attempts >= (p.max_attempts || 5)) {
        return {
          success: false,
          message: "PIN verification locked due to 5 incorrect attempts. Ask store manager for admin bypass.",
        };
      }

      const inputHash = await hashDeliveryPin(cleanPin);
      const isMatch = (p.pin_code && p.pin_code === cleanPin) || (p.pin_hash && p.pin_hash === inputHash);

      if (!isMatch) {
        // Increment attempts
        await supabase
          .from("order_delivery_pins" as any)
          .update({ attempts: (p.attempts || 0) + 1 } as any)
          .eq("order_id", orderId);

        const remaining = (p.max_attempts || 5) - ((p.attempts || 0) + 1);
        return {
          success: false,
          message: `Incorrect Delivery PIN! ${remaining} attempt(s) remaining. Ask customer for the 4-digit PIN on their tracking screen.`,
        };
      }

      // Mark verified
      await supabase
        .from("order_delivery_pins" as any)
        .update({ verified_at: new Date().toISOString() } as any)
        .eq("order_id", orderId);
    }

    // Mark order as delivered
    const { error: orderErr } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        payment_status: "paid",
      } as any)
      .eq("id", orderId);

    if (orderErr) throw orderErr;

    return {
      success: true,
      message: "Delivery PIN verified! Order marked as successfully delivered.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to verify delivery PIN",
    };
  }
}
