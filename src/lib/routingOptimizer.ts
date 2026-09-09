/**
 * Automated Multi-Order Delivery Route Clustering & Sequencing Engine.
 *
 * Solves:
 * - Delivery drivers taking 2 to 8 packages on one motorcycle trip.
 * - Nearest Neighbor Traveling Salesperson (TSP) route sequencing from store hub.
 * - Generating multi-stop Google Maps navigation deep-links with waypoints.
 */

import type { OrderRow } from "@/lib/admin";
import { calculateDistanceKm, estimateBikeMinutes } from "@/lib/maps";

export interface DeliveryWaypoint {
  order: OrderRow;
  stepNumber: number;
  distanceFromPreviousKm: number;
  lat: number;
  lng: number;
}

export interface OptimizedTripRoute {
  waypoints: DeliveryWaypoint[];
  totalDistanceKm: number;
  totalEstimatedMinutes: number;
  googleMapsMultiStopUrl: string;
}

/**
 * Sequence an array of active delivery orders starting from the store coordinates.
 * Minimizes total round-trip travel distance and rider fuel consumption.
 */
export function optimizeMultiOrderRoute(
  storeLatInput: number | null,
  storeLngInput: number | null,
  orders: OrderRow[]
): OptimizedTripRoute {
  const storeLat = storeLatInput ?? 13.0827;
  const storeLng = storeLngInput ?? 80.2707;

  // Filter valid orders that have coordinates
  const validOrders = orders.filter(
    (o) => typeof o.location_lat === "number" && typeof o.location_lng === "number"
  );

  if (validOrders.length === 0) {
    return {
      waypoints: [],
      totalDistanceKm: 0,
      totalEstimatedMinutes: 0,
      googleMapsMultiStopUrl: `https://www.google.com/maps/search/?api=1&query=${storeLat},${storeLng}`,
    };
  }

  const unvisited = [...validOrders];
  const sequenced: DeliveryWaypoint[] = [];
  let currentLat = storeLat;
  let currentLng = storeLng;
  let totalKm = 0;
  let step = 1;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let shortestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const target = unvisited[i]!;
      const dist = calculateDistanceKm(
        currentLat,
        currentLng,
        target.location_lat!,
        target.location_lng!
      );
      if (dist < shortestDist) {
        shortestDist = dist;
        nearestIdx = i;
      }
    }

    const picked = unvisited.splice(nearestIdx, 1)[0]!;
    const pickedLat = picked.location_lat!;
    const pickedLng = picked.location_lng!;

    sequenced.push({
      order: picked,
      stepNumber: step++,
      distanceFromPreviousKm: shortestDist,
      lat: pickedLat,
      lng: pickedLng,
    });

    totalKm += shortestDist;
    currentLat = pickedLat;
    currentLng = pickedLng;
  }

  // Calculate turnaround minutes (5 min doorstep drop per order + travel time)
  const travelMins = estimateBikeMinutes(totalKm);
  const doorstepMins = sequenced.length * 5;
  const totalMins = travelMins + doorstepMins;

  // Build Google Maps Multi-Destination URL with waypoints
  const origin = `${storeLat},${storeLng}`;
  const lastStop = sequenced[sequenced.length - 1]!;
  const destination = `${lastStop.lat},${lastStop.lng}`;
  const midWaypoints = sequenced
    .slice(0, sequenced.length - 1)
    .map((w) => `${w.lat},${w.lng}`)
    .join("|");

  const waypointsParam = midWaypoints ? `&waypoints=${encodeURIComponent(midWaypoints)}` : "";
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=driving`;

  return {
    waypoints: sequenced,
    totalDistanceKm: Math.round(totalKm * 10) / 10,
    totalEstimatedMinutes: totalMins,
    googleMapsMultiStopUrl: googleMapsUrl,
  };
}
