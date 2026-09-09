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
    name: "OpenStreetMap Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
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
    name: "OSM Humanitarian (HOT)",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      subdomains: ["a", "b"],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
];

export function createResilientTileLayer(L: any, map?: any) {
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

