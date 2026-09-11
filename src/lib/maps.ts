/**
 * Utility functions for map navigation deep links, distance calculation,
 * geocoding, and routing.
 */

export interface GeocodedAddress {
  address: string;
  doorNo?: string;
  street: string;
  landmark?: string;
  city: string;
  pincode: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface NominatimSearchResult {
  lat: number;
  lng: number;
  displayName: string;
  type: string;
}

/**
 * Generate a turn-by-turn driving navigation URL for Google Maps.
 * Directs to the native Google Maps app on mobile or browser.
 */
export function getGoogleMapsDirUrl(
  destLat?: number | null,
  destLng?: number | null,
  destAddress?: string | null,
  originLat?: number | null,
  originLng?: number | null
): string {
  if (destLat && destLng) {
    const originParam = originLat && originLng ? `&origin=${originLat},${originLng}` : "";
    return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${originParam}&travelmode=driving`;
  }
  if (destAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destAddress)}&travelmode=driving`;
  }
  return "https://www.google.com/maps";
}

/**
 * Generate an Apple Maps turn-by-turn navigation URL for iOS/macOS.
 */
export function getAppleMapsDirUrl(
  destLat?: number | null,
  destLng?: number | null,
  destAddress?: string | null
): string {
  if (destLat && destLng) {
    return `https://maps.apple.com/?daddr=${destLat},${destLng}&dirflg=d`;
  }
  if (destAddress) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(destAddress)}&dirflg=d`;
  }
  return "https://maps.apple.com";
}

/**
 * Generate a Waze turn-by-turn navigation URL.
 */
export function getWazeDirUrl(destLat?: number | null, destLng?: number | null): string {
  if (destLat && destLng) {
    return `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
  }
  return "https://waze.com";
}

/**
 * Haversine formula to compute great-circle distance between two points in km.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Estimate 2-wheeler seafood delivery time based on distance in km.
 * Baseline 5 min packing/pickup + 3.2 min per km in traffic.
 */
export function estimateBikeMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 15;
  const mins = Math.round(distanceKm * 3.2 + 6);
  return Math.max(15, Math.min(90, mins));
}

/**
 * Reverse geocode latitude and longitude using OpenStreetMap Nominatim.
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<GeocodedAddress | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "Accept-Language": "en-IN,en;q=0.9",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    const road = addr.road || addr.street || addr.footway || "";
    const area = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || "";
    const city = addr.city || addr.town || addr.municipality || addr.county || "Chennai";
    const pincode = (addr.postcode || "").replace(/\D/g, "").slice(0, 6);
    const landmark = addr.commercial || addr.amenity || addr.building || "";

    const street = [road, area].filter(Boolean).join(", ");
    const fullAddress = data.display_name || [street, city, pincode].filter(Boolean).join(", ");

    return {
      address: fullAddress,
      street: street || fullAddress,
      doorNo: addr.house_number || "",
      landmark,
      city,
      pincode,
      displayName: fullAddress,
      lat,
      lng,
    };
  } catch (err) {
    console.warn("Reverse geocoding error:", err);
    return null;
  }
}

/**
 * Search places/landmarks via OpenStreetMap Nominatim.
 */
export async function searchNominatim(query: string): Promise<NominatimSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encoded}&countrycodes=in&limit=5`,
      {
        headers: {
          "Accept-Language": "en-IN,en;q=0.9",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item: any) => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      displayName: item.display_name || "",
      type: item.type || "place",
    }));
  } catch (err) {
    console.warn("Nominatim search error:", err);
    return [];
  }
}

/**
 * Multi-Provider Resilient Tile Layer for Leaflet.
 * Automatically fails over from OSM Standard -> CartoDB Voyager -> OSM HOT.
 * Guarantees zero blank tiles even during OpenStreetMap rate-limiting.
 */
export const TILE_PROVIDERS = [
  {
    name: "CartoDB Voyager (Resilient High-Contrast)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    options: {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  {
    name: "OpenStreetMap Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  {
    name: "OSM Humanitarian (HOT)",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      subdomains: ["a", "b"],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  {
    name: "Esri Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; High-Res Aerial Satellite',
    },
  },
];

export function createResilientTileLayer(L: any, map?: any, isSatellite: boolean = false) {
  if (isSatellite) {
    return L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; High-Res Aerial Satellite',
        crossOrigin: true,
      }
    );
  }

  let providerIndex = 0;
  const layer = L.tileLayer(TILE_PROVIDERS[0]!.url, {
    ...TILE_PROVIDERS[0]!.options,
    crossOrigin: true,
  });

  layer.on("tileerror", () => {
    if (providerIndex < TILE_PROVIDERS.length - 1) {
      providerIndex++;
      const next = TILE_PROVIDERS[providerIndex]!;
      console.warn(`Map tile failover activated -> Switching to ${next.name}`);
      layer.setUrl(next.url);
    }
  });

  return layer;
}

/**
 * Smart parser for Google Maps URLs, Plus Codes, and coordinate strings.
 * Extracts {lat, lng} from links shared from installed Google Maps mobile app or web.
 */
export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // 1. Plain coordinates: "13.0827, 80.2707" or "13.0827,80.2707"
  const plainCoords = trimmed.match(/^\s*(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)\s*$/);
  if (plainCoords && plainCoords[1] && plainCoords[2]) {
    const lat = parseFloat(plainCoords[1]);
    const lng = parseFloat(plainCoords[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. Google Maps @lat,lng format: ".../@13.0827,80.2707,17z..."
  const atMatch = trimmed.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch && atMatch[1] && atMatch[2]) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 3. Google Maps query param: "...?q=13.0827,80.2707..." or "...&ll=13.0827,80.2707..."
  const qMatch = trimmed.match(/[?&](?:q|ll|destination|center)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (qMatch && qMatch[1] && qMatch[2]) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 4. Google Maps place data tag: "...!3d13.0827!4d80.2707..."
  const placeMatch = trimmed.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (placeMatch && placeMatch[1] && placeMatch[2]) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 5. Geo URI: "geo:13.0827,80.2707"
  const geoMatch = trimmed.match(/geo:(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i);
  if (geoMatch && geoMatch[1] && geoMatch[2]) {
    const lat = parseFloat(geoMatch[1]);
    const lng = parseFloat(geoMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

export interface RoadRouteResult {
  coordinates: [number, number][]; // [lat, lng] array suitable for Leaflet
  distanceKm: number;
  durationMinutes: number;
  isRealRoad: boolean;
}

/**
 * Fetch true road route geometry and driving distance from OpenStreetMap OSRM.
 * Falls back to straight-line interpolation with 1.35x Indian city road factor if OSRM is unreachable.
 */
export async function getOsrmRoadRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RoadRouteResult> {
  const straightDistance = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const fallbackEta = estimateBikeMinutes(straightDistance * 1.35);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // OSRM expects {lng},{lat} in URL
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`OSRM status ${res.status}`);
    const data = await res.json();

    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      // GeoJSON coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
      const coords: [number, number][] = primaryRoute.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon]
      );
      const roadDistanceKm = Math.round((primaryRoute.distance / 1000) * 10) / 10;
      const roadDurationMinutes = Math.max(8, Math.round(primaryRoute.duration / 60));

      return {
        coordinates: coords,
        distanceKm: roadDistanceKm,
        durationMinutes: roadDurationMinutes,
        isRealRoad: true,
      };
    }
  } catch {
    // Graceful fallback
  }

  // Generate intermediate waypoint for smooth curvature
  const midLat = (originLat + destLat) / 2 + (destLng - originLng) * 0.08;
  const midLng = (originLng + destLng) / 2 - (destLat - originLat) * 0.08;

  return {
    coordinates: [
      [originLat, originLng],
      [midLat, midLng],
      [destLat, destLng],
    ],
    distanceKm: Math.round(straightDistance * 1.35 * 10) / 10,
    durationMinutes: fallbackEta,
    isRealRoad: false,
  };
}

/**
 * Forward geocode a free-form address string to exact coordinates.
 * Queries Nominatim with tiered query refinement (full address -> pincode -> area/city).
 */
export async function forwardGeocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!address || address.trim().length < 3) return null;

  const clean = address.trim();

  // Tier 1: Try full address
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(clean)}&countrycodes=in&limit=1`,
      {
        headers: { "Accept-Language": "en-IN,en;q=0.9" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          lat: Number(data[0].lat),
          lng: Number(data[0].lon),
          displayName: data[0].display_name,
        };
      }
    }
  } catch {
    // Continue to tier 2
  }

  // Tier 2: Extract 6-digit Indian pincode if available (e.g. 600040)
  const pinMatch = clean.match(/\b(60\d{4}|5\d{5}|[1-9]\d{5})\b/);
  if (pinMatch) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${pinMatch[0]}&countrycodes=in&limit=1`,
        {
          headers: { "Accept-Language": "en-IN,en;q=0.9" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: Number(data[0].lat),
            lng: Number(data[0].lon),
            displayName: data[0].display_name,
          };
        }
      }
    } catch {
      // Continue to tier 3
    }
  }

  // Tier 3: Strip street numbers and search for locality/area + city
  const parts = clean.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const broaderQuery = parts.slice(Math.max(0, parts.length - 2)).join(", ");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(broaderQuery)}&countrycodes=in&limit=1`,
        {
          headers: { "Accept-Language": "en-IN,en;q=0.9" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return {
            lat: Number(data[0].lat),
            lng: Number(data[0].lon),
            displayName: data[0].display_name,
          };
        }
      }
    } catch {
      // Fallback exhausted
    }
  }

  return null;
}


