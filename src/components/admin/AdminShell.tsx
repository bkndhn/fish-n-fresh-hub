import { useState, useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  FileText,
  Rocket,
  Layers,
  Image,
  Eye,
  ExternalLink,
  ShieldAlert,
  Banknote,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  ShieldCheck,
  Wrench,
  Check,
} from "lucide-react";
import { AdminBranchProvider } from "@/lib/branchContext";
import { AdminBranchSwitcher } from "@/components/admin/AdminBranchSwitcher";
import { GoLiveChecklistModal } from "@/components/admin/GoLiveChecklistModal";
import { supabase } from "@/integrations/supabase/client";
import { registerPushNotification } from "@/lib/fcm";
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
  { to: "/admin/products", label: "Products", icon: Package, roles: ["admin", "manager", "inventory_manager"] },
  { to: "/admin/broadcasts", label: "Catch Alerts", icon: Bell, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/purchases", label: "Purchases", icon: Anchor, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/waste", label: "Waste mgmt", icon: Trash2, roles: ["admin", "manager", "inventory_manager", "staff"] },
  { to: "/admin/expenses", label: "Expenses", icon: Banknote, roles: ["admin", "manager", "staff"] },
  { to: "/admin/banners", label: "Banners", icon: Image, roles: ["admin", "manager"] },
  { to: "/admin/collections", label: "Collections", icon: Layers, roles: ["admin", "manager"] },
  { to: "/admin/orders", label: "Orders", icon: ReceiptText, roles: ["admin", "manager", "cashier", "support_staff", "staff"] },
  { to: "/admin/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "support_staff"] },
  { to: "/admin/promotions", label: "Promotions", icon: Tag, roles: ["admin", "manager"] },
  { to: "/admin/wholesale", label: "Wholesale", icon: Tag, roles: ["admin", "manager"] },
  { to: "/admin/badges", label: "Home cards", icon: Sparkles, roles: ["admin", "manager"] },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/admin/gst-reports", label: "GST & Tax", icon: FileText, roles: ["admin"] },
  { to: "/admin/payments", label: "Payments", icon: ReceiptText, roles: ["admin", "manager"] },
  { to: "/admin/delivery", label: "Delivery", icon: Truck, roles: ["admin", "manager", "driver", "staff"] },
  { to: "/admin/returns", label: "Logistics & Returns", icon: Truck, roles: ["admin", "manager"] },
  { to: "/admin/support", label: "Live Support", icon: MessageCircle, roles: ["admin", "manager", "support_staff", "staff"] },
  { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["admin", "manager", "support_staff", "staff"] },
  { to: "/admin/schedule", label: "Schedule", icon: CalendarClock, roles: ["admin", "manager", "staff"] },
  { to: "/admin/driver", label: "Driver map", icon: MapPin, roles: ["admin", "manager", "driver"] },
  { to: "/admin/staff", label: "Team", icon: UserCog, roles: ["admin"] },
  { to: "/admin/super", label: "Super Admin", icon: ShieldAlert, roles: ["super_admin"] },
  { to: "/admin/onboarding", label: "Setup Wizard", icon: Sparkles, roles: ["admin"] },
  { to: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const satisfies readonly { to: string; label: string; icon: typeof BarChart3; exact?: boolean; roles: readonly AppRole[] }[];

const PRIMARY_MOBILE_PATHS = ["/admin", "/admin/orders", "/admin/products", "/admin/customers"];

export function AdminShell({
  title,
  action,
  children,
  allow = ["admin"],
  fullWidth = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  allow?: readonly AppRole[];
  fullWidth?: boolean;
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: roles, isLoading } = useQuery(myRolesQuery);
  const { data: settings } = useQuery(settingsQuery);
  const myRoles = roles ?? [];
  const isSuperAdmin = myRoles.includes("super_admin");
  const isDirectlyAllowed = myRoles.some((r) => allow.includes(r));
  const allowed = isDirectlyAllowed || isSuperAdmin;
  const qc = useQueryClient();

  const nav = NAV.filter((item) => {
    // Filter by role first
    if (!isSuperAdmin && !(item.roles as readonly AppRole[]).some((r) => myRoles.includes(r))) return false;
    // Hide POS Counter if feature disabled in settings
    if (item.to === "/admin/pos" && (settings as any)?.feature_pos_enabled === false) return false;
    return true;
  });

  // Automatic seamless routing to permitted workspace based on role
  useEffect(() => {
    if (!isLoading && roles !== undefined && !allowed) {
      if (nav.length > 0 && nav[0]) {
        const target = nav[0];
        toast.info(`Redirected to your authorized workspace: ${target.label}`);
        navigate({ to: target.to, replace: true });
      } else {
        toast.error("Access restricted: Staff credentials required");
        navigate({ to: "/", replace: true });
      }
    }
  }, [allowed, isLoading, roles, nav, navigate]);

  // Register push notifications automatically for admin/staff
  useEffect(() => {
    if (!isLoading && roles && allowed) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user?.id) {
          const highestRole = roles.includes("admin") || roles.includes("super_admin") ? "admin" : "staff";
          registerPushNotification(data.session.user.id, highestRole as any).catch(console.warn);
        }
      });
    }
  }, [allowed, isLoading, roles]);

  const primaryNav = nav.filter((item) => PRIMARY_MOBILE_PATHS.includes(item.to));
  const moreNav = nav.filter((item) => !PRIMARY_MOBILE_PATHS.includes(item.to));

  if (isLoading && !roles) {
    return <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading console...</div>;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Routing to authorized workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminBranchProvider>
      <div className="min-h-screen bg-muted/30 overflow-x-hidden w-full">
        <header className="glass sticky top-0 z-50 border-b border-border w-full max-w-full overflow-hidden">
          <div className={`mx-auto flex h-14 ${fullWidth ? "max-w-[1920px] px-3 sm:px-6" : "max-w-7xl px-2.5 sm:px-4"} items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0`}>
            <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
              <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-display font-bold text-foreground shrink-0">
                <img 
                  src={settings?.logo_url || "/logo.png"} 
                  alt="Store Logo" 
                  className="h-7.5 sm:h-8 w-auto rounded-xl object-contain shrink-0 shadow-2xs" 
                />
                <span className="hidden md:inline">{settings?.store_name || "Fish N Fresh"}</span>
              </Link>

              <AdminBranchSwitcher />
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold gap-1 sm:gap-1.5 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-2xs transition-all px-2 sm:px-3"
                title="View Customer Portal / Live Storefront"
              >
                <Link to="/" target="_blank" rel="noopener noreferrer">
                  <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">Customer Portal</span>
                  <span className="sm:hidden text-[11px]">Store</span>
                  <ExternalLink className="size-2.5 opacity-60 ml-0.5 shrink-0" />
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setGoLiveOpen(true)}
                className="hidden sm:flex h-8 rounded-xl text-xs font-bold gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary shadow-2xs"
                title="Interactive Store Go-Live Readiness"
              >
                <Rocket className="size-3.5 shrink-0" />
                <span>Go-Live Readiness</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-3 text-xs" title="Sign out">
                    <LogOut className="size-3.5 sm:size-4 sm:mr-1.5 shrink-0" />
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out of Admin Console?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to sign out? Any unsaved edits in open product forms, POS bills, or settings will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      <div className={`mx-auto flex ${fullWidth ? "max-w-[1920px] px-2 sm:px-4 md:px-6 py-3 md:py-5" : "max-w-7xl px-3 py-3 sm:px-6 sm:py-6"} gap-3 md:gap-5 w-full`}>
        <aside className={`hidden shrink-0 md:block transition-all duration-200 ${sidebarCollapsed ? "w-16" : "w-56"}`}>
          <div className="sticky top-20 space-y-2">
            <div className="flex items-center justify-between px-2 pb-1 border-b border-border/40">
              {!sidebarCollapsed && <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Admin Console</span>}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-auto"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar to give full width to workspace"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  activeOptions={{ exact: Boolean((item as { exact?: boolean }).exact) }}
                  activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary shadow-xs font-bold" }}
                  className={`flex items-center rounded-xl py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${
                    sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 max-w-full pb-24 md:pb-6">
          {isSuperAdmin && !isDirectlyAllowed && (
            <div className="mb-3 flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="size-3.5 text-purple-600" />
                Super Admin Platform Inspection Mode
              </span>
              <Link to="/admin/super" className="underline font-bold text-xs hover:text-foreground">
                Fleet Governance &rarr;
              </Link>
            </div>
          )}
          <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2.5">
            <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
            {action && <div className="flex flex-wrap items-center gap-2 max-w-full">{action}</div>}
          </div>
          {children}
        </main>
      </div>

      {/* Floating Premium Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Admin Mobile Navigation"
        className="fixed bottom-3 inset-x-0 mx-auto z-50 flex justify-center px-3.5 md:hidden pointer-events-none safe-bottom"
      >
        <div className="pointer-events-auto flex items-center justify-between w-full max-w-[420px] rounded-3xl bg-card border border-border/80 shadow-[0_10px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] p-1.5 ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
          <ul className="flex items-center justify-around w-full gap-1 m-0 p-0 list-none">
            {primaryNav.map((item) => (
              <li key={item.to} className="flex-1 flex justify-center">
                <Link
                  to={item.to}
                  preload="intent"
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
                    <SheetHeader className="mb-3 text-left">
                      <SheetTitle className="text-base font-bold">Admin Console Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mb-4 space-y-2">
                      <Button
                        asChild
                        className="w-full h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 shadow-xs"
                      >
                        <Link to="/" target="_blank" rel="noopener noreferrer" onClick={() => setMoreOpen(false)}>
                          <Eye className="size-4" />
                          <span>View Live Customer Storefront</span>
                          <ExternalLink className="size-3.5 opacity-70 ml-auto" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMoreOpen(false);
                          setGoLiveOpen(true);
                        }}
                        className="w-full h-10 rounded-2xl border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs gap-2 shadow-2xs"
                      >
                        <Rocket className="size-4" />
                        <span>Go-Live Readiness Checklist</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 pb-6">
                      {moreNav.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          preload="intent"
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
    </AdminBranchProvider>
  );
}

