import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Fish,
  LogOut,
  MapPin,
  Package,
  ReceiptText,
  Tag,
  Users,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminRoleQuery } from "@/lib/admin";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/promotions", label: "Promotions", icon: Tag },
  { to: "/admin/delivery", label: "Delivery", icon: Truck },
  { to: "/admin/driver", label: "Driver map", icon: MapPin },
  { to: "/admin/staff", label: "Team", icon: UserCog },
] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useQuery(adminRoleQuery);

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading console...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-xl font-bold">Admin access required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This account doesn't have admin rights. Ask the store owner to grant you access.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-display font-bold">
            <span className="ocean-gradient flex size-8 items-center justify-center rounded-xl text-primary-foreground">
              <Fish className="size-4" />
            </span>
            Fish N Fresh
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
            {NAV.map((item) => (
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
        {NAV.map((item) => (
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
