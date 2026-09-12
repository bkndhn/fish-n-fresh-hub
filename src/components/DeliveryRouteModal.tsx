import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  ExternalLink,
  Phone,
  MessageCircle,
  Copy,
  Store,
  Home,
  Clock,
  Check,
  Compass,
  Route as RouteIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  calculateDistanceKm,
  estimateBikeMinutes,
  getGoogleMapsDirUrl,
  getAppleMapsDirUrl,
  getWazeDirUrl,
  createResilientTileLayer,
  getOsrmRoadRoute,
  forwardGeocodeAddress,
  type RoadRouteResult,
} from "@/lib/maps";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface DeliveryRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null | undefined;
  orderNumber?: string | null | undefined;
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  customerAddress?: string | null | undefined;
  destLat?: number | null | undefined;
  destLng?: number | null | undefined;
  destinationLat?: number | null | undefined;
  destinationLng?: number | null | undefined;
  storeLat?: number | null | undefined;
  storeLng?: number | null | undefined;
  storeAddress?: string | null | undefined;
  driverName?: string | null | undefined;
  verticalEmoji?: string | null | undefined;
}

const DEFAULT_STORE_LAT = 13.0827;
const DEFAULT_STORE_LNG = 80.2707;

export function DeliveryRouteModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  customerAddress,
  destLat: propDestLat,
  destLng: propDestLng,
  destinationLat,
  destinationLng,
  storeLat = DEFAULT_STORE_LAT,
  storeLng = DEFAULT_STORE_LNG,
  storeAddress = "Fish N Fresh Seafood Hub",
  driverName,
  verticalEmoji = "🐟",
}: DeliveryRouteModalProps) {
  const initialDestLat = propDestLat ?? destinationLat ?? null;
  const initialDestLng = propDestLng ?? destinationLng ?? null;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);

  // Resolved destination coordinates (either provided or geocoded)
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialDestLat && initialDestLng) return { lat: initialDestLat, lng: initialDestLng };
    return null;
  });

  // Road route result from OSRM
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);
  const [isResolvingRoute, setIsResolvingRoute] = useState(false);

  const effectiveStoreLat = storeLat || DEFAULT_STORE_LAT;
  const effectiveStoreLng = storeLng || DEFAULT_STORE_LNG;

  // Resolve coordinates if missing but address is available
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function resolveDestination() {
      if (initialDestLat && initialDestLng) {
        setResolvedCoords({ lat: initialDestLat, lng: initialDestLng });
        return;
      }

      if (customerAddress && customerAddress.trim().length >= 3) {
        setIsResolvingRoute(true);
        const geo = await forwardGeocodeAddress(customerAddress);
        if (!cancelled && geo) {
          setResolvedCoords({ lat: geo.lat, lng: geo.lng });
          setIsResolvingRoute(false);
          return;
        }
      }

      // Safe city fallback
      if (!cancelled) {
        setResolvedCoords({
          lat: effectiveStoreLat + 0.025,
          lng: effectiveStoreLng + 0.02,
        });
        setIsResolvingRoute(false);
      }
    }

    resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [open, initialDestLat, initialDestLng, customerAddress, effectiveStoreLat, effectiveStoreLng]);

  // Fetch true road geometry when destination coordinates are ready
  useEffect(() => {
    if (!open || !resolvedCoords) return;

    let cancelled = false;

    async function fetchRoute() {
      setIsResolvingRoute(true);
      const res = await getOsrmRoadRoute(
        effectiveStoreLat,
        effectiveStoreLng,
        resolvedCoords!.lat,
        resolvedCoords!.lng
      );
      if (!cancelled) {
        setRoadRoute(res);
        setIsResolvingRoute(false);
      }
    }

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [open, resolvedCoords, effectiveStoreLat, effectiveStoreLng]);

  const targetLat = resolvedCoords?.lat ?? (effectiveStoreLat + 0.025);
  const targetLng = resolvedCoords?.lng ?? (effectiveStoreLng + 0.02);

  const distanceKm = roadRoute?.distanceKm ?? calculateDistanceKm(
    effectiveStoreLat,
    effectiveStoreLng,
    targetLat,
    targetLng
  );
  const etaMinutes = roadRoute?.durationMinutes ?? estimateBikeMinutes(distanceKm);

  const googleMapsUrl = getGoogleMapsDirUrl(
    targetLat,
    targetLng,
    customerAddress,
    effectiveStoreLat,
    effectiveStoreLng
  );
  const appleMapsUrl = getAppleMapsDirUrl(targetLat, targetLng, customerAddress);
  const wazeUrl = getWazeDirUrl(targetLat, targetLng);

  // Initialize Route Map with true road geometry
  useEffect(() => {
    if (!open || typeof window === "undefined" || !roadRoute) return;

    let isMounted = true;

    async function initRouteMap() {
      try {
        const L = (await import("leaflet")).default;

        if (!mapContainerRef.current || !isMounted || !roadRoute) return;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
        });

        createResilientTileLayer(L, map).addTo(map);
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Custom HTML DivIcon for Store Origin
        const storeIcon = L.divIcon({
          className: "custom-div-icon",
          html: `
            <div style="background-color: #0284c7; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(2,132,199,0.4); border: 2.5px solid white;">
              <span style="font-size: 16px;">${verticalEmoji || "🐟"}</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        // Custom HTML DivIcon for Customer Destination
        const customerIcon = L.divIcon({
          className: "custom-div-icon",
          html: `
            <div style="background-color: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16,185,129,0.4); border: 2.5px solid white;">
              <span style="font-size: 16px;">🏡</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        L.marker([effectiveStoreLat, effectiveStoreLng], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`<strong>${verticalEmoji || "🐟"} Store Hub</strong><br/>${storeAddress}`);

        L.marker([targetLat, targetLng], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<strong>🏡 Customer Doorstep</strong><br/>${customerName || "Customer"}<br/>${customerAddress || ""}`);

        // Polyline connecting store to customer: dual-layer road polyline
        const coords = (roadRoute ? roadRoute.coordinates : [
          [effectiveStoreLat, effectiveStoreLng],
          [targetLat, targetLng],
        ]) as import("leaflet").LatLngExpression[];

        // Outer glow/casing for contrast
        L.polyline(coords, {
          color: "#38bdf8",
          weight: 7,
          opacity: 0.45,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Core driving route polyline
        L.polyline(coords, {
          color: "#0284c7",
          weight: 4.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Fit map bounds to show complete turn-by-turn road route
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [50, 50] });

        leafletMapRef.current = map;

        setTimeout(() => {
          if (leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        }, 300);
      } catch (err) {
        console.error("Leaflet route error:", err);
      }
    }

    initRouteMap();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [
    open,
    roadRoute,
    effectiveStoreLat,
    effectiveStoreLng,
    targetLat,
    targetLng,
    storeAddress,
    customerName,
    customerAddress,
    verticalEmoji,
  ]);

  const handleCopyCoords = () => {
    if (targetLat && targetLng) {
      navigator.clipboard.writeText(`${targetLat}, ${targetLng}`);
      setCopied(true);
      toast.success("Coordinates copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const customerWaUrl = customerPhone
    ? getWhatsAppUrl(
        customerPhone,
        `Hello ${customerName || "Customer"}, this is Fish N Fresh delivery regarding your seafood order #${orderNumber || ""}. Our delivery partner is on the way!`
      )
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] h-[90vh] sm:h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border/70 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-border/60 bg-card z-20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <RouteIcon className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground leading-tight">
                  Delivery Route & Turn-by-Turn Navigation
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  Order #{orderNumber || "Delivery"} · {customerName || "Customer"}
                </p>
              </div>
            </div>

            {/* Distance & ETA Badge */}
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Clock className="size-3.5" />
              <span>{etaMinutes} mins</span>
              <span className="opacity-40">•</span>
              <span>{distanceKm} km</span>
              {roadRoute?.isRealRoad && (
                <span className="hidden sm:inline text-[10px] font-medium bg-emerald-500/20 px-1.5 py-0.5 rounded-sm">
                  Road
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Route Map */}
        <div className="relative flex-1 bg-muted/40 w-full overflow-hidden">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* Floating Origin & Destination Overlay */}
          <div className="absolute top-3 left-3 right-3 sm:right-auto z-30 max-w-sm space-y-1.5 pointer-events-none">
            <div className="rounded-2xl bg-background/95 backdrop-blur-md p-2.5 shadow-md border border-border/60 space-y-1.5 pointer-events-auto">
              <div className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-sky-500 shrink-0" />
                <span className="text-muted-foreground shrink-0 font-medium">From:</span>
                <span className="font-bold text-foreground truncate">{storeAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground shrink-0 font-medium">To:</span>
                <span className="font-bold text-foreground truncate">
                  {customerAddress || "Pinned Customer Doorstep"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="p-4 border-t border-border/60 bg-card z-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Turn-by-Turn Google Maps */}
              <Button asChild size="sm" className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Compass className="size-3.5" />
                  <span>Start Google Maps Nav</span>
                  <ExternalLink className="size-3 opacity-70" />
                </a>
              </Button>

              {/* Apple Maps */}
              <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs font-medium gap-1.5">
                <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <span>Apple Maps</span>
                </a>
              </Button>

              {/* Waze */}
              {targetLat && targetLng && (
                <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs font-medium gap-1.5">
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                    <span>Waze</span>
                  </a>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Call Customer */}
              {customerPhone && (
                <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5">
                  <a href={`tel:${customerPhone}`}>
                    <Phone className="size-3.5 text-emerald-500" />
                    <span>Call</span>
                  </a>
                </Button>
              )}

              {/* WhatsApp Customer */}
              {customerWaUrl && (
                <Button asChild size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <a href={customerWaUrl} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="size-3.5 text-[#25D366]" />
                    <span>WhatsApp</span>
                  </a>
                </Button>
              )}

              {/* Copy Coords */}
              {targetLat && targetLng && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyCoords}
                  title="Copy Lat, Lng"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
