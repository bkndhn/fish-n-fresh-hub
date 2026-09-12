import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Fish, Search, ShoppingCart, User, Shield, Download, MapPin, ChevronDown } from "lucide-react";
import { useCart } from "@/lib/cart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { promptPwaInstall } from "@/components/PwaPrompt";

import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { myRolesQuery } from "@/lib/admin";
import { useTranslation } from "@/lib/i18n";
import { getStoreStatus } from "@/lib/storeSchedule";
import { useCustomerBranch } from "@/lib/customerBranchContext";

import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { ReferralModal } from "@/components/ReferralModal";
import { getVerticalConfig } from "@/lib/verticals";
import { getDailyAtmosphere, isDailyAtmosphereEnabled } from "@/lib/dailyAtmosphere";

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function SiteHeader() {
  const { count } = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const { data: myRoles } = useQuery(myRolesQuery);
  const { lang, setLang } = useTranslation();
  const { activeBranch, setIsLocationModalOpen } = useCustomerBranch();
  const [isStandalone, setIsStandalone] = useState(false);
  const [atmosphereActive, setAtmosphereActive] = useState(() => settings ? isDailyAtmosphereEnabled(settings) : false);
  const todayMood = getDailyAtmosphere();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkInstalled = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://") ||
        (typeof localStorage !== "undefined" && localStorage.getItem("fnf_pwa_installed") === "true");
      setIsStandalone(standalone);
    };

    checkInstalled();
    window.addEventListener("appinstalled", checkInstalled);
    window.addEventListener("pwa-app-installed", checkInstalled);

    const onAtmosphereChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAtmosphereActive(Boolean(detail?.enabled ?? (settings ? isDailyAtmosphereEnabled(settings) : false)));
    };
    window.addEventListener("daily-atmosphere-changed", onAtmosphereChanged);

    return () => {
      window.removeEventListener("appinstalled", checkInstalled);
      window.removeEventListener("pwa-app-installed", checkInstalled);
      window.removeEventListener("daily-atmosphere-changed", onAtmosphereChanged);
    };
  }, [settings]);

  const storeStatus = settings ? getStoreStatus(settings) : null;
  const waTarget = settings?.whatsapp_number || settings?.support_phone;
  const waUrl = waTarget
    ? getWhatsAppUrl(
        waTarget,
        `Hi ${settings?.store_name || "Fish N Fresh"}, I'd like to check today's catch!`
      )
    : null;

  
  const vertical = getVerticalConfig(settings?.business_vertical);

  return (
    <header className="glass sticky top-0 z-50 border-b border-border w-full max-w-full overflow-hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-1.5 sm:gap-3 px-3 sm:px-4">
        {/* Left: Brand Logo & Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 font-display text-base sm:text-lg font-bold tracking-tight whitespace-nowrap">
            <img 
              src={settings?.logo_url || "/logo.png"} 
              alt={settings?.store_name || "Fish N Fresh"} 
              className="h-8 sm:h-9 w-auto rounded-xl object-contain shrink-0 shadow-2xs" 
            />
            <span className="truncate max-w-[130px] sm:max-w-none text-foreground">
              {settings?.store_name || "Fish N Fresh"}
            </span>
          </Link>

          {storeStatus && (
            <>
              {/* Desktop / Tablet Status Badge */}
              <div
                className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
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
                    : storeStatus.isLunchBreak
                    ? `Lunch Break (${storeStatus.lunchStartFormatted} – ${storeStatus.lunchEndFormatted})`
                    : storeStatus.allowPreorders
                    ? "Pre-orders Open"
                    : "Store Closed"}
                </span>
              </div>

              {/* Mobile compact dot */}
              <span
                className={`size-2 rounded-full md:hidden shrink-0 ${
                  storeStatus.isOpen
                    ? "bg-emerald-500 animate-pulse"
                    : storeStatus.allowPreorders
                    ? "bg-amber-500"
                    : "bg-destructive"
                }`}
                title={storeStatus.statusTitle}
              />
            </>
          )}

          {/* Daily Coastal Atmosphere Mood Badge */}
          {atmosphereActive && (
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-all hover:bg-primary/10 shadow-2xs cursor-default"
              title={`Today's Coastal Ambience: ${todayMood.name} — ${todayMood.description}`}
            >
              <span className="text-xs">{todayMood.emoji}</span>
              <span className="font-semibold text-primary">{todayMood.name}</span>
            </div>
          )}
        </div>

        {/* Customer Delivery Hub Location Button */}
        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className="flex items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-foreground transition-all shadow-2xs group shrink-0 min-w-0 max-w-[120px] xs:max-w-[150px] sm:max-w-[210px]"
          title="Change delivery hub or auto-detect location"
        >
          <MapPin className="size-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
          <div className="flex flex-col items-start min-w-0 leading-tight text-left">
            <span className="text-[9px] text-muted-foreground hidden sm:inline font-normal">Delivering from</span>
            <span className="truncate font-bold text-foreground text-[10px] sm:text-xs">
              {activeBranch ? activeBranch.name.replace(/ Hub| Branch/gi, "") : "Select Hub"}
            </span>
          </div>
          <ChevronDown className="size-3 text-muted-foreground shrink-0 ml-auto" />
        </button>

        {/* Right: Controls & Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value as "en" | "ta" | "hi")}
            className="h-8 rounded-lg sm:rounded-xl border border-input bg-card/70 px-1.5 sm:px-2 text-[11px] sm:text-xs text-foreground focus:outline-none shadow-2xs"
            aria-label="Select Language"
          >
            <option value="en">EN</option>
            <option value="ta">தமிழ்</option>
            <option value="hi">हिंदी</option>
          </select>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {/* WhatsApp on desktop (mobile uses bottom floating speed dial) */}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat on WhatsApp"
                title="Chat on WhatsApp"
                className="hidden sm:flex rounded-xl p-2 text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
              >
                <WhatsAppIcon className="size-5" />
              </a>
            )}

            {/* Search on desktop (mobile bottom nav has Catalog) */}
            <Link
              to="/catalog"
              className="hidden sm:flex rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Browse catalog"
            >
              <Search className="size-5" />
            </Link>

            {/* Admin shortcut if user has staff/admin role */}
            {myRoles?.some((r) => ["admin", "staff", "driver"].includes(r)) && (
              <Link
                to="/admin"
                className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-primary hover:bg-primary/10 transition-colors"
                aria-label="Admin Dashboard"
                title="Admin Console"
              >
                <Shield className="size-4 sm:size-5" />
              </Link>
            )}

            <Link
              to="/account"
              className="rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="My account"
              title="My account"
            >
              <User className="size-4 sm:size-5" />
            </Link>


            <ReferralModal />

            {/* Install PWA button (hidden when already in standalone mode) */}
            {!isStandalone && (
              <button
                type="button"
                onClick={promptPwaInstall}
                className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all shadow-2xs"
                title="Install Fish N Fresh App"
              >
                <Download className="size-3.5" />
                <span className="hidden xs:inline">Install</span>
              </button>
            )}

            <ThemeToggle />

            {/* Cart on desktop (mobile has bottom bar and floating cart) */}
            <Link
              to="/cart"
              className="hidden sm:flex relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
