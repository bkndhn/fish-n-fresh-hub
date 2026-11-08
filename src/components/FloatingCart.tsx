import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingCart, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { WhatsAppOrderDialog } from "@/components/WhatsAppOrderDialog";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export function FloatingCart() {
  const { items, count, subtotal, clear } = useCart();
  const location = useLocation();
  const [waOpen, setWaOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("*").single();
      return data;
    },
  });

  // Suppress floating cart on Cart, Checkout, or Admin routes
  if (
    items.length === 0 ||
    location.pathname === "/cart" ||
    location.pathname === "/checkout" ||
    location.pathname.startsWith("/admin")
  ) {
    return null;
  }

  const roundedCount = Math.round(count * 100) / 100;

  return (
    <>
      <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-5xl px-3 sm:px-4 md:bottom-6 pointer-events-none">
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary via-primary to-primary/95 px-3 py-2.5 sm:px-4 sm:py-3 text-primary-foreground shadow-2xl pointer-events-auto border border-white/20 animate-in slide-in-from-bottom-3 duration-300 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="relative flex size-9 sm:size-10 items-center justify-center rounded-2xl bg-white/20 shrink-0 shadow-inner">
              <ShoppingCart className="size-4.5 sm:size-5" />
              <span className="absolute -top-1 -right-1 flex size-4.5 sm:size-5 items-center justify-center rounded-full bg-accent text-accent-foreground font-mono text-[10px] font-black shadow-xs">
                {items.length}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base md:text-lg font-mono tracking-tight whitespace-nowrap">{inr(subtotal)}</span>
                <span className="text-[11px] sm:text-xs text-primary-foreground/80 font-medium whitespace-nowrap">({roundedCount} {items.length === 1 ? "unit/kg" : "units/kg"})</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-primary-foreground/75 truncate">
                {items.slice(0, 2).map((i) => i.name).join(", ")}{items.length > 2 ? ` +${items.length - 2} more` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setConfirmOpen(true)}
              aria-label="Clear cart"
              title="Clear cart"
              className="shrink-0 rounded-xl size-8.5 sm:size-10 bg-white/15 text-primary-foreground hover:bg-white/25 hover:text-primary-foreground"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWaOpen(true)}
              className="shrink-0 rounded-xl px-2.5 sm:px-4 bg-[#25D366] text-white hover:bg-[#128C7E] border-none shadow-md h-8.5 sm:h-10 transition-transform hover:scale-102"
              title="Order on WhatsApp"
            >
              <WhatsAppIcon className="size-4" />
              <span className="hidden sm:inline font-bold ml-1">WhatsApp</span>
            </Button>
            <Button asChild variant="secondary" className="shrink-0 rounded-xl px-3 sm:px-5 shadow-md text-xs sm:text-sm font-bold gap-1 sm:gap-1.5 hover:scale-102 transition-transform h-8.5 sm:h-10">
              <Link to="/cart">
                <span className="whitespace-nowrap">Cart</span>
                <ArrowRight className="size-3.5 sm:size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your cart?</AlertDialogTitle>
            <AlertDialogDescription>
              All {items.length} {items.length === 1 ? "item" : "items"} will be removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep items</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { clear(); toast.success("Cart cleared"); }}
            >
              Clear cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WhatsAppOrderDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        items={items.map((i) => ({
          productId: i.product_id,
          name: i.name,
          cutPreference: i.cut_preference || undefined,
          qty: i.qty,
          unit: i.unit,
          price: i.price,
          totalPrice: i.price * i.qty,
        }))}
        subtotal={subtotal}
        deliveryFee={settings?.delivery_fee ?? 40}
        settings={settings ?? null}
      />
    </>
  );
}
