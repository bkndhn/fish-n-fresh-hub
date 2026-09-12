import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Clock,
  Compass,
  Maximize2,
  ExternalLink,
  Phone,
  Navigation,
  Layers,
  RotateCcw,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculateDistanceKm,
  estimateBikeMinutes,
  getGoogleMapsDirUrl,
  getAppleMapsDirUrl,
  createResilientTileLayer,
  getOsrmRoadRoute,
  forwardGeocodeAddress,
  type RoadRouteResult,
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
  const leafletModuleRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);

  const [mapError, setMapError] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  const effectiveStoreLat = storeLat || DEFAULT_STORE_LAT;
  const effectiveStoreLng = storeLng || DEFAULT_STORE_LNG;

  // Resolved destination coordinates (either provided or geocoded)
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (destLat && destLng) return { lat: destLat, lng: destLng };
    return null;
  });

  // Road route result from OSRM
  const [roadRoute, setRoadRoute] = useState<RoadRouteResult | null>(null);

  const toggleSatellite = () => {
    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (leafletMapRef.current && leafletModuleRef.current) {
      const L = leafletModuleRef.current;
      const map = leafletMapRef.current;
      if (currentTileLayerRef.current) {
        map.removeLayer(currentTileLayerRef.current);
      }
      const layer = createResilientTileLayer(L, map, nextMode).addTo(map);
      currentTileLayerRef.current = layer;
    }
  };

  // Resolve coordinates if missing but address is present
  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      if (destLat && destLng) {
        setResolvedCoords({ lat: destLat, lng: destLng });
        return;
      }

      if (destAddress && destAddress.trim().length >= 3) {
        const geo = await forwardGeocodeAddress(destAddress);
        if (!cancelled && geo) {
          setResolvedCoords({ lat: geo.lat, lng: geo.lng });
          return;
        }
      }

      if (!cancelled) {
        setResolvedCoords({
          lat: effectiveStoreLat + 0.022,
          lng: effectiveStoreLng + 0.018,
        });
      }
    }

    resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [destLat, destLng, destAddress, effectiveStoreLat, effectiveStoreLng]);

  // Fetch true road route geometry
  useEffect(() => {
    if (!resolvedCoords) return;

    let cancelled = false;

    async function fetchRoute() {
      const res = await getOsrmRoadRoute(
        effectiveStoreLat,
        effectiveStoreLng,
        resolvedCoords!.lat,
        resolvedCoords!.lng
      );
      if (!cancelled) {
        setRoadRoute(res);
      }
    }

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [resolvedCoords, effectiveStoreLat, effectiveStoreLng]);

  const targetLat = resolvedCoords?.lat ?? (effectiveStoreLat + 0.022);
  const targetLng = resolvedCoords?.lng ?? (effectiveStoreLng + 0.018);

  const distanceKm = roadRoute?.distanceKm ?? calculateDistanceKm(
    effectiveStoreLat,
    effectiveStoreLng,
    targetLat,
    targetLng
  );
  const calculatedEta = roadRoute?.durationMinutes ?? estimateBikeMinutes(distanceKm);
  const displayEta = propEta ?? calculatedEta;

  const googleMapsUrl = getGoogleMapsDirUrl(
    targetLat,
    targetLng,
    destAddress,
    effectiveStoreLat,
    effectiveStoreLng
  );
  const appleMapsUrl = getAppleMapsDirUrl(targetLat, targetLng, destAddress);

  useEffect(() => {
    if (typeof window === "undefined" || !roadRoute) return;

    let isMounted = true;

    async function initMap() {
      try {
        const L = (await import("leaflet")).default;

        leafletModuleRef.current = L;

        if (!mapContainerRef.current || !isMounted || !roadRoute) return;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: !L.Browser.mobile,
        });

        currentTileLayerRef.current = createResilientTileLayer(L, map, isSatellite).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Store Origin Icon
        const storeIcon = L.divIcon({
          className: "custom-store-pin",
          html: `
            <div style="background-color: #0284c7; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(2,132,199,0.35); border: 2.5px solid white;">
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
            <div style="background-color: #10b981; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(16,185,129,0.35); border: 2.5px solid white;">
              <span style="font-size: 15px;">🏡</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        L.marker([effectiveStoreLat, effectiveStoreLng], { icon: storeIcon })
          .addTo(map)
          .bindPopup(`<strong>${verticalEmoji} Store Origin</strong><br/>${storeAddress}`);

        L.marker([targetLat, targetLng], { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<strong>🏡 Delivery Destination</strong><br/>${customerName || "Customer"}<br/>${destAddress || ""}`);

        // Route Polyline: dual-layer road route
        const coords = (roadRoute ? roadRoute.coordinates : [
          [effectiveStoreLat, effectiveStoreLng],
          [targetLat, targetLng],
        ]) as import("leaflet").LatLngExpression[];

        // Outer glow/casing
        L.polyline(coords, {
          color: "#38bdf8",
          weight: 6.5,
          opacity: 0.45,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        // Core driving line
        L.polyline(coords, {
          color: "#0284c7",
          weight: 4,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [40, 40] });

        leafletMapRef.current = map;

        setTimeout(() => {
          if (leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        }, 300);
      } catch (err) {
        console.error("Inline delivery map error:", err);
        setMapError(true);
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
    roadRoute,
    effectiveStoreLat,
    effectiveStoreLng,
    targetLat,
    targetLng,
    storeAddress,
    customerName,
    destAddress,
    verticalEmoji,
  ]);

  if (mapError) {
    return (
      <div
        className={`relative w-full max-w-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-muted/30 to-card p-4 sm:p-5 shadow-xs ${className}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3.5 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-4 animate-pulse" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Live Delivery Tracking</p>
              <p className="text-[11px] text-muted-foreground">Doorstep transit milestones active</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl h-7 px-2.5 text-[11px] gap-1"
              onClick={() => setMapError(false)}
            >
              <RotateCcw className="size-3" /> Retry Map
            </Button>
          </div>
        </div>

        {/* Milestone Steps Fallback */}
        <div className="grid grid-cols-3 gap-2 py-2 text-center">
          <div className="rounded-xl bg-muted/50 p-2.5 border border-border/40">
            <div className="text-base mb-1">{verticalEmoji}</div>
            <p className="text-[11px] font-bold text-foreground truncate">Hub</p>
            <p className="text-[9px] text-muted-foreground truncate">{storeAddress}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2.5 border border-primary/25">
            <div className="text-base mb-1">🛵</div>
            <p className="text-[11px] font-bold text-primary truncate">In Transit</p>
            <p className="text-[9px] font-semibold text-primary">~{displayEta} mins ({distanceKm} km)</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 border border-border/40">
            <div className="text-base mb-1">🏡</div>
            <p className="text-[11px] font-bold text-foreground truncate">Doorstep</p>
            <p className="text-[9px] text-muted-foreground truncate">{destAddress || "Customer"}</p>
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Navigation active via external GPS
          </p>
          <Button
            asChild
            size="sm"
            className="h-8 rounded-xl text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Compass className="size-3.5" /> Google Maps Navigation
            </a>
          </Button>
        </div>
      </div>
    );
  }

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
          {roadRoute?.isRealRoad && (
            <span className="hidden sm:inline text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-sm">
              Road
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`rounded-full h-8 px-2.5 bg-background/90 backdrop-blur-md shadow-sm border-border/60 text-xs font-semibold hover:bg-background gap-1 ${
              isSatellite ? "border-primary text-primary bg-primary/10" : ""
            }`}
            onClick={toggleSatellite}
            title={isSatellite ? "Switch to Streets Map" : "Switch to Satellite Imagery"}
          >
            <Layers className="size-3.5" />
            <span className="hidden sm:inline">{isSatellite ? "Streets" : "Satellite"}</span>
          </Button>

          {onExpand && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full h-8 px-2.5 bg-background/90 backdrop-blur-md shadow-sm border-border/60 text-xs font-semibold hover:bg-background gap-1"
              onClick={onExpand}
              title="Expand Full Screen Map"
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">Full Map</span>
            </Button>
          )}
        </div>
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
