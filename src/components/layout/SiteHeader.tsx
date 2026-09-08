import { Link } from "@tanstack/react-router";
import { Fish, Search, ShoppingCart, User, Shield } from "lucide-react";
import { useCart } from "@/lib/cart";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { myRolesQuery } from "@/lib/admin";
import { useTranslation } from "@/lib/i18n";
import { getStoreStatus } from "@/lib/storeSchedule";

export function SiteHeader() {
  const { count } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: myRoles } = useQuery(myRolesQuery);
  const { lang, setLang } = useTranslation();

  const storeStatus = settings ? getStoreStatus(settings) : null;
  
  return (
    <header className="glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Store Logo" className="h-8 w-auto object-contain" />
          ) : (
            <span className="ocean-gradient flex size-8 items-center justify-center rounded-xl text-primary-foreground">
              <Fish className="size-4" />
            </span>
          )}
          {!settings?.logo_url && "Fish N Fresh"}
        </Link>

        {storeStatus && (
          <>
            {/* Desktop / Tablet Status Badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                storeStatus.isOpen
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : storeStatus.allowPreorders
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive font-semibold"
              }`}
              title={storeStatus.statusDescription}
            >
              <span
                className={`size-1.5 rounded-full ${
                  storeStatus.isOpen
                    ? "bg-emerald-500 animate-pulse"
                    : storeStatus.allowPreorders
                    ? "bg-amber-500"
                    : "bg-destructive"
                }`}
              />
              <span>
                {storeStatus.isOpen
                  ? `Open (${storeStatus.openTimeFormatted} – ${storeStatus.closeTimeFormatted})`
                  : storeStatus.allowPreorders
                  ? "Pre-orders Open"
                  : "Store Closed"}
              </span>
            </div>

            {/* Mobile compact dot */}
            <span
              className={`size-2 rounded-full md:hidden shrink-0 ${
                storeStatus.isOpen
                  ? "bg-emerald-500"
                  : storeStatus.allowPreorders
                  ? "bg-amber-500"
                  : "bg-destructive"
              }`}
              title={storeStatus.statusTitle}
            />
          </>
        )}
        <div className="ml-auto">
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value as any)}
            className="rounded-xl border border-input bg-transparent px-2 py-1 text-xs"
          >
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
            <option value="hi">हिंदी</option>
          </select>
        </div>
        <nav className="flex items-center gap-1">
          <Link
            to="/catalog"
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Browse catalog"
          >
            <Search className="size-5" />
          </Link>
          {myRoles?.some((r) => ["admin", "staff", "driver"].includes(r)) && (
            <Link
              to="/admin"
              className="rounded-xl p-2 text-primary hover:bg-primary/10"
              aria-label="Admin Dashboard"
            >
              <Shield className="size-5" />
            </Link>
          )}
          <Link
            to="/settings"
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Account"
          >
            <User className="size-5" />
          </Link>
          <ThemeToggle />
          <Link to="/cart" className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cart">
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
