import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, Product } from "./types";

const KEY = "fnf_cart_v1";

export type CartBranchInfo = {
  id: string;
  name: string;
};

export type PendingCartMismatch = {
  product: Product;
  qty: number;
  cut_preference?: string;
  branch?: CartBranchInfo;
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

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return {
      items,
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
    items,
    subtotalSummary(items),
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

function subtotalSummary(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

const FALLBACK: CartContextValue = {
  items: [],
  subtotal: 0,
  count: 0,
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
