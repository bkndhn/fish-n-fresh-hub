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
  Anchor,
  Trash2,
  Bell,
  Store,
  MessageCircle,
  Rocket,
} from "lucide-react";
import { GoLiveChecklistModal } from "@/components/admin/GoLiveChecklistModal";
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
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true, roles: ["admin", "manager", "staff"] },
  { to: "/admin/pos", label: "POS Counter", icon: Store, roles: ["admin", "manager", "cashier", "staff"] },
  { to: "/admin/products", label: "Products", icon: Package, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/broadcasts", label: "Catch Alerts", icon: Bell, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/purchases", label: "Purchases", icon: Anchor, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/waste", label: "Waste mgmt", icon: Trash2, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/banners", label: "Banners", icon: Sparkles, roles: ["admin", "manager"] },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ["admin", "manager", "cashier", "support_staff", "staff"] },
  { to: "/admin/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "support_staff"] },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, roles: ["admin", "manager"] },
  { to: "/admin/badges", label: "Home cards", icon: Sparkles, roles: ["admin", "manager"] },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/admin/payments", label: "Payments", icon: ReceiptText, roles: ["admin", "manager"] },
  { to: "/admin/delivery", label: "Delivery", icon: Truck, roles: ["admin", "manager", "driver", "staff"] },
  { to: "/admin/support", label: "Live Support", icon: MessageCircle, roles: ["admin", "manager", "support_staff", "staff"] },
  { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["admin", "manager", "support_staff", "staff"] },
  { to: "/admin/schedule", label: "Schedule", icon: CalendarClock, roles: ["admin", "manager", "staff"] },
  { to: "/admin/driver", label: "Driver map", icon: MapPin, roles: ["admin", "manager", "driver"] },
  { to: "/admin/staff", label: "Team", icon: UserCog, roles: ["admin"] },
  { to: "/admin/onboarding", label: "Setup Wizard", icon: Sparkles, roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const satisfies readonly { to: string; label: string; icon: typeof BarChart3; exact?: boolean; roles: readonly AppRole[] }[];

const PRIMARY_MOBILE_PATHS = ["/admin", "/admin/orders", "/admin/products", "/admin/customers"];

export function AdminShell({
  title,
  action,
  children,
  allow = ["admin"],
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  allow?: readonly AppRole[];
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
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
    const fallbackRoute = nav[0]?.to || "/";
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md w-full p-6 rounded-3xl bg-card border border-border/80 shadow-xl text-center space-y-4">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center font-bold">
            <LogOut className="size-6 rotate-180" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your staff role (<span className="font-mono font-semibold text-foreground">{myRoles.join(", ") || "unassigned"}</span>) does not have permission to view <span className="font-semibold text-foreground">"{title}"</span>.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button asChild className="rounded-xl">
              <Link to={fallbackRoute}>Go to Authorized Section</Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))}
            >
              Sign out / Switch Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden w-full">
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
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGoLiveOpen(true)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary shadow-2xs"
            >
              <Rocket className="size-3.5" />
              <span className="hidden sm:inline">Go-Live Readiness</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
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
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-3 sm:px-6 sm:py-6 overflow-x-hidden w-full">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary shadow-xs" }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 max-w-full overflow-x-hidden pb-24 md:pb-6">
          <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2.5">
            <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
            {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
          </div>
          {children}
        </main>
      </div>

      {/* Floating Premium Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Admin Mobile Navigation"
        className="fixed bottom-3 inset-x-0 mx-auto z-50 flex justify-center px-3.5 md:hidden pointer-events-none safe-bottom"
      >
        <div className="pointer-events-auto flex items-center justify-between w-full max-w-[420px] rounded-3xl bg-card/90 dark:bg-card/95 backdrop-blur-2xl border border-border/80 shadow-[0_10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-1.5 ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
          <ul className="flex items-center justify-around w-full gap-1 m-0 p-0 list-none">
            {primaryNav.map((item) => (
              <li key={item.to} className="flex-1 flex justify-center">
                <Link
                  to={item.to}
                  activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                  className="group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-2xl w-full text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90 [&.active]:bg-primary/15 [&.active]:text-primary [&.active]:font-bold [&.active]:shadow-2xs"
                >
                  <div className="relative flex items-center justify-center">
                    <item.icon className="size-4.5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                  </div>
                  <span className="truncate max-w-[62px] tracking-tight leading-tight">{item.label}</span>
                </Link>
              </li>
            ))}

            {moreNav.length > 0 && (
              <li className="flex-1 flex justify-center">
                <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 rounded-2xl w-full text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90"
                    >
                      <div className="relative flex items-center justify-center">
                        <MoreHorizontal className="size-4.5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                      </div>
                      <span className="truncate max-w-[62px] tracking-tight leading-tight">More</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 border-t border-border/80 bg-background shadow-2xl">
                    <SheetHeader className="mb-4 text-left">
                      <SheetTitle className="text-base font-bold">Admin Console Menu</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-3 gap-2.5 pb-6">
                      {moreNav.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                          activeProps={{ className: "bg-primary/10 text-primary border-primary/40 font-bold shadow-xs" }}
                          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card p-3 text-center text-xs font-medium text-foreground transition active:scale-95 hover:bg-muted"
                        >
                          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
                            <item.icon className="size-5" />
                          </div>
                          <span className="leading-tight line-clamp-1">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* Interactive Store Go-Live Readiness Modal */}
      <GoLiveChecklistModal open={goLiveOpen} onOpenChange={setGoLiveOpen} />
    </div>
  );
}
