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
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  reverseGeocodeNominatim,
  searchNominatim,
  createResilientTileLayer,
  parseGoogleMapsUrl,
  type GeocodedAddress,
  type NominatimSearchResult,
} from "@/lib/maps";
import { useCustomerBranch } from "@/lib/customerBranchContext";

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
const LAST_GPS_KEY = "fnf_user_last_gps";

function readCachedGps(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_GPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    return null;
  }
  return null;
}

function cacheGps(lat: number, lng: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_GPS_KEY, JSON.stringify({ lat, lng, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

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
  const { activeBranch } = useCustomerBranch();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletModuleRef = useRef<any>(null);
  const currentTileLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat ?? activeBranch?.lat ?? DEFAULT_LAT,
    lng: initialLng ?? activeBranch?.lng ?? DEFAULT_LNG,
  });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [linkInput, setLinkInput] = useState("");

  const [geocoded, setGeocoded] = useState<GeocodedAddress | null>(null);
  const [customDoorNo, setCustomDoorNo] = useState("");
  const [customPincode, setCustomPincode] = useState("");
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

  // Nudge / Micro-adjust pin by ~10 meters for pinpoint doorstep accuracy
  const handleNudgePin = (deltaLat: number, deltaLng: number) => {
    const nextLat = Math.round((currentCoords.lat + deltaLat) * 100000) / 100000;
    const nextLng = Math.round((currentCoords.lng + deltaLng) * 100000) / 100000;
    setCurrentCoords({ lat: nextLat, lng: nextLng });
    if (markerRef.current) {
      markerRef.current.setLatLng([nextLat, nextLng]);
    }
    if (leafletMapRef.current) {
      leafletMapRef.current.panTo([nextLat, nextLng]);
    }
    fetchAddressForCoords(nextLat, nextLng);
  };

  useEffect(() => {
    if (open) {
      if (initialLat && initialLng) {
        setCurrentCoords({ lat: initialLat, lng: initialLng });
        if (markerRef.current) {
          markerRef.current.setLatLng([initialLat, initialLng]);
        }
      } else if (!initialLat && !initialLng) {
        // Start from the last confirmed doorstep while GPS locks on
        const cached = readCachedGps();
        if (cached) {
          setCurrentCoords(cached);
          if (markerRef.current) markerRef.current.setLatLng([cached.lat, cached.lng]);
          if (leafletMapRef.current) leafletMapRef.current.setView([cached.lat, cached.lng], 17);
        }
        // Auto-GPS Acquisition if no initial location passed
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: lat, longitude: lng, accuracy } = pos.coords;
              setCurrentCoords({ lat, lng });
              setGpsAccuracy(accuracy);
              cacheGps(lat, lng);
              if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
              if (leafletMapRef.current) leafletMapRef.current.flyTo([lat, lng], 18);
              fetchAddressForCoords(lat, lng);
            },
            (err) => {
              console.warn("GPS Acquisition failed:", err);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        }
      }
      
      if (initialAddress) {
        const pinMatch = initialAddress.match(/\b\d{6}\b/);
        if (pinMatch && pinMatch[0]) {
          const pinVal = pinMatch[0];
          setCustomPincode((prev) => prev || pinVal);
        }
        const doorMatch = initialAddress.match(/(?:door|flat|no\.?|#)\s*([0-9A-Za-z\-\/]+)/i);
        if (doorMatch && doorMatch[1]) {
          const doorVal = doorMatch[1];
          setCustomDoorNo((prev) => prev || doorVal);
        }
      }
    }
  }, [open, initialAddress, initialLat, initialLng]);

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

  // Sync GPS Accuracy Circle
  useEffect(() => {
    if (!leafletMapRef.current || !leafletModuleRef.current) return;
    const map = leafletMapRef.current;
    const L = leafletModuleRef.current;

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    if (gpsAccuracy && gpsAccuracy > 50) {
      accuracyCircleRef.current = L.circle([currentCoords.lat, currentCoords.lng], {
        radius: gpsAccuracy,
        color: '#eab308',
        fillColor: '#fef08a',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map);
    }
  }, [gpsAccuracy, currentCoords.lat, currentCoords.lng]);

  // Parse Google Maps Link or Coordinates
  const handleParseGoogleMaps = () => {
    if (!googleMapsInput.trim()) return;
    const parsed = parseGoogleMapsUrl(googleMapsInput);
    if (parsed) {
      setCurrentCoords(parsed);
      if (markerRef.current) {
        markerRef.current.setLatLng([parsed.lat, parsed.lng]);
      }
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
          zoom: 17,
          zoomControl: false,
        });

        // Add resilient multi-provider tiles
        const layer = createResilientTileLayer(L, map, isSatellite).addTo(map);
        currentTileLayerRef.current = layer;

        // Add zoom control at bottom right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Create interactive draggable marker with vibrant doorstep badge
        const pinIcon = L.divIcon({
          className: "custom-map-doorstep-marker",
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; cursor:grab;">
              <div style="width:42px; height:42px; border-radius:50%; background:#16a34a; color:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 12px 28px rgba(0,0,0,0.38); border:3px solid #ffffff;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div style="width:3px; height:8px; background:#16a34a; margin-top:-2px;"></div>
              <div style="width:18px; height:6px; background:rgba(0,0,0,0.4); border-radius:50%; filter:blur(1px);"></div>
            </div>
          `,
          iconSize: [42, 56],
          iconAnchor: [21, 56],
        });

        const marker = L.marker([startLat, startLng], {
          draggable: true,
          icon: pinIcon,
          autoPan: true,
        }).addTo(map);
        markerRef.current = marker;

        // Drag marker to exact doorstep
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const lat = Math.round(pos.lat * 100000) / 100000;
          const lng = Math.round(pos.lng * 100000) / 100000;
          setCurrentCoords({ lat, lng });
          map.panTo([lat, lng]);
          fetchAddressForCoords(lat, lng);
        });

        // 1-Tap anywhere on map to instantly place pin
        map.on("click", (e: any) => {
          const lat = Math.round(e.latlng.lat * 100000) / 100000;
          const lng = Math.round(e.latlng.lng * 100000) / 100000;
          setCurrentCoords({ lat, lng });
          marker.setLatLng([lat, lng]);
          map.panTo([lat, lng]);
          fetchAddressForCoords(lat, lng);
        });

        // Keep coordinates synced on pan
        map.on("moveend", async () => {
          const center = map.getCenter();
          const lat = Math.round(center.lat * 100000) / 100000;
          const lng = Math.round(center.lng * 100000) / 100000;
          setCurrentCoords({ lat, lng });
          marker.setLatLng([lat, lng]);
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
      if (res.doorNo) setCustomDoorNo((prev) => prev || res.doorNo || "");
      if (res.pincode) setCustomPincode((prev) => prev || res.pincode || "");
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
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(accuracy);
        cacheGps(latitude, longitude);

        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([latitude, longitude], accuracy && accuracy > 100 ? 17 : 18, {
            duration: 1.2,
          });
        }
        fetchAddressForCoords(latitude, longitude);
        setIsLocating(false);
        toast.success(
          accuracy && accuracy > 50
            ? `Located within ~${Math.round(accuracy)} m — drag the pin to your exact gate.`
            : "Locked to your current GPS position!"
        );
      },
      () => {
        setIsLocating(false);
        toast.error("Unable to get GPS location. Please check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Search Address/Landmark
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setIsSearching(true);
    const results = await searchNominatim(searchQuery, activeBranch?.lat ?? undefined, activeBranch?.lng ?? undefined);
    setSearchResults(results);
    setShowSearchResults(true);
    setIsSearching(false);
  };

  const handleSelectSearchResult = (res: NominatimSearchResult) => {
    setShowSearchResults(false);
    setSearchQuery(res.displayName.slice(0, 45) + "…");
    setCurrentCoords({ lat: res.lat, lng: res.lng });

    if (markerRef.current) {
      markerRef.current.setLatLng([res.lat, res.lng]);
    }
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([res.lat, res.lng], 17, {
        duration: 1.2,
      });
    }
    fetchAddressForCoords(res.lat, res.lng);
  };

  const handleConfirm = () => {
    const door = customDoorNo.trim();
    const pin = customPincode.trim();
    const baseStreet = geocoded?.street || initialAddress || "Pinned Delivery Location";
    const baseCity = geocoded?.city || activeBranch?.name || "";

    const fullFormatted = [
      door ? `Door ${door}` : "",
      baseStreet,
      baseCity,
      pin ? `PIN: ${pin}` : "",
    ].filter(Boolean).join(", ");

    onConfirm({
      address: fullFormatted,
      street: baseStreet,
      doorNo: door,
      landmark: geocoded?.landmark || "",
      city: baseCity,
      pincode: pin,
      displayName: fullFormatted,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
    });
    onOpenChange(false);
    toast.success("Exact doorstep location confirmed!");
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

          {/* Quick Paste Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input 
                placeholder="📋 Paste Google Maps or WhatsApp location link" 
                value={googleMapsInput}
                onChange={(e) => setGoogleMapsInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleParseGoogleMaps()}
                className="pl-8.5 h-9 text-xs rounded-xl bg-muted/30"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl font-bold shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
              onClick={handleParseGoogleMaps}
            >
              Extract Pin
            </Button>
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

          {/* Floating Live Guidance Badge */}
          <div className="absolute top-3 left-3 z-30 pointer-events-none max-w-[60%] sm:max-w-none">
            {gpsAccuracy != null ? (
              gpsAccuracy <= 25 ? (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 backdrop-blur-md px-3 py-1 shadow-md border border-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>📍 High Precision GPS (±{Math.round(gpsAccuracy)}m)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 backdrop-blur-md px-3 py-1 shadow-md border border-amber-500/20 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>⚠️ Approximate GPS (±{Math.round(gpsAccuracy)}m) — Drag pin onto your gate</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur-md px-3 py-1 shadow-md border border-border/60 text-[11px] font-semibold text-foreground">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tap map or drag pin to gate</span>
              </div>
            )}
          </div>

          {/* Floating 4-way Nudge D-pad Controller for micro-adjustment (~10m) */}
          <div className="absolute bottom-4 left-4 z-30 bg-background/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-border/70 flex flex-col items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 rounded-xl hover:bg-muted"
              onClick={() => handleNudgePin(0.0001, 0)}
              title="Nudge North (~10m)"
            >
              <ChevronUp className="size-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-xl hover:bg-muted"
                onClick={() => handleNudgePin(0, -0.0001)}
                title="Nudge West (~10m)"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="size-5 rounded-md bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground select-none">
                10m
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 rounded-xl hover:bg-muted"
                onClick={() => handleNudgePin(0, 0.0001)}
                title="Nudge East (~10m)"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 rounded-xl hover:bg-muted"
              onClick={() => handleNudgePin(-0.0001, 0)}
              title="Nudge South (~10m)"
            >
              <ChevronDown className="size-4" />
            </Button>
          </div>

          {/* Recenter / Locate Button */}
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
        <div className="p-3 sm:p-4 border-t border-border/60 bg-card z-20 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Building className="size-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground">Selected Pin Location:</span>
                {isGeocoding && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-foreground font-medium line-clamp-2 leading-snug">
                {geocoded?.street || geocoded?.address || "Locating address…"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
              className="rounded-2xl h-11 px-5 text-xs font-bold shadow-md shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
              disabled={isGeocoding}
            >
              <Check className="size-4" />
              <span>{confirmLabel}</span>
            </Button>
          </div>

          {/* Editable Door No & Pincode for exact delivery accuracy */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Door / Flat / House No.
              </Label>
              <Input
                placeholder="e.g. 12/4B, Block A"
                value={customDoorNo}
                onChange={(e) => setCustomDoorNo(e.target.value)}
                className="h-7.5 text-xs rounded-lg mt-0.5 bg-muted/30"
              />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Delivery PIN Code
              </Label>
              <Input
                placeholder="e.g. 641601"
                maxLength={6}
                value={customPincode}
                onChange={(e) => setCustomPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-7.5 text-xs rounded-lg mt-0.5 bg-muted/30 font-mono"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
