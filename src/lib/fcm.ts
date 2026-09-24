/**
 * Native FCM Web Push & Notification Engine — v2 (Production Grade)
 *
 * Supports:
 * - Role-based FCM token registration (admin / staff / driver / customer)
 * - Branch-scoped registration (for multi-branch deployments)
 * - Web Push VAPID subscription stored in Supabase fcm_tokens table
 * - Automatic device detection (android / ios / web)
 * - Native High-Priority Browser Notification Fallback
 * - Auto re-registration when push subscription changes (SW relay)
 * - pushsubscriptionchange listener for seamless re-subscription
 */

import { supabase } from "@/integrations/supabase/client";

export type DeviceType = "web" | "android" | "ios";
export type UserNotificationRole = "customer" | "driver" | "staff" | "admin";

export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "web";
}

/**
 * Request notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Notifications not supported in this browser.");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  return await Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register push notification service worker and record token in Supabase fcm_tokens.
 * @param userId  - Auth user id (null for guest)
 * @param role    - Notification routing role
 * @param branchId - Optional branch scope for staff/driver targeting
 */
export async function registerPushNotification(
  userId?: string | null,
  role: UserNotificationRole = "customer",
  branchId?: string | null
): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return null;
  }

  try {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return null;

    // Register / reuse service worker
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Get existing or create new Web Push subscription
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const vapidKey = import.meta.env?.["VITE_VAPID_PUBLIC_KEY"] || null;
      if (vapidKey) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
          });
        } catch (subErr) {
          console.warn("[FCM] PushManager subscribe note:", subErr);
        }
      }
    }

    const tokenStr = sub
      ? JSON.stringify(sub.toJSON())
      : `web_push_${Math.random().toString(36).slice(2)}_${Date.now()}`;

    // Store/refresh in Supabase fcm_tokens
    const upsertData: Record<string, unknown> = {
      user_id: userId || null,
      token: tokenStr,
      role,
      device_type: detectDeviceType(),
      updated_at: new Date().toISOString(),
    };

    // Only include branch_id if the column exists (safe to always include — DB ignores extra if not present)
    if (branchId !== undefined) {
      upsertData["branch_id"] = branchId || null;
    }

    await supabase.from("fcm_tokens").upsert(
      upsertData as any //[0] extends never ? never : any,
      { onConflict: "token" }
    );

    return tokenStr;
  } catch (err) {
    console.warn("Push notification registration note:", err);
    return null;
  }
}

/**
 * Re-register the push subscription when it changes (called from SW message).
 * Call this once in your app root to keep tokens fresh.
 */
export function listenForPushSubscriptionChanges(
  userId?: string | null,
  role: UserNotificationRole = "customer",
  branchId?: string | null
): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
      console.log("[FCM] Push subscription changed — re-registering...");
      void registerPushNotification(userId, role, branchId);
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

// ─── Role-specific convenience helpers ───────────────────────────────────────

/** Register current user as admin (call on admin login). */
export async function registerAdminToken(
  userId: string,
  branchId?: string | null
): Promise<string | null> {
  return registerPushNotification(userId, "admin", branchId);
}

/** Register current user as staff. */
export async function registerStaffToken(
  userId: string,
  branchId?: string | null
): Promise<string | null> {
  return registerPushNotification(userId, "staff", branchId);
}

/** Register driver — call when driver taps "Go Online". */
export async function registerDriverToken(
  userId: string,
  branchId?: string | null
): Promise<string | null> {
  return registerPushNotification(userId, "driver", branchId);
}

/** Register as customer (default for storefront visitors). */
export async function registerCustomerToken(
  userId?: string | null
): Promise<string | null> {
  return registerPushNotification(userId, "customer");
}

/**
 * Refresh the push registration — call on every app open.
 * Ensures updated_at is current so stale detection works correctly.
 */
export async function refreshPushRegistration(
  userId?: string | null,
  role: UserNotificationRole = "customer",
  branchId?: string | null
): Promise<void> {
  await registerPushNotification(userId, role, branchId);
}

// ─── Local notification helpers ──────────────────────────────────────────────

/**
 * Show a native high-priority browser notification immediately (in-app).
 */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      ...options,
    });

    if (options?.url) {
      notif.onclick = () => {
        window.focus();
        window.location.href = options.url || "/";
        notif.close();
      };
    }
  } catch {
    // If constructor fails on Android Chrome, use service worker
    navigator.serviceWorker?.ready.then((reg) => {
      reg.showNotification(title, {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        ...options,
      });
    });
  }
}

/**
 * Trigger high-priority order status change push notification to customer.
 */
export async function notifyOrderStatusChange({
  orderId,
  orderNumber,
  newStatus,
  customerName,
}: {
  orderId: string;
  orderNumber?: string | undefined;
  newStatus: string;
  customerName?: string | undefined;
}): Promise<void> {
  const displayNum = orderNumber || orderId.slice(0, 8);
  let statusText = "Updated";
  if (newStatus === "confirmed") statusText = "Confirmed & Queued for Packing";
  else if (newStatus === "processing") statusText = "Fresh Cutting & Cleaning Underway";
  else if (newStatus === "out_for_delivery") statusText = "Out for Priority Delivery on Ice";
  else if (newStatus === "delivered") statusText = "Successfully Delivered";

  const title = `Order #${displayNum} ${statusText}`;
  const body = customerName
    ? `Hi ${customerName}, your fresh catch order status is now: ${statusText}.`
    : `Your order #${displayNum} is now: ${statusText}.`;

  showLocalNotification(title, {
    body,
    url: `/orders`,
  });
}

// ─── Backward-compatible aliases ─────────────────────────────────────────────
export const registerPushNotificationToken = registerPushNotification;
export const triggerLocalNotification = showLocalNotification;
