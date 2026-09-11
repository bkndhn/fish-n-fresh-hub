import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Search,
  Check,
  Loader2,
  X,
  Crosshair,
  Building,
  Sparkles,
  Layers,
  Globe,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  reverseGeocodeNominatim,
  searchNominatim,
  createResilientTileLayer,
  parseGoogleMapsUrl,
  type GeocodedAddress,
  type NominatimSearchResult,
} from "@/lib/maps";

interface MapPinPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat?: number | null | undefined;
  initialLng?: number | null | undefined;
  initialAddress?: string | null | undefined;
  title?: string | undefined;
  confirmLabel?: string | undefined;
  onConfirm: (data: GeocodedAddress) => void;
}

// Default to Chennai Central coordinates if no initial coordinates are given
const DEFAULT_LAT = 13.0827;
const DEFAULT_LNG = 80.2707;

export function MapPinPickerModal({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  initialAddress,
  title = "Pin Exact Doorstep on Map",
  confirmLabel = "Confirm Pin",
  onConfirm,
}: MapPinPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || DEFAULT_LAT,
    lng: initialLng || DEFAULT_LNG,
  });

  const [geocoded, setGeocoded] = useState<GeocodedAddress | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);

  // Google Maps link parser state
  const [googleMapsInput, setGoogleMapsInput] = useState("");
  const [showGoogleMapsInput, setShowGoogleMapsInput] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Toggle Satellite and Street View
  const toggleSatelliteView = () => {
    if (!leafletMapRef.current || !leafletModuleRef.current) return;
    const L = leafletModuleRef.current;
    const map = leafletMapRef.current;
    const nextMode = !isSatellite;
    setIsSatellite(nextMode);

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }
    const newLayer = createResilientTileLayer(L, map, nextMode).addTo(map);
    currentTileLayerRef.current = newLayer;
  };

  // Parse Google Maps Link or Coordinates
  const handleParseGoogleMaps = () => {
    if (!googleMapsInput.trim()) return;
    const parsed = parseGoogleMapsUrl(googleMapsInput);
    if (parsed) {
      setCurrentCoords(parsed);
      if (leafletMapRef.current) {
        leafletMapRef.current.flyTo([parsed.lat, parsed.lng], 17, { duration: 1.2 });
      }
      fetchAddressForCoords(parsed.lat, parsed.lng);
      toast.success("Coordinates extracted from Google Maps!");
      setShowGoogleMapsInput(false);
      setGoogleMapsInput("");
    } else {
      toast.error("Could not parse coordinates. Please paste a link with @lat,lng, ?q=lat,lng, or coordinates like 13.0827, 80.2707");
    }
  };

  // Initialize Leaflet only in the browser
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    let isMounted = true;

    async function initLeaflet() {
      try {
        const L = (await import("leaflet")).default;
        leafletModuleRef.current = L;

        if (!mapContainerRef.current || !isMounted) return;

        // Clean up previous instance if any
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        }

        const startLat = initialLat || DEFAULT_LAT;
        const startLng = initialLng || DEFAULT_LNG;

        const map = L.map(mapContainerRef.current, {
          center: [startLat, startLng],
          zoom: 16,
          zoomControl: false,
        });

        // Add resilient multi-provider tiles
        const layer = createResilientTileLayer(L, map, isSatellite).addTo(map);
        currentTileLayerRef.current = layer;

        // Add zoom control at bottom right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Listen for map movement (center-pin style like Uber/Swiggy)
        map.on("moveend", async () => {
          const center = map.getCenter();
          const lat = Math.round(center.lat * 100000) / 100000;
          const lng = Math.round(center.lng * 100000) / 100000;
          setCurrentCoords({ lat, lng });
          fetchAddressForCoords(lat, lng);
        });

        leafletMapRef.current = map;
        setIsMapReady(true);

        // Initial geocode
        fetchAddressForCoords(startLat, startLng);

        // Invalidate size after modal transition completes
        setTimeout(() => {
          if (leafletMapRef.current) {
            leafletMapRef.current.invalidateSize();
          }
        }, 300);
      } catch (err) {
        console.error("Leaflet load error:", err);
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [open, initialLat, initialLng]);

  // Reverse geocode whenever coords change
  const fetchAddressForCoords = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    const res = await reverseGeocodeNominatim(lat, lng);
    if (res) {
      setGeocoded(res);
    }
    setIsGeocoding(false);
  };

  // GPS Locate User Button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([latitude, longitude], 17, {
            duration: 1.2,
          });
        }
        fetchAddressForCoords(latitude, longitude);
        setIsLocating(false);
        toast.success("Locked to your current GPS position!");
      },
      (err) => {
        setIsLocating(false);
        toast.error("Unable to get GPS location. Please check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Search Address/Landmark
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setIsSearching(true);
    const results = await searchNominatim(searchQuery);
    setSearchResults(results);
    setShowSearchResults(true);
    setIsSearching(false);
  };

  const handleSelectSearchResult = (res: NominatimSearchResult) => {
    setShowSearchResults(false);
    setSearchQuery(res.displayName.slice(0, 45) + "…");
    setCurrentCoords({ lat: res.lat, lng: res.lng });

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([res.lat, res.lng], 17, {
        duration: 1.2,
      });
    }
    fetchAddressForCoords(res.lat, res.lng);
  };

  const handleConfirm = () => {
    if (!geocoded) {
      // Fallback
      onConfirm({
        address: initialAddress || "Pinned Delivery Location",
        street: initialAddress || "Pinned Location",
        city: "Chennai",
        pincode: "",
        displayName: initialAddress || "Pinned Location",
        lat: currentCoords.lat,
        lng: currentCoords.lng,
      });
    } else {
      onConfirm(geocoded);
    }
    onOpenChange(false);
    toast.success("Exact doorstep location pinned!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] h-[90vh] sm:h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-border/70 shadow-2xl">
        {/* Header with Search */}
        <div className="p-4 border-b border-border/60 bg-card z-20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MapPin className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground leading-tight">
                  {title}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">
                  Pan the map to position the pin directly over your building gate or doorstep
                </p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search apartment, street, landmark or area…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.length >= 3) {
                      handleSearch();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  className="pl-8.5 pr-8 h-9 text-xs rounded-xl bg-muted/30"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant={showGoogleMapsInput ? "default" : "outline"}
                className="h-9 px-2.5 text-xs rounded-xl gap-1 shrink-0 font-medium"
                onClick={() => setShowGoogleMapsInput(!showGoogleMapsInput)}
                title="Paste location shared from Google Maps"
              >
                <LinkIcon className="size-3.5" />
                <span className="hidden sm:inline">Google Maps Link</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs rounded-xl gap-1 shrink-0 font-medium"
                onClick={handleLocateMe}
                disabled={isLocating}
              >
                {isLocating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Crosshair className="size-3.5 text-primary" />
                )}
                <span className="hidden sm:inline">Use GPS</span>
              </Button>
            </div>

            {/* Google Maps Link Paste Box */}
            {showGoogleMapsInput && (
              <div className="mt-2 flex items-center gap-1.5 p-2 rounded-xl bg-muted/50 border border-border animate-in fade-in duration-200">
                <Input
                  placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/... or 13.0827,80.2707)"
                  value={googleMapsInput}
                  onChange={(e) => setGoogleMapsInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleParseGoogleMaps()}
                  className="h-8 text-xs rounded-lg bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs rounded-lg shrink-0 font-bold"
                  onClick={handleParseGoogleMaps}
                >
                  Apply Pin
                </Button>
              </div>
            )}

            {/* Autocomplete Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-11 left-0 right-0 z-50 bg-popover/95 backdrop-blur-md rounded-2xl border border-border shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-border/40">
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectSearchResult(res)}
                    className="p-2.5 text-xs hover:bg-muted/60 cursor-pointer flex items-start gap-2 text-foreground transition-colors"
                  >
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{res.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Interactive Map Area */}
        <div className="relative flex-1 bg-muted/40 w-full overflow-hidden">
          {/* Leaflet container */}
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* Floating Controls: Satellite Switcher & Open in Google Maps */}
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7.5 rounded-full px-2.5 text-[11px] font-semibold bg-background/90 backdrop-blur-md shadow-md border border-border/60 gap-1 hover:bg-background"
              onClick={toggleSatelliteView}
            >
              <Layers className="size-3.5 text-primary" />
              <span>{isSatellite ? "Street Map" : "Satellite View"}</span>
            </Button>

            <Button
              asChild
              size="sm"
              variant="secondary"
              className="h-7.5 rounded-full px-2.5 text-[11px] font-semibold bg-background/90 backdrop-blur-md shadow-md border border-border/60 gap-1 hover:bg-background text-foreground"
            >
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${currentCoords.lat},${currentCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View in Google Maps App"
              >
                <Globe className="size-3.5 text-blue-600" />
                <span className="hidden sm:inline">Google Maps</span>
                <ExternalLink className="size-2.5 opacity-60 ml-0.5" />
              </a>
            </Button>
          </div>

          {/* Floating Center Pin Indicator (Uber/Swiggy Style) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-30 flex flex-col items-center">
            <div className="relative">
              {/* Pulsing Pin Head */}
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/20 border-2 border-white dark:border-slate-900 transition-transform duration-200">
                <MapPin className="size-6 drop-shadow-sm" />
              </div>
            </div>
            {/* Ground Shadow & Point */}
            <div className="w-1.5 h-3 bg-primary -mt-0.5" />
            <div className="w-4 h-1.5 bg-black/40 rounded-full blur-[1px]" />
          </div>

          {/* Floating Live Guidance Badge */}
          <div className="absolute top-3 left-3 z-30 pointer-events-none">
            <div className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-md px-3 py-1 shadow-md border border-border/60 text-[11px] font-semibold text-foreground">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Doorstep Delivery Target</span>
            </div>
          </div>

          {/* Recenter Button */}
          <div className="absolute bottom-4 right-4 z-30">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-10 rounded-2xl shadow-lg border border-border/80 bg-background/95 backdrop-blur-md hover:bg-muted"
              onClick={handleLocateMe}
              title="Locate my position"
            >
              {isLocating ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Navigation className="size-4 text-primary" />
              )}
            </Button>
          </div>
        </div>

        {/* Bottom Address Confirmation Panel */}
        <div className="p-4 border-t border-border/60 bg-card z-20 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Building className="size-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground">Selected Pin Location:</span>
                {isGeocoding && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">
                {geocoded?.street || geocoded?.address || "Locating address…"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {geocoded?.pincode && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    PIN: {geocoded.pincode}
                  </span>
                )}
                {geocoded?.city && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {geocoded.city}
                  </span>
                )}
                <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-mono font-medium">
                  {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              className="rounded-2xl h-11 px-5 text-xs font-bold shadow-md shrink-0 gap-1.5"
              onClick={handleConfirm}
              disabled={isGeocoding}
            >
              <Check className="size-4" />
              <span>{confirmLabel}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
