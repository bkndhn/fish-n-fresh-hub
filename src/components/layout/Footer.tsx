import { useQuery } from "@tanstack/react-query";
import {
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Star,
  Clock,
  ShieldCheck,
  Zap,
  Award,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Fish,
} from "lucide-react";
import { settingsQuery } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
import { getStoreStatus } from "@/lib/storeSchedule";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export function Footer() {
  const { data: settings } = useQuery(settingsQuery);

  if (!settings) return null;

  const storeStatus = getStoreStatus(settings);

  const mapLink =
    settings.store_map_link ||
    (settings.shop_lat && settings.shop_lng
      ? `https://www.google.com/maps/search/?api=1&query=${settings.shop_lat},${settings.shop_lng}`
      : null);

  const waTarget = settings.whatsapp_number || settings.support_phone;
  const waUrl = waTarget
    ? getWhatsAppUrl(
        waTarget,
        `Hi ${settings.store_name || "Fish N Fresh"}, I'd like to check today's fresh seafood catch and place an order!`
      )
    : null;

  return (
    <footer className="mt-16 border-t border-border/80 bg-card text-muted-foreground pb-24 md:pb-12 text-xs sm:text-sm w-full max-w-full overflow-hidden">
      {/* 1. Quality & Trust Assurance Bar */}
      <div className="border-b border-border/60 bg-muted/30 py-6 px-3 sm:px-4 w-full max-w-full overflow-hidden">
        <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Fish className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-xs sm:text-sm">100% Day Catch</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                Daily fresh harbour landings. Zero chemicals or formalin.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-xs sm:text-sm">45-Min Cold Chain</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                Packed with insulated gel ice chill pads at 0–4°C.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-xs sm:text-sm">Cleaned & Pan-Ready</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                Custom cuts: Bengali, Steaks, or Curry Cut to order.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-xs sm:text-sm">Freshness Guarantee</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight break-words">
                100% satisfaction promise or instant replacement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 5-Column Navigation & Information */}
      <div className="mx-auto max-w-6xl px-3 sm:px-4 pt-10 pb-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 w-full max-w-full overflow-hidden">
        {/* Column 1: Brand & Heritage */}
        <div className="space-y-4 lg:col-span-1">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Store Logo"
              className="h-10 w-auto object-contain"
            />
          ) : (
            <p className="font-display text-xl font-extrabold text-foreground flex items-center gap-2">
              <Fish className="size-5 text-primary" />
              {settings.store_name || "Fish N Fresh"}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Chennai's premier dock-to-door fresh seafood marketplace. Sourced directly from local harbour boats every morning.
          </p>
          {settings.fssai_number && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>FSSAI: {settings.fssai_number}</span>
            </div>
          )}
        </div>

        {/* Column 2: Seafood Categories */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
            Seafood Catalog
          </h3>
          <ul className="space-y-2 text-xs">
            <li>
              <Link to="/catalog" search={{ category: "Sea Fish" }} className="hover:text-primary transition-colors flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground" /> Sea Fish & Vanjaram
              </Link>
            </li>
            <li>
              <Link to="/catalog" search={{ category: "Prawns" }} className="hover:text-primary transition-colors flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground" /> Prawns & Shrimps
              </Link>
            </li>
            <li>
              <Link to="/catalog" search={{ category: "Crabs" }} className="hover:text-primary transition-colors flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground" /> Mud Crab & Blue Crab
              </Link>
            </li>
            <li>
              <Link to="/catalog" search={{ category: "River Fish" }} className="hover:text-primary transition-colors flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground" /> Freshwater / River Fish
              </Link>
            </li>
            <li>
              <Link to="/catalog" className="hover:text-primary transition-colors flex items-center gap-1 font-semibold text-primary pt-1">
                <Sparkles className="size-3 text-primary" /> View All Catches &rarr;
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Store Hours & Live Status */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3 flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" /> Store Timings
          </h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  storeStatus.isOpen
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : storeStatus.statusBadge === "preorder_only"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    storeStatus.isOpen
                      ? "bg-emerald-500 animate-pulse"
                      : storeStatus.statusBadge === "preorder_only"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                />
                {storeStatus.isOpen
                  ? "Open Now"
                  : storeStatus.statusBadge === "preorder_only"
                  ? "Pre-Orders Open"
                  : "Closed"}
              </span>
            </div>
            <p className="font-semibold text-foreground text-xs">
              {storeStatus.openTimeFormatted} – {storeStatus.closeTimeFormatted}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {storeStatus.isOpen
                ? "Accepting express 45-min delivery and pickup."
                : storeStatus.statusDescription}
            </p>
            <div className="rounded-xl bg-muted/50 p-2 border border-border/50 text-[10px] text-muted-foreground">
              🚢 <strong>Harbour Landings:</strong> 06:30 AM & 02:00 PM daily.
            </div>
          </div>
        </div>

        {/* Column 4: Official WhatsApp Deep Link & Contact */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
            Instant Support
          </h3>
          <div className="space-y-2.5">
            {/* WhatsApp World-Class Deep Link Card */}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 p-3 transition-all duration-200 text-foreground hover:shadow-sm"
              >
                <div className="size-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <WhatsAppIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-[#128C7E] dark:text-[#25D366] flex items-center gap-1">
                    Chat on WhatsApp
                    <ExternalLink className="size-3 opacity-70" />
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Fast order help & catch inquiry
                  </p>
                </div>
              </a>
            )}

            {settings.support_phone && (
              <a
                href={`tel:${settings.support_phone}`}
                className="flex items-center gap-2 text-xs hover:text-primary transition-colors py-0.5"
              >
                <Phone className="size-3.5 text-primary shrink-0" />
                <span>Call: {settings.support_phone}</span>
              </a>
            )}

            {settings.support_email && (
              <a
                href={`mailto:${settings.support_email}`}
                className="flex items-center gap-2 text-xs hover:text-primary transition-colors py-0.5"
              >
                <Mail className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{settings.support_email}</span>
              </a>
            )}

            {settings.store_address && (
              <div className="pt-1">
                {mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-1.5 text-xs hover:text-primary transition-colors leading-tight"
                  >
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{settings.store_address}</span>
                  </a>
                ) : (
                  <div className="flex items-start gap-1.5 text-xs leading-tight">
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{settings.store_address}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 5: Trust, Community & Google Reviews */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
            Customer Community
          </h3>
          <div className="space-y-3">
            {/* Google Reviews Badge */}
            {settings.google_review_link ? (
              <a
                href={settings.google_review_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-2.5 hover:bg-yellow-500/10 transition-colors"
              >
                <div className="flex text-yellow-500">
                  <Star className="size-4 fill-current" />
                  <Star className="size-4 fill-current" />
                  <Star className="size-4 fill-current" />
                  <Star className="size-4 fill-current" />
                  <Star className="size-4 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">4.9 / 5.0 Rating</p>
                  <p className="text-[10px] text-muted-foreground">Review on Google &rarr;</p>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-2.5">
                <div className="flex text-yellow-500">
                  <Star className="size-3.5 fill-current" />
                  <Star className="size-3.5 fill-current" />
                  <Star className="size-3.5 fill-current" />
                  <Star className="size-3.5 fill-current" />
                  <Star className="size-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-foreground">4.9 / 5.0 Verified</span>
              </div>
            )}

            {/* Social Links */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Follow Us</p>
              <div className="flex items-center gap-2">
                {settings.social_instagram && (
                  <a
                    href={settings.social_instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="size-8 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary flex items-center justify-center transition-all"
                  >
                    <Instagram className="size-4" />
                  </a>
                )}
                {settings.social_facebook && (
                  <a
                    href={settings.social_facebook}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="size-8 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary flex items-center justify-center transition-all"
                  >
                    <Facebook className="size-4" />
                  </a>
                )}
                {settings.social_x && (
                  <a
                    href={settings.social_x}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="X Twitter"
                    className="size-8 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary flex items-center justify-center transition-all"
                  >
                    <Twitter className="size-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Navigation Shortcuts */}
            <div className="pt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link to="/orders" className="hover:text-primary transition-colors">
                Track Order
              </Link>
              <Link to="/terms" className="hover:text-primary transition-colors">
                Terms & Safety
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Legal & Copyright Bar */}
      <div className="mt-8 border-t border-border/60 pt-6 px-3 sm:px-4 w-full max-w-full overflow-hidden">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-muted-foreground w-full">
          <p className="break-words">
            &copy; {new Date().getFullYear()} {settings.store_name || "Fish N Fresh"}. All rights reserved. 100% Certified Chemical-Free Seafood Delivery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-primary transition-colors">
              Refund Policy
            </Link>
            <span>·</span>
            <Link to="/catalog" className="hover:text-primary transition-colors font-medium text-foreground">
              Daily Catches
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

