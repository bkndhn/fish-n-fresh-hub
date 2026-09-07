import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarClock,
  Fish,
  LogOut,
  MapPin,
  Package,
  ReceiptText,
  Tag,
  Sparkles,
  Truck,
  Users,
  UserCog,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myRolesQuery, type AppRole } from "@/lib/admin";
import { settingsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true, roles: ["admin", "staff"] },
  { to: "/admin/products", label: "Products", icon: Package, roles: ["admin", "staff"] },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ["admin", "staff"] },
  { to: "/admin/customers", label: "Customers", icon: Users, roles: ["admin"] },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, roles: ["admin"] },
  { to: "/admin/badges", label: "Home cards", icon: Sparkles, roles: ["admin"] },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { to: "/admin/payments", label: "Payments", icon: ReceiptText, roles: ["admin"] },
  { to: "/admin/delivery", label: "Delivery", icon: Truck, roles: ["admin", "staff", "driver"] },
  { to: "/admin/schedule", label: "Schedule", icon: CalendarClock, roles: ["admin", "staff"] },
  { to: "/admin/driver", label: "Driver map", icon: MapPin, roles: ["admin", "driver"] },
  { to: "/admin/staff", label: "Team", icon: UserCog, roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const satisfies readonly { to: string; label: string; icon: typeof BarChart3; exact?: boolean; roles: readonly AppRole[] }[];

export function AdminShell({
  title,
  children,
  allow = ["admin"],
}: {
  title: string;
  children: ReactNode;
  allow?: readonly AppRole[];
}) {
  const navigate = useNavigate();
  const { data: roles, isLoading } = useQuery(myRolesQuery);
  const myRoles = roles ?? [];
  const allowed = myRoles.some((r) => allow.includes(r));
  const nav = NAV.filter((item) => (item.roles as readonly AppRole[]).some((r) => myRoles.includes(r)));

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading console...</div>;
  }

  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Access denied. You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Store Logo" className="h-8 w-auto object-contain" />
            ) : (
              <span className="ocean-gradient flex size-8 items-center justify-center rounded-xl text-primary-foreground">
                <Fish className="size-4" />
              </span>
            )}
            {!settings?.logo_url && "Fish N Fresh"}
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">Admin</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}
          >
            <LogOut className="mr-1.5 size-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-6">
          <h1 className="mb-4 font-display text-2xl font-bold">{title}</h1>
          {children}
        </main>
      </div>

      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex border-t border-border md:hidden">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
            activeProps={{ className: "text-primary" }}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
          >
            <item.icon className="size-4" />
            {item.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
