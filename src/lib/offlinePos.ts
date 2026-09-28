import { supabase } from "@/integrations/supabase/client";

export interface OfflineOrder {
  offline_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  items: Array<{
    product_id: string;
    name: string;
    qty: number;
    price: number;
    unit?: string;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  branch_id?: string | null;
  created_at: string;
  status: string;
  is_offline: boolean;
}

const DB_NAME = "fnf_pos_offline_db";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

export async function getOfflineDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return null;
  if (dbInstance) return dbInstance;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("orders_queue")) {
          db.createObjectStore("orders_queue", { keyPath: "offline_id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn("[offlinePos] IndexedDB open error, falling back to LocalStorage:", err);
        resolve(null);
      };
    } catch (e) {
      console.warn("[offlinePos] IndexedDB not available, fallback to LocalStorage", e);
      resolve(null);
    }
  });
}

/**
 * Cache active branch product catalog, variants, prices and categories
 */
export async function cachePosCatalog(
  products: any[],
  categories: any[] = [],
  branchId?: string | null
): Promise<void> {
  if (!isBrowser()) return;

  const db = await getOfflineDb();
  if (db) {
    try {
      const tx = db.transaction(["products", "categories", "meta"], "readwrite");
      const prodStore = tx.objectStore("products");
      const catStore = tx.objectStore("categories");
      const metaStore = tx.objectStore("meta");

      // Clear old cached products and repopulate
      prodStore.clear();
      for (const p of products) {
        prodStore.put(p);
      }

      catStore.clear();
      for (const c of categories) {
        catStore.put(c);
      }

      metaStore.put({
        key: "pos_catalog_cache_meta",
        timestamp: new Date().toISOString(),
        count: products.length,
        branchId: branchId || "all",
      });

      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("[offlinePos] Failed to write catalog to IndexedDB, fallback to localStorage", e);
    }
  }

  // LocalStorage Fallback
  try {
    localStorage.setItem("fnf_offline_products", JSON.stringify(products.slice(0, 500)));
    localStorage.setItem("fnf_offline_categories", JSON.stringify(categories));
    localStorage.setItem("fnf_offline_cached_at", new Date().toISOString());
  } catch (lsErr) {
    console.warn("[offlinePos] LocalStorage quota exceeded or disabled", lsErr);
  }
}

/**
 * Retrieve cached products for offline billing
 */
export async function getCachedPosProducts(): Promise<any[]> {
  if (!isBrowser()) return [];

  const db = await getOfflineDb();
  if (db) {
    try {
      return await new Promise<any[]>((resolve) => {
        const tx = db.transaction("products", "readonly");
        const store = tx.objectStore("products");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      // fallback
    }
  }

  try {
    const raw = localStorage.getItem("fnf_offline_products");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve cached categories for offline navigation
 */
export async function getCachedPosCategories(): Promise<any[]> {
  if (!isBrowser()) return [];

  const db = await getOfflineDb();
  if (db) {
    try {
      return await new Promise<any[]>((resolve) => {
        const tx = db.transaction("categories", "readonly");
        const store = tx.objectStore("categories");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      // fallback
    }
  }

  try {
    const raw = localStorage.getItem("fnf_offline_categories");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Generate sequential offline bill number: OFF-{branchId}-{date}-{seq}
 */
export function generateOfflineBillSequence(branchId?: string | null): string {
  if (!isBrowser()) return `OFF-${Date.now()}`;

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const branchTag = (branchId ? branchId.slice(0, 4) : "MAIN").toUpperCase();
  const counterKey = `fnf_offline_seq_${dateStr}`;

  let current = 1;
  try {
    const saved = localStorage.getItem(counterKey);
    if (saved) {
      current = parseInt(saved, 10) + 1;
    }
    localStorage.setItem(counterKey, String(current));
  } catch {
    current = Math.floor(Math.random() * 900) + 100;
  }

  const seqFormatted = String(current).padStart(4, "0");
  return `OFF-${branchTag}-${dateStr}-${seqFormatted}`;
}

/**
 * Save an order to the offline queue
 */
export async function queueOfflineOrder(order: OfflineOrder): Promise<void> {
  if (!isBrowser()) return;

  const db = await getOfflineDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("orders_queue", "readwrite");
        const store = tx.objectStore("orders_queue");
        const req = store.put(order);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch (e) {
      console.warn("[offlinePos] Failed to queue into IndexedDB, falling back to LocalStorage", e);
    }
  }

  try {
    const raw = localStorage.getItem("fnf_offline_order_queue");
    const list: OfflineOrder[] = raw ? JSON.parse(raw) : [];
    list.push(order);
    localStorage.setItem("fnf_offline_order_queue", JSON.stringify(list));
  } catch (err) {
    console.error("[offlinePos] Critical: Failed to save offline order to localStorage queue", err);
  }
}

/**
 * Get all queued offline orders awaiting sync
 */
export async function getQueuedOfflineOrders(): Promise<OfflineOrder[]> {
  if (!isBrowser()) return [];

  const db = await getOfflineDb();
  if (db) {
    try {
      return await new Promise<OfflineOrder[]>((resolve) => {
        const tx = db.transaction("orders_queue", "readonly");
        const store = tx.objectStore("orders_queue");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      // fallback
    }
  }

  try {
    const raw = localStorage.getItem("fnf_offline_order_queue");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove an order from the offline queue after successful sync
 */
export async function removeOfflineOrder(offlineId: string): Promise<void> {
  if (!isBrowser()) return;

  const db = await getOfflineDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction("orders_queue", "readwrite");
        const store = tx.objectStore("orders_queue");
        store.delete(offlineId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // fallback
    }
  }

  try {
    const raw = localStorage.getItem("fnf_offline_order_queue");
    if (raw) {
      const list: OfflineOrder[] = JSON.parse(raw);
      const filtered = list.filter((o) => o.offline_id !== offlineId);
      localStorage.setItem("fnf_offline_order_queue", JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
}

/**
 * Synchronize all pending offline orders with Supabase
 */
export async function syncOfflineOrders(): Promise<{ syncedCount: number; errors: any[] }> {
  if (!isBrowser()) return { syncedCount: 0, errors: [] };
  if (!navigator.onLine) return { syncedCount: 0, errors: ["Device is currently offline"] };

  const pendingOrders = await getQueuedOfflineOrders();
  if (pendingOrders.length === 0) return { syncedCount: 0, errors: [] };

  let syncedCount = 0;
  const errors: any[] = [];

  for (const order of pendingOrders) {
    try {
      // Check if order already exists in Supabase
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("order_number", order.order_number)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase.from("orders").insert({
          order_number: order.order_number,
          customer_name: order.customer_name || "Counter Walk-in",
          customer_phone: order.customer_phone || "9999999999",
          items: order.items as any,
          subtotal: order.subtotal,
          total: order.total,
          discount: order.discount,
          gst_amount: order.tax,
          status: "delivered",
          payment_method: order.payment_method || "cash",
          payment_status: "paid",
          fulfillment_type: "pickup",
          branch_id: order.branch_id || null,
          notes: `[OFFLINE SYNC] Recorded offline at ${order.created_at}`,
          created_at: order.created_at,
        });

        if (insertErr) {
          throw insertErr;
        }

        // Deduct inventory for synced items
        for (const item of order.items) {
          try {
            await (supabase.rpc as any)("adjust_branch_stock", {
              p_branch_id: order.branch_id || null,
              p_product_id: item.product_id,
              p_qty_delta: -Number(item.qty || 1),
            });
          } catch {
            // Non-blocking stock deduction error
          }
        }
      }

      await removeOfflineOrder(order.offline_id);
      syncedCount++;
    } catch (err: any) {
      console.error(`[offlinePos] Sync failed for order ${order.order_number}:`, err);
      errors.push({ orderNumber: order.order_number, message: err.message || "Insert failed" });
    }
  }

  return { syncedCount, errors };
}
