/**
 * Mapbox geocode / directions for fleet & dispatch UI.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { mapboxDirections, mapboxGeocode } from "@/lib/providers/maps/mapbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["geocode", "directions"]),
  query: z.string().max(300).optional(),
  country: z.string().max(10).optional(),
  origin: z.tuple([z.number(), z.number()]).optional(),
  destination: z.tuple([z.number(), z.number()]).optional(),
  waypoints: z.array(z.tuple([z.number(), z.number()])).max(20).optional(),
  profile: z
    .enum(["driving", "driving-traffic", "walking", "cycling"])
    .optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "fleet.track",
      "fleet.view",
      "dispatch.view",
      "intg.view",
      "intg.manage",
    ],
    module: "maps",
    bodySchema: schema,
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ body }) => {
    const input = body as z.infer<typeof schema>;
    if (input.action === "geocode") {
      if (!input.query?.trim()) {
        return apiError("VALIDATION", "query required", 400);
      }
      const r = await mapboxGeocode({
        query: input.query,
        country: input.country,
      });
      return r.ok
        ? apiOk(r)
        : apiError("INTERNAL", r.error || "geocode failed", 502);
    }

    if (!input.origin || !input.destination) {
      return apiError("VALIDATION", "origin and destination required", 400);
    }
    const r = await mapboxDirections({
      origin: input.origin,
      destination: input.destination,
      waypoints: input.waypoints,
      profile: input.profile,
    });
    return r.ok
      ? apiOk(r)
      : apiError("INTERNAL", r.error || "directions failed", 502);
  }
);
