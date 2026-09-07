import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from "lucide-react";
import { settingsQuery } from "@/lib/queries";
import { Link } from "@tanstack/react-router";

export function Footer() {
  const { data: settings } = useQuery(settingsQuery);

  if (!settings) return null;

  const mapLink = settings.shop_lat && settings.shop_lng 
    ? `https://www.google.com/maps/search/?api=1&query=${settings.shop_lat},${settings.shop_lng}`
    : null;

  return (
    <footer className="mt-12 border-t border-border bg-card pb-24 pt-12 text-sm text-muted-foreground md:pb-12">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:grid-cols-2 md:grid-cols-4">
        <div>
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Store Logo" className="h-10 w-auto object-contain" />
          ) : (
            <p className="font-display text-lg font-bold text-foreground">Fish N Fresh</p>
          )}
          <p className="mt-4">Fresh seafood and premium cuts delivered straight to your door.</p>
        </div>

        <div>
          <p className="font-semibold text-foreground">Support & Contact</p>
          <ul className="mt-4 space-y-2">
            {settings.support_phone && (
              <li>
                <a href={`tel:${settings.support_phone}`} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4" /> {settings.support_phone}
                </a>
              </li>
            )}
            {settings.support_email && (
              <li>
                <a href={`mailto:${settings.support_email}`} className="flex items-center gap-2 hover:text-primary">
                  <Mail className="size-4" /> {settings.support_email}
                </a>
              </li>
            )}
            {mapLink && (
              <li>
                <a href={mapLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
                  <MapPin className="size-4" /> Store Location
                </a>
              </li>
            )}
          </ul>
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
          <div className="mt-4 flex gap-4">
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
        </div>
      </div>
    </footer>
  );
}
