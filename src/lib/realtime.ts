/**
 * Real-Time WebSocket & Audio Notification System
 *
 * Provides live Supabase channel subscriptions for order tracking,
 * driver movements, and synthesized Web Audio sound effects (zero external mp3 dependencies).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Web Audio Synthesized Chimes
 * Generates pleasant UI sound effects via browser AudioContext.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Order Status Update Two-Tone Chime (A5 -> D6)
   */
  playStatusChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Barcode Scanner Positive Match Beep (1760Hz sharp beep)
   */
  playScannerBeep() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, now); // A6 high sharp beep

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }

  /**
   * Barcode Scanner Error / Not Found Buzz (180Hz low buzz)
   */
  playScannerError() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();

export function playOrderNotificationSound(type: "status" | "scanner" | "error" = "status") {
  if (type === "scanner") {
    soundEngine.playScannerBeep();
  } else if (type === "error") {
    soundEngine.playScannerError();
  } else {
    soundEngine.playStatusChime();
  }
}

/**
 * Subscribe to a single order's real-time events.
 * Listens for status changes, delivery notes, and driver location updates.
 */
export function subscribeToOrderRealtime(
  orderId: string,
  callbacks: {
    onStatusChange?: (newStatus: string, fullOrder: any) => void;
    onAnyUpdate?: (updatedRow: any) => void;
  }
): () => void {
  if (!orderId) return () => {};

  let lastStatus: string | null = null;

  const channel = supabase
    .channel(`realtime-order-${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        const row = payload.new as any;
        callbacks.onAnyUpdate?.(row);

        if (row?.status && row.status !== lastStatus) {
          lastStatus = row.status;
          soundEngine.playStatusChime();
          callbacks.onStatusChange?.(row.status, row);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to all orders for an authenticated customer or user.
 * Automatically notifies when any active order updates.
 */
export function subscribeToUserOrdersRealtime(
  userId: string,
  onOrderChanged: (order: any) => void
): () => void {
  if (!userId) return () => {};

  const channel = supabase
    .channel(`realtime-user-orders-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        soundEngine.playStatusChime();
        onOrderChanged(payload.new || payload.old);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Realtime Connection Status Hook
 */
export function useRealtimeConnectionStatus() {
  const [status, setStatus] = useState<"connected" | "connecting" | "offline">("connected");

  useEffect(() => {
    const handleOnline = () => setStatus("connected");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}
