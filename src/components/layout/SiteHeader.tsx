import { Link } from "@tanstack/react-router";
import { Fish, Search, ShoppingCart, User, Shield } from "lucide-react";
import { useCart } from "@/lib/cart";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { myRolesQuery } from "@/lib/admin";
import { useTranslation } from "@/lib/i18n";

export function SiteHeader() {
  const { count } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: myRoles } = useQuery(myRolesQuery);
  const { lang, setLang } = useTranslation();
  
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
