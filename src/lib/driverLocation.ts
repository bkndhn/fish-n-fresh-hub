/**
 * Driver PWA Background Geolocation & Screen WakeLock Engine.
 *
 * Solves:
 * - Phone screen turning black on bike handlebar mount (HTML5 Screen Wake Lock API)
 * - Mobile browser putting background PWA to sleep when driver switches to WhatsApp/Maps (Audio Keep-Alive Beacon)
 * - GPS signal loss in basements/elevators (Last-Known GPS Cache with freshness indicator)
 */

export interface DriverGeoCoordinate {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isCached?: boolean;
}

let activeWakeLock: any = null;
let activeWatchId: number | null = null;
let lastKnownLocation: DriverGeoCoordinate | null = null;
let keepAliveAudioCtx: any = null;
let isAudioBeaconActive = false;

const CACHE_KEY = "fnf_driver_last_gps";

/**
 * Acquire HTML5 Screen Wake Lock to keep the delivery partner's phone screen
 * permanently awake while on active delivery runs.
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    console.warn("Screen WakeLock API not supported on this browser.");
    return false;
  }

  try {
    if (!activeWakeLock) {
      activeWakeLock = await (navigator as any).wakeLock.request("screen");
      activeWakeLock.addEventListener("release", () => {
        activeWakeLock = null;
      });

      // Automatically re-acquire wake lock if driver switches back to app
      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && !activeWakeLock) {
          try {
            activeWakeLock = await (navigator as any).wakeLock.request("screen");
          } catch {
            // Ignored
          }
        }
      });
    }
    return true;
  } catch (err) {
    console.warn("Failed to acquire Screen Wake Lock:", err);
    return false;
  }
}

/**
 * Release Screen Wake Lock when delivery partner ends shift or has 0 active runs.
 */
export async function releaseScreenWakeLock(): Promise<void> {
  if (activeWakeLock) {
    try {
      await activeWakeLock.release();
    } catch {
      // Ignored
    }
    activeWakeLock = null;
  }
}

/**
 * Start an inaudible periodic audio beacon.
 * Keeps mobile browser Web Worker & JavaScript threads alive even when the driver
 * minimizes the browser to check WhatsApp navigation.
 */
export function startKeepAliveAudioBeacon(): void {
  if (isAudioBeaconActive || typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    keepAliveAudioCtx = new AudioCtx();
    // Inaudible 10Hz oscillator at volume 0.0001
    const osc = keepAliveAudioCtx.createOscillator();
    const gain = keepAliveAudioCtx.createGain();
    osc.frequency.setValueAtTime(10, keepAliveAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.0001, keepAliveAudioCtx.currentTime);
    osc.connect(gain);
    gain.connect(keepAliveAudioCtx.destination);
    osc.start();

    isAudioBeaconActive = true;
  } catch (err) {
    console.warn("Audio keep-alive beacon failed:", err);
  }
}

/**
 * Stop keep-alive audio beacon.
 */
export function stopKeepAliveAudioBeacon(): void {
  if (keepAliveAudioCtx) {
    try {
      keepAliveAudioCtx.close();
    } catch {
      // Ignored
    }
    keepAliveAudioCtx = null;
    isAudioBeaconActive = false;
  }
}

/**
 * Start continuous high-accuracy geolocation watcher.
 */
export function startDriverLocationWatcher(
  onLocationUpdate: (coord: DriverGeoCoordinate) => void,
  onError?: (err: GeolocationPositionError) => void
): () => void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    console.warn("Geolocation API not available.");
    return () => {};
  }

  // Restore cached location if available
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      lastKnownLocation = JSON.parse(cached);
      if (lastKnownLocation) {
        onLocationUpdate({ ...lastKnownLocation, isCached: true });
      }
    }
  } catch {
    // Ignored
  }

  const successHandler = (position: GeolocationPosition) => {
    const coord: DriverGeoCoordinate = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: Math.round(position.coords.accuracy),
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
      isCached: false,
    };

    lastKnownLocation = coord;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(coord));
    } catch {
      // Ignored
    }

    onLocationUpdate(coord);
  };

  const errorHandler = (err: GeolocationPositionError) => {
    console.warn("Driver geolocation watch warning:", err.message);
    // If signal lost, dispatch last known location with cached flag
    if (lastKnownLocation) {
      onLocationUpdate({ ...lastKnownLocation, isCached: true });
    }
    if (onError) onError(err);
  };

  activeWatchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  });

  return () => {
    if (activeWatchId !== null) {
      navigator.geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }
  };
}

/**
 * Get last known cached GPS location.
 */
export function getLastKnownDriverLocation(): DriverGeoCoordinate | null {
  if (lastKnownLocation) return lastKnownLocation;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
