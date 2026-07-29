"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveGpsPoint = {
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt: string;
};

export type UseLiveGpsOptions = {
  /** Watch continuously (for clock / live status) */
  watch?: boolean;
  /** High accuracy (default true) */
  enableHighAccuracy?: boolean;
  /** Auto-start on mount (default false) */
  auto?: boolean;
};

export function useLiveGps(options: UseLiveGpsOptions = {}) {
  const { watch = false, enableHighAccuracy = true, auto = false } = options;
  const [point, setPoint] = useState<LiveGpsPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    setPoint({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      capturedAt: new Date().toISOString(),
    });
    setError(null);
    setLoading(false);
  }, []);

  const applyError = useCallback((err: GeolocationPositionError | Error) => {
    const msg =
      "code" in err
        ? err.code === 1
          ? "Location permission denied — enable GPS for this site"
          : err.code === 2
            ? "Position unavailable — move outdoors or check GPS"
            : err.code === 3
              ? "GPS timeout — try again with clearer sky view"
              : err.message
        : err.message;
    setError(msg);
    setLoading(false);
  }, []);

  const capture = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device/browser");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(applyPosition, applyError, {
      enableHighAccuracy,
      timeout: 20000,
      maximumAge: 0,
    });
  }, [applyError, applyPosition, enableHighAccuracy]);

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device/browser");
      return;
    }
    stop();
    setLoading(true);
    watchId.current = navigator.geolocation.watchPosition(applyPosition, applyError, {
      enableHighAccuracy,
      timeout: 20000,
      maximumAge: 5000,
    });
  }, [applyError, applyPosition, enableHighAccuracy, stop]);

  useEffect(() => {
    if (auto) {
      if (watch) startWatch();
      else capture();
    }
    return () => stop();
  }, [auto, watch, capture, startWatch, stop]);

  return {
    point,
    error,
    loading,
    capture,
    startWatch,
    stop,
    supported: typeof navigator !== "undefined" && !!navigator.geolocation,
  };
}
