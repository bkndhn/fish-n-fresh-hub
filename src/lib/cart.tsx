import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem, Product } from "./types";

const KEY = "fnf_cart_v1";

type CartContextValue = {
  items: CartItem[];
  subtotal: number;
  count: number;
  add: (product: Product, qty?: number, cut_preference?: string) => void;
  setQty: (productId: string, qty: number) => void;
  setCutPreference: (productId: string, cut_preference: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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

  const add = useCallback((product: Product, qty = 1, cut_preference?: string) => {
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
        },
      ];
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => (i.product_id === productId ? { ...i, qty } : i)),
    );
  }, []);

  const setCutPreference = useCallback((productId: string, cut_preference: string) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, cut_preference } : i)),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return { items, subtotal, count, add, setQty, setCutPreference, remove, clear };
  }, [items, add, setQty, setCutPreference, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

const FALLBACK: CartContextValue = {
  items: [],
  subtotal: 0,
  count: 0,
  add: () => {},
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
          "Returning an empty inert cart to avoid a blank screen.",
      );
    }
    return FALLBACK;
  }
  return ctx;
}
