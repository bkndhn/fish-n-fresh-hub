import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Clock,
  Compass,
  Maximize2,
  ExternalLink,
  Phone,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculateDistanceKm,
  estimateBikeMinutes,
  getGoogleMapsDirUrl,
  getAppleMapsDirUrl,
} from "@/lib/maps";

interface InlineDeliveryRouteMapProps {
  storeLat?: number | null | undefined;
  storeLng?: number | null | undefined;
  storeAddress?: string | null | undefined;
  destLat?: number | null | undefined;
  destLng?: number | null | undefined;
  destAddress?: string | null | undefined;
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  orderNumber?: string | null | undefined;
  etaMinutes?: number | null | undefined;
  driverName?: string | null | undefined;
  verticalEmoji?: string | null | undefined;
  onExpand?: (() => void) | undefined;
  className?: string | undefined;
}

const DEFAULT_STORE_LAT = 13.0827;
const DEFAULT_STORE_LNG = 80.2707;

export function InlineDeliveryRouteMap({
  storeLat,
  storeLng,
  storeAddress = "Store Location",
  destLat,
  destLng,
  destAddress,
  customerName,
  customerPhone,
  orderNumber,
  etaMinutes: propEta,
  driverName,
  verticalEmoji = "🐟",
  onExpand,
  className = "",
}: InlineDeliveryRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);

  const effectiveStoreLat = storeLat || DEFAULT_STORE_LAT;
  const effectiveStoreLng = storeLng || DEFAULT_STORE_LNG;
  const effectiveDestLat = destLat || effectiveStoreLat + 0.022;
  const effectiveDestLng = destLng || effectiveStoreLng + 0.018;

  const distanceKm = calculateDistanceKm(
    effectiveStoreLat,
    effectiveStoreLng,
    effectiveDestLat,
    effectiveDestLng
  );
  const calculatedEta = estimateBikeMinutes(distanceKm);
  const displayEta = propEta ?? calculatedEta;

  const googleMapsUrl = getGoogleMapsDirUrl(
    destLat,
    destLng,
    destAddress,
    effectiveStoreLat,
    effectiveStoreLng
  );
  const appleMapsUrl = getAppleMapsDirUrl(destLat, destLng, destAddress);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function initMap() {
      try {
        const L = (await import("leaflet")).default;

        if (!mapContainerRef.current || !isMounted) return;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: !L.Browser.mobile,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Store Origin Icon
        const storeIcon = L.divIcon({
          className: "custom-store-pin",
          html: `
            <div style="background-color: #0284c7; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 2.5px solid white;">
              <span style="font-size: 15px;">${verticalEmoji}</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        // Customer Destination Icon
        const customerIcon = L.divIcon({
          className: "custom-customer-pin",
          html: `
            <div style="background-color: #10b981; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 2.5px solid white;">
              <span style="font-size: 15px;">🏡</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        L.marker([effectiveStoreLat, effectiveStoreLng], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`<strong>${verticalEmoji} Store Origin</strong><br/>${storeAddress}`);

        L.marker([effectiveDestLat, effectiveDestLng], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<strong>🏡 Delivery Destination</strong><br/>${customerName || "Customer"}<br/>${destAddress || ""}`);

        // Route Polyline
        const routePoints: [number, number][] = [
          [effectiveStoreLat, effectiveStoreLng],
          [effectiveDestLat, effectiveDestLng],
        ];

        L.polyline(routePoints, {
          color: "#0284c7",
          weight: 4.5,
          opacity: 0.9,
          dashArray: "7, 9",
        }).addTo(map);

        const bounds = L.latLngBounds([
          [effectiveStoreLat, effectiveStoreLng],
          [effectiveDestLat, effectiveDestLng],
        ]);
        map.fitBounds(bounds, { padding: [40, 40] });

        leafletMapRef.current = map;

        setTimeout(() => {
          if (leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        }, 300);
      } catch (err) {
        console.error("Inline delivery map error:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [
    effectiveStoreLat,
    effectiveStoreLng,
    effectiveDestLat,
    effectiveDestLng,
    storeAddress,
    customerName,
    destAddress,
    verticalEmoji,
  ]);

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs ${className}`}
    >
      {/* Top Floating Overlay: ETA & Distance Badge */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-md px-3 py-1 text-xs font-extrabold text-foreground shadow-sm border border-border/60 pointer-events-auto">
          <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
          <Clock className="size-3.5 text-primary shrink-0" />
          <span>~{displayEta} mins</span>
          <span className="opacity-40">•</span>
          <span className="text-muted-foreground font-semibold">{distanceKm} km</span>
        </div>

        {onExpand && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full h-8 px-2.5 bg-background/90 backdrop-blur-md shadow-sm border-border/60 text-xs font-semibold hover:bg-background pointer-events-auto gap-1"
            onClick={onExpand}
            title="Expand Full Screen Map"
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline">Full Map</span>
          </Button>
        )}
      </div>

      {/* Map Container Canvas */}
      <div ref={mapContainerRef} className="h-56 sm:h-72 w-full bg-muted/40 z-10" />

      {/* Bottom Bar: Action Links */}
      <div className="p-3 bg-card border-t border-border/60 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Navigation className="size-3.5 text-primary" /> Live Route
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline truncate max-w-[200px]">
            {destAddress || "Pinned Customer Doorstep"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            className="h-8 rounded-xl text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
          >
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Compass className="size-3.5" />
              <span>Google Maps</span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </Button>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 rounded-xl text-xs font-semibold"
          >
            <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
              <span>Apple Maps</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
