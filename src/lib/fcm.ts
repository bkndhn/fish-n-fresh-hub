import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FcmTokenRecord {
  id?: string;
  user_id?: string | null;
  token: string;
  role: "customer" | "driver" | "staff" | "admin";
  device_type: "web" | "android" | "ios";
}

/**
 * Check if Push Notifications are supported on current platform
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/**
 * Request notification permission and register token with Supabase backend
 */
export async function registerPushNotificationToken(params?: {
  userId?: string | null;
  role?: "customer" | "driver" | "staff" | "admin";
}): Promise<string | null> {
  if (!isPushNotificationSupported()) {
    console.info("Push notifications are not supported in this browser");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.info("Notification permission was not granted:", permission);
      return null;
    }

    // Register Firebase messaging service worker
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    // Generate or retrieve persistent web client token
    let clientToken = localStorage.getItem("fnf_push_token");
    if (!clientToken) {
      // Cryptographically random push registration token
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const randomHex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
      clientToken = `fcm_web_${Date.now()}_${randomHex}`;
      localStorage.setItem("fnf_push_token", clientToken);
    }

    const role = params?.role || "customer";
    const userId = params?.userId || null;

    // Upsert into Supabase fcm_tokens table
    try {
      await supabase
        .from("fcm_tokens")
        .upsert(
          {
            user_id: userId,
            token: clientToken,
            role,
            device_type: /Android/i.test(navigator.userAgent) ? "android" : /iPhone|iPad/i.test(navigator.userAgent) ? "ios" : "web",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" }
        );
    } catch (dbErr) {
      console.warn("Could not upsert FCM token to database:", dbErr);
    }

    return clientToken;
  } catch (err) {
    console.error("Error registering push token:", err);
    return null;
  }
}

/**
 * Display a client-side system notification (desktop / Android native)
 */
export async function triggerLocalNotification(options: {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}): Promise<boolean> {
  if (!isPushNotificationSupported() || Notification.permission !== "granted") {
    // Graceful fallback to Sonner in-app toast
    toast.info(options.title, {
      description: options.body,
    });
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (registration) {
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
        badge: "/favicon.ico",
        data: { url: options.url || "/" },
      });
      return true;
    } else {
      new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/favicon.ico",
      });
      return true;
    }
  } catch (err) {
    console.warn("Local notification display error:", err);
    toast.info(options.title, { description: options.body });
    return false;
  }
}

/**
 * Dispatch notification when an order status advances
 */
export async function notifyOrderStatusChange(params: {
  orderId: string;
  orderNumber?: string | null;
  newStatus: string;
  customerName?: string;
}) {
  const { orderId, orderNumber, newStatus, customerName } = params;
  const num = orderNumber || orderId.slice(0, 8).toUpperCase();

  let title = `Order #${num} Update`;
  let body = `Your order status changed to ${newStatus}.`;

  if (newStatus === "confirmed") {
    title = `Order #${num} Confirmed! 🐟`;
    body = `Fish N Fresh Hub has confirmed your order. Fresh catch is being weighed and packed on crushed ice.`;
  } else if (newStatus === "assigned") {
    title = `Delivery Assigned: Order #${num} 🛵`;
    body = `A dedicated delivery partner has been assigned for prompt dispatch.`;
  } else if (newStatus === "out_for_delivery") {
    title = `Out for Delivery! ⚡ Order #${num}`;
    body = `Your seafood is en route! Please have your 4-digit PIN ready for safe handover.`;
  } else if (newStatus === "delivered") {
    title = `Order #${num} Delivered! 🎉`;
    body = `PIN verified and delivered fresh. Enjoy your Kasimedu catch!`;
  }

  await triggerLocalNotification({
    title,
    body,
    url: `/order/${orderId}`,
  });
}
