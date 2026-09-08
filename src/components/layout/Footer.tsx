import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter, Star, Clock, MessageCircle } from "lucide-react";
import { settingsQuery } from "@/lib/queries";
import { Link } from "@tanstack/react-router";
import { getStoreStatus } from "@/lib/storeSchedule";
import { getWhatsAppUrl } from "@/lib/whatsapp";

export function Footer() {
  const { data: settings } = useQuery(settingsQuery);

  if (!settings) return null;

  const storeStatus = getStoreStatus(settings);

  const mapLink = settings.shop_lat && settings.shop_lng 
    ? `https://www.google.com/maps/search/?api=1&query=${settings.shop_lat},${settings.shop_lng}`
    : null;

  return (
    <footer className="mt-12 border-t border-border bg-card pb-24 pt-12 text-sm text-muted-foreground md:pb-12">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Store Logo" className="h-10 w-auto object-contain" />
          ) : (
            <p className="font-display text-lg font-bold text-foreground">Fish N Fresh</p>
          )}
          <p className="mt-4">Fresh seafood and premium cuts delivered straight to your door.</p>
        </div>

        <div className="md:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Contact</h3>
          <ul className="space-y-3 text-sm">
            {(settings.whatsapp_number || settings.support_phone) && (
              <li>
                <a
                  href={getWhatsAppUrl(
                    (settings.whatsapp_number || settings.support_phone)!,
                    `Hi ${settings.store_name || "Fish N Fresh"}, I'd like to inquire about fresh seafood availability.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                >
                  <MessageCircle className="size-4 shrink-0 fill-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp: {settings.whatsapp_number || settings.support_phone}</span>
                </a>
              </li>
            )}
            {settings.support_phone && (
              <li>
                <a href={`tel:${settings.support_phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4 shrink-0" />
                  {settings.support_phone}
                </a>
              </li>
            )}
            {settings.support_email && (
              <li>
                <a href={`mailto:${settings.support_email}`} className="flex items-center gap-2 hover:text-primary">
                  <Mail className="size-4 shrink-0" /> {settings.support_email}
                </a>
              </li>
            )}
            {settings.store_address && (
              <li>
                {settings.store_map_link ? (
                  <a href={settings.store_map_link} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-primary">
                    <MapPin className="size-4 shrink-0" />
                    <span className="whitespace-pre-wrap leading-tight">{settings.store_address}</span>
                  </a>
                ) : (
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 shrink-0" />
                    <span className="whitespace-pre-wrap leading-tight">{settings.store_address}</span>
                  </div>
                )}
              </li>
            )}
            {mapLink && !settings.store_map_link && (
              <li>
                <a href={mapLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
                  <MapPin className="size-4 shrink-0" /> Store Location Map
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-primary" /> Store Hours
          </p>
          <div className="mt-4 space-y-2 text-sm">
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
            <p className="font-medium text-foreground">
              {storeStatus.openTimeFormatted} – {storeStatus.closeTimeFormatted}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {storeStatus.isOpen
                ? "Accepting express delivery and store pickup orders."
                : storeStatus.statusDescription}
            </p>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              Online store is accessible 24/7. Orders placed off-hours are fulfilled first in the morning.
            </p>
          </div>
        </div>

        <div>
          <p className="font-semibold text-foreground">Legal & Safety</p>
          <ul className="mt-4 space-y-2">
            {settings.fssai_number && (
              <li className="flex flex-col">
                <span className="font-medium">FSSAI License</span>
                <span>{settings.fssai_number}</span>
              </li>
            )}
            <li>
              <Link to="/terms" className="hover:text-primary">Terms & Conditions</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-foreground">Follow Us</p>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex gap-4">
              {settings.social_instagram && (
                <a href={settings.social_instagram} target="_blank" rel="noreferrer" className="hover:text-primary">
                  <Instagram className="size-5" />
                </a>
              )}
              {settings.social_facebook && (
                <a href={settings.social_facebook} target="_blank" rel="noreferrer" className="hover:text-primary">
                  <Facebook className="size-5" />
                </a>
              )}
              {settings.social_x && (
                <a href={settings.social_x} target="_blank" rel="noreferrer" className="hover:text-primary">
                  <Twitter className="size-5" />
                </a>
              )}
            </div>
            {settings.google_review_link && (
              <a href={settings.google_review_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Star className="size-4 text-yellow-500 fill-current" />
                Review us on Google
              </a>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {settings.store_name || "Fish N Fresh"}. All rights reserved.</p>
      </div>
    </footer>
  );
}
