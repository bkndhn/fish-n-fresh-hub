import { Link } from "@tanstack/react-router";
import { Home, LayoutGrid, ReceiptText, ShoppingCart, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { myRolesQuery } from "@/lib/admin";
import { useCart } from "@/lib/cart";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/catalog", label: "Catalog", icon: LayoutGrid },
  { to: "/cart", label: "Cart", icon: ShoppingCart, hasBadge: true },
  { to: "/orders", label: "Orders", icon: ReceiptText },
] as const;

export function BottomNav() {
  const { count } = useCart();
  const { data: myRoles } = useQuery(myRolesQuery);
  const showAdmin = myRoles?.some((r) => ["admin", "staff", "driver"].includes(r));

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-3 inset-x-0 mx-auto z-50 flex justify-center px-3.5 md:hidden pointer-events-none safe-bottom"
    >
      <div className="pointer-events-auto flex items-center justify-between w-full max-w-[390px] rounded-3xl bg-card/90 dark:bg-card/95 backdrop-blur-2xl border border-border/80 shadow-[0_10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-1.5 ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
        <ul className="flex items-center justify-around w-full gap-1 m-0 p-0 list-none">
          {items.map(({ to, label, icon: Icon, ...rest }) => (
            <li key={to} className="flex-1 flex justify-center">
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2.5 rounded-2xl w-full text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90 [&.active]:bg-primary/15 [&.active]:text-primary [&.active]:font-bold [&.active]:shadow-2xs"
              >
                <div className="relative flex items-center justify-center">
                  <Icon className="size-4.5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                  {"hasBadge" in rest && rest.hasBadge && count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground font-extrabold text-[9px] shadow-xs ring-2 ring-background animate-in zoom-in-75">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </div>
                <span className="tracking-tight leading-tight">{label}</span>
              </Link>
            </li>
          ))}

          {showAdmin && (
            <li className="flex-1 flex justify-center">
              <Link
                to="/admin"
                className="group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2.5 rounded-2xl w-full text-[10px] font-medium text-primary/80 hover:text-primary transition-all duration-200 active:scale-90 [&.active]:bg-primary/20 [&.active]:text-primary [&.active]:font-bold [&.active]:shadow-2xs"
              >
                <Shield className="size-4.5 transition-transform duration-200 group-hover:scale-110" />
                <span className="tracking-tight leading-tight font-bold">Admin</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
