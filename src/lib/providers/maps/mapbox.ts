/**
 * Mapbox Geocoding + Directions for fleet/dispatch.
 */

import { providersConfig } from "../config";
import { providerFetch } from "../http";
import type {
  MapDirectionsInput,
  MapGeocodeInput,
  ProviderCallResult,
} from "../types";

export async function mapboxGeocode(
  input: MapGeocodeInput
): Promise<
  ProviderCallResult<{
    features: Array<{
      place_name: string;
      center: [number, number];
      relevance?: number;
    }>;
  }>
> {
  const cfg = providersConfig.mapbox;
  if (!cfg.configured) {
    // Deterministic sandbox coordinates (Kampala CBD)
    return {
      ok: true,
      provider: "mapbox",
      sandbox: true,
      data: {
        features: [
          {
            place_name: `${input.query} (sandbox Kampala)`,
            center: [32.5825, 0.3476],
            relevance: 1,
          },
        ],
      },
    };
  }

  try {
    const params = new URLSearchParams({
      access_token: cfg.accessToken,
      limit: String(input.limit || 5),
      autocomplete: "true",
    });
    if (input.country) params.set("country", input.country);

    const q = encodeURIComponent(input.query);
    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/geocoding/v5/mapbox.places/${q}.json?${params}`
    );
    const body = json as {
      features?: Array<{
        place_name?: string;
        center?: [number, number];
        relevance?: number;
      }>;
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        provider: "mapbox",
        status: res.status,
        error: body.message || text.slice(0, 200),
      };
    }

    return {
      ok: true,
      provider: "mapbox",
      status: res.status,
      data: {
        features: (body.features || []).map((f) => ({
          place_name: f.place_name || "",
          center: f.center || [0, 0],
          relevance: f.relevance,
        })),
      },
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "mapbox",
      error: e instanceof Error ? e.message : "Geocode failed",
    };
  }
}

export async function mapboxDirections(
  input: MapDirectionsInput
): Promise<
  ProviderCallResult<{
    distance_m?: number;
    duration_s?: number;
    geometry?: unknown;
  }>
> {
  const cfg = providersConfig.mapbox;
  const profile = input.profile || "driving";
  const coords = [
    input.origin,
    ...(input.waypoints || []),
    input.destination,
  ]
    .map((c) => `${c[0]},${c[1]}`)
    .join(";");

  if (!cfg.configured) {
    // Haversine approx sandbox
    const [lng1, lat1] = input.origin;
    const [lng2, lat2] = input.destination;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const distance_m = 2 * R * Math.asin(Math.sqrt(a));
    return {
      ok: true,
      provider: "mapbox",
      sandbox: true,
      data: {
        distance_m: Math.round(distance_m),
        duration_s: Math.round(distance_m / 11.1), // ~40 km/h
      },
    };
  }

  try {
    const params = new URLSearchParams({
      access_token: cfg.accessToken,
      geometries: "geojson",
      overview: "simplified",
    });
    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/directions/v5/mapbox/${profile}/${coords}?${params}`
    );
    const body = json as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: unknown;
      }>;
      message?: string;
      code?: string;
    };

    if (!res.ok || !body.routes?.[0]) {
      return {
        ok: false,
        provider: "mapbox",
        status: res.status,
        error: body.message || body.code || text.slice(0, 200),
        raw: json,
      };
    }

    const route = body.routes[0];
    return {
      ok: true,
      provider: "mapbox",
      status: res.status,
      data: {
        distance_m: route.distance,
        duration_s: route.duration,
        geometry: route.geometry,
      },
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "mapbox",
      error: e instanceof Error ? e.message : "Directions failed",
    };
  }
}
