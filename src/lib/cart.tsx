import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, Product } from "./types";
import { supabase } from "@/integrations/supabase/client";
import {
  applyAccountDiscount,
  resolveWholesaleUnitPrice,
  resolveBandPercent,
  nextBand,
  type WholesaleBand,
} from "./wholesale";


const KEY = "fnf_cart_v1";

export type CartBranchInfo = {
  id: string;
  name: string;
};

export type PendingCartMismatch = {
  product: Product;
  qty: number;
  cut_preference?: string | undefined;
  branch?: CartBranchInfo | undefined;
};

type CartContextValue = {
  items: CartItem[];
  subtotal: number;
  count: number;
  cartBranchId: string | null;
  cartBranchName: string | null;
  pendingMismatch: PendingCartMismatch | null;
  clearPendingMismatch: () => void;
  confirmSwitchAndAdd: () => void;
  isWholesale: boolean;
  wholesaleDiscountPercent: number;
  wholesaleBusinessName: string | null;
  add: (product: Product, qty?: number, cut_preference?: string, branch?: CartBranchInfo) => { added: boolean; mismatch: boolean };
  clearAndAdd: (product: Product, qty?: number, cut_preference?: string, branch?: CartBranchInfo) => void;
  setQty: (productId: string, qty: number) => void;
  setCutPreference: (productId: string, cut_preference: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingMismatch, setPendingMismatch] = useState<PendingCartMismatch | null>(null);
  const [wholesale, setWholesale] = useState<{ active: boolean; discount: number; name: string | null }>({
    active: false,
    discount: 0,
    name: null,
  });

  // Load the signed-in buyer's trade account, if they have an approved one.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          if (!cancelled) setWholesale({ active: false, discount: 0, name: null });
          return;
        }
        const { data } = await supabase
          .from("wholesale_accounts")
          .select("status, extra_discount_percent, business_name")
          .eq("user_id", uid)
          .maybeSingle();
        if (cancelled) return;
        setWholesale({
          active: data?.status === "approved",
          discount: Number(data?.extra_discount_percent ?? 0) || 0,
          name: (data?.business_name as string | null) ?? null,
        });
      } catch {
        /* ignore */
      }
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  // Determine current active branch of cart items
  const cartBranchId = useMemo(() => {
    const itemWithBranch = items.find((i) => Boolean(i.branch_id));
    return itemWithBranch?.branch_id ?? null;
  }, [items]);

  const cartBranchName = useMemo(() => {
    const itemWithBranch = items.find((i) => Boolean(i.branch_name));
    return itemWithBranch?.branch_name ?? null;
  }, [items]);

  const add = useCallback(
    (product: Product, qty = 1, cut_preference?: string, branch?: CartBranchInfo) => {
      const targetBranchId = branch?.id || product.branch_id || null;
      const targetBranchName = branch?.name || product.branch_name || null;

      // Cross-Branch Cart Conflict Detection:
      // If the cart already has items from a different branch, trigger mismatch guard!
      if (items.length > 0 && cartBranchId && targetBranchId && cartBranchId !== targetBranchId) {
        setPendingMismatch({
          product,
          qty,
          cut_preference: cut_preference ?? "",
          branch: targetBranchId ? { id: targetBranchId, name: targetBranchName || "Selected Hub" } : undefined,
        });
        return { added: false, mismatch: true };
      }

      setItems((prev) => {
        const existing = prev.find((i) => i.product_id === product.id);
        if (existing) {
          return prev.map((i) => (i.product_id === product.id ? { ...i, qty: i.qty + qty } : i));
        }
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            price: Number(product.price),
            unit: product.unit,
            image_url: product.image_url,
            qty,
            cut_preference: cut_preference || "Curry Cut",
            branch_id: targetBranchId,
            branch_name: targetBranchName,
            retail_price: Number(product.price),
            wholesale_price: product.wholesale_price ?? null,
            wholesale_min_qty: product.wholesale_min_qty ?? 0,
            wholesale_tiers: product.wholesale_tiers ?? [],
          },
        ];
      });

      return { added: true, mismatch: false };
    },
    [items, cartBranchId]
  );

  const clearAndAdd = useCallback(
    (product: Product, qty = 1, cut_preference?: string, branch?: CartBranchInfo) => {
      const targetBranchId = branch?.id || product.branch_id || null;
      const targetBranchName = branch?.name || product.branch_name || null;

      setPendingMismatch(null);
      setItems([
        {
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit,
          image_url: product.image_url,
          qty,
          cut_preference: cut_preference || "Curry Cut",
          branch_id: targetBranchId,
          branch_name: targetBranchName,
          retail_price: Number(product.price),
          wholesale_price: product.wholesale_price ?? null,
          wholesale_min_qty: product.wholesale_min_qty ?? 0,
          wholesale_tiers: product.wholesale_tiers ?? [],
        },
      ]);
    },
    []
  );

  const confirmSwitchAndAdd = useCallback(() => {
    if (!pendingMismatch) return;
    clearAndAdd(
      pendingMismatch.product,
      pendingMismatch.qty,
      pendingMismatch.cut_preference,
      pendingMismatch.branch
    );
  }, [pendingMismatch, clearAndAdd]);

  const clearPendingMismatch = useCallback(() => {
    setPendingMismatch(null);
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, qty } : i))
    );
  }, []);

  const setCutPreference = useCallback((productId: string, cut_preference: string) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, cut_preference } : i))
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setPendingMismatch(null);
  }, []);

  const pricedItems = useMemo<CartItem[]>(() => {
    if (!wholesale.active) return items;
    return items.map((i) => {
      const retail = Number(i.retail_price ?? i.price) || 0;
      const tierPrice = resolveWholesaleUnitPrice(
        {
          price: retail,
          wholesale_price: i.wholesale_price ?? null,
          wholesale_min_qty: i.wholesale_min_qty ?? 0,
          wholesale_tiers: i.wholesale_tiers ?? [],
        },
        i.qty,
      );
      return { ...i, retail_price: retail, price: applyAccountDiscount(tierPrice, wholesale.discount) };
    });
  }, [items, wholesale.active, wholesale.discount]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = pricedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = pricedItems.reduce((sum, i) => sum + i.qty, 0);
    return {
      items: pricedItems,
      isWholesale: wholesale.active,
      wholesaleDiscountPercent: wholesale.discount,
      wholesaleBusinessName: wholesale.name,
      subtotal,
      count,
      cartBranchId,
      cartBranchName,
      pendingMismatch,
      clearPendingMismatch,
      confirmSwitchAndAdd,
      add,
      clearAndAdd,
      setQty,
      setCutPreference,
      remove,
      clear,
    };
  }, [
    pricedItems,
    wholesale,
    cartBranchId,
    cartBranchName,
    pendingMismatch,
    clearPendingMismatch,
    confirmSwitchAndAdd,
    add,
    clearAndAdd,
    setQty,
    setCutPreference,
    remove,
    clear,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}


const FALLBACK: CartContextValue = {
  items: [],
  subtotal: 0,
  count: 0,
  isWholesale: false,
  wholesaleDiscountPercent: 0,
  wholesaleBusinessName: null,
  cartBranchId: null,
  cartBranchName: null,
  pendingMismatch: null,
  clearPendingMismatch: () => {},
  confirmSwitchAndAdd: () => {},
  add: () => ({ added: false, mismatch: false }),
  clearAndAdd: () => {},
  setQty: () => {},
  setCutPreference: () => {},
  remove: () => {},
  clear: () => {},
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.error(
        "useCart: no CartProvider found in the component tree. " +
          "Ensure <CartProvider> wraps <Outlet /> in src/routes/__root.tsx. " +
          "Returning an empty inert cart to avoid a blank screen."
      );
    }
    return FALLBACK;
  }
  return ctx;
}
