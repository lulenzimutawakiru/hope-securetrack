/** Route optimization heuristics (AI-assisted planner) */

export interface StopInput {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  weight_kg?: number;
  priority?: string;
}

export interface OptimizedRoute {
  orderedStops: StopInput[];
  totalDistanceKm: number;
  estimatedMinutes: number;
  estimatedFuelL: number;
  score: number;
  strategy: string;
}

/** Haversine km between two points */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest-neighbor + priority bias for multi-stop */
export function optimizeRoute(
  stops: StopInput[],
  depot: { lat: number; lng: number } = { lat: 0.3476, lng: 32.5825 },
  opts?: { strategy?: "fastest" | "shortest" | "fuel" | "balanced" }
): OptimizedRoute {
  const strategy = opts?.strategy || "balanced";
  if (stops.length === 0) {
    return {
      orderedStops: [],
      totalDistanceKm: 0,
      estimatedMinutes: 0,
      estimatedFuelL: 0,
      score: 100,
      strategy,
    };
  }

  // Assign default coords around Kampala if missing
  const withCoords = stops.map((s, i) => ({
    ...s,
    lat: s.lat ?? depot.lat + (i + 1) * 0.008 * (i % 2 === 0 ? 1 : -1),
    lng: s.lng ?? depot.lng + (i + 1) * 0.01 * (i % 3 === 0 ? 1 : -0.5),
  }));

  // Priority first for balanced/fastest
  const pool = [...withCoords].sort((a, b) => {
    const pa = a.priority === "high" || a.priority === "express" ? 0 : 1;
    const pb = b.priority === "high" || b.priority === "express" ? 0 : 1;
    if (strategy !== "shortest" && pa !== pb) return pa - pb;
    return 0;
  });

  const ordered: typeof withCoords = [];
  let current = depot;
  const remaining = [...pool];

  while (remaining.length) {
    let bestIdx = 0;
    let bestScore = Infinity;
    remaining.forEach((s, i) => {
      const d = distanceKm(current, { lat: s.lat!, lng: s.lng! });
      let score = d;
      if (strategy === "fuel") score = d * 1.1;
      if (strategy === "fastest") score = d * (s.priority === "high" ? 0.7 : 1);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = { lat: next.lat!, lng: next.lng! };
  }

  let total = 0;
  let prev = depot;
  for (const s of ordered) {
    total += distanceKm(prev, { lat: s.lat!, lng: s.lng! });
    prev = { lat: s.lat!, lng: s.lng! };
  }
  // return to depot optional half-weight
  total += distanceKm(prev, depot) * 0.5;

  const minutes = Math.round(total * 2.8 + ordered.length * 12);
  const fuel = Math.round(total * 0.22 * 10) / 10;
  const score = Math.max(
    40,
    Math.min(99, Math.round(100 - total * 0.8 - (ordered.length > 8 ? 10 : 0)))
  );

  return {
    orderedStops: ordered,
    totalDistanceKm: Math.round(total * 10) / 10,
    estimatedMinutes: minutes,
    estimatedFuelL: fuel,
    score,
    strategy,
  };
}

export function estimateEta(
  distanceKmVal: number,
  avgSpeedKmh = 28
): Date {
  const hours = distanceKmVal / Math.max(1, avgSpeedKmh);
  return new Date(Date.now() + hours * 3600 * 1000);
}

export function recommendVehicleType(weightKg: number, volumeM3: number): string {
  if (weightKg <= 50 && volumeM3 <= 0.2) return "motorcycle";
  if (weightKg <= 1200 && volumeM3 <= 8) return "van";
  if (weightKg <= 5000) return "truck";
  return "truck";
}
