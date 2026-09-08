import { Link } from "@tanstack/react-router";
import { Home, LayoutGrid, ReceiptText, ShoppingCart, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { myRolesQuery } from "@/lib/admin";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/catalog", label: "Catalog", icon: LayoutGrid },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/orders", label: "Orders", icon: ReceiptText },
] as const;

export function BottomNav() {
  const { data: myRoles } = useQuery(myRolesQuery);
  const showAdmin = myRoles?.some((r) => ["admin", "staff", "driver"].includes(r));

  return (
    <nav className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border md:hidden">
      <ul className="mx-auto flex max-w-5xl">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground [&.active]:text-primary"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          </li>
        ))}
        {showAdmin && (
          <li className="flex-1">
            <Link
              to="/admin"
              className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground [&.active]:text-primary"
            >
              <Shield className="size-5 text-primary" />
              <span className="text-primary font-medium">Admin</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
