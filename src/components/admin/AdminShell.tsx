import { useState, type ReactNode } from "react";
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
  Settings,
  MoreHorizontal,
  MessageSquareWarning,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myRolesQuery, type AppRole } from "@/lib/admin";
import { settingsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true, roles: ["admin", "staff"] },
  { to: "/admin/products", label: "Products", icon: Package, roles: ["admin", "staff"] },
  { to: "/admin/banners", label: "Banners", icon: Sparkles, roles: ["admin"] },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ["admin", "staff"] },
  { to: "/admin/customers", label: "Customers", icon: Users, roles: ["admin"] },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, roles: ["admin"] },
  { to: "/admin/badges", label: "Home cards", icon: Sparkles, roles: ["admin"] },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { to: "/admin/payments", label: "Payments", icon: ReceiptText, roles: ["admin"] },
  { to: "/admin/delivery", label: "Delivery", icon: Truck, roles: ["admin", "staff", "driver"] },
  { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["admin", "staff"] },
  { to: "/admin/schedule", label: "Schedule", icon: CalendarClock, roles: ["admin", "staff"] },
  { to: "/admin/driver", label: "Driver map", icon: MapPin, roles: ["admin", "driver"] },
  { to: "/admin/staff", label: "Team", icon: UserCog, roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const satisfies readonly { to: string; label: string; icon: typeof BarChart3; exact?: boolean; roles: readonly AppRole[] }[];

const PRIMARY_MOBILE_PATHS = ["/admin", "/admin/orders", "/admin/products", "/admin/customers"];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: roles, isLoading } = useQuery(myRolesQuery);
  const { data: settings } = useQuery(settingsQuery);
  const myRoles = roles ?? [];
  const allowed = myRoles.some((r) => allow.includes(r));
  const nav = NAV.filter((item) => (item.roles as readonly AppRole[]).some((r) => myRoles.includes(r)));

  const primaryNav = nav.filter((item) => PRIMARY_MOBILE_PATHS.includes(item.to));
  const moreNav = nav.filter((item) => !PRIMARY_MOBILE_PATHS.includes(item.to));

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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto">
                <LogOut className="mr-1.5 size-4" /> Sign out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to sign out? You will need to log in again to access the admin console.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="rounded-xl"
                  onClick={() => {
                    supabase.auth.signOut().then(() => navigate({ to: "/auth" }));
                  }}
                >
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

      {/* Mobile Bottom Navigation: Clean 4 items + "More" drawer */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-border px-2 py-1 md:hidden">
        {primaryNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
            activeProps={{ className: "text-primary font-semibold" }}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] text-muted-foreground transition-colors"
          >
            <item.icon className="size-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}

        {moreNav.length > 0 && (
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <MoreHorizontal className="size-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto p-5">
              <SheetHeader className="mb-4 text-left">
                <SheetTitle>More Admin Pages</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 pb-4">
                {moreNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                    activeProps={{ className: "bg-primary/10 text-primary border-primary/30 font-semibold" }}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-center text-xs font-medium text-foreground transition hover:bg-muted"
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-background shadow-xs">
                      <item.icon className="size-5 text-primary" />
                    </div>
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>
    </div>
  );
}
