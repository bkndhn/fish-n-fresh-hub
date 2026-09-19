import { useState, useEffect, useCallback } from "react";

const WISHLIST_KEY = "fnf_wishlist_items";

export function useWishlist() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const loadWishlist = () => {
      try {
        const stored = localStorage.getItem(WISHLIST_KEY);
        if (stored) {
          setItems(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to parse wishlist from local storage", e);
      }
    };

    loadWishlist();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === WISHLIST_KEY) {
        loadWishlist();
      }
    };
    
    const handleCustomEvent = () => {
      loadWishlist();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("wishlist-updated", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("wishlist-updated", handleCustomEvent);
    };
  }, []);

  const add = useCallback((productId: string) => {
    setItems((prev) => {
      if (prev.includes(productId)) return prev;
      const next = [...prev, productId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
      return next;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((prev) => {
      if (!prev.includes(productId)) return prev;
      const next = prev.filter((id) => id !== productId);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
      return next;
    });
  }, []);

  const toggle = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    localStorage.removeItem(WISHLIST_KEY);
    window.dispatchEvent(new Event("wishlist-updated"));
  }, []);

  const isInWishlist = useCallback(
    (productId: string) => items.includes(productId),
    [items]
  );

  return {
    items,
    count: items.length,
    add,
    remove,
    toggle,
    clear,
    isInWishlist,
  };
}
