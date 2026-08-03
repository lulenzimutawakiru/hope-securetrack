import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeScanInput } from "@/lib/verification";
import { ingressRateLimit } from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  qr: z.string().max(2000).optional(),
  code: z.string().max(2000).optional(),
  uuid: z.string().max(200).optional(),
  serial: z.string().max(200).optional(),
  source: z.string().max(40).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

/**
 * Public product verification proxy (enterprise rate-limited).
 */
export async function POST(request: Request) {
  try {
    const rl = await ingressRateLimit("verify", 60, 60_000, request);
    if (!rl.ok) {
      return NextResponse.json(
        {
          result: "invalid",
          message: "Too many verification attempts. Try again shortly.",
          safetyMessage: "Rate limit exceeded.",
        },
        {
          status: 429,
          headers: rl.response.headers,
        }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { result: "invalid", message: "Invalid JSON" },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { result: "invalid", message: "Invalid request body" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anon) {
      return NextResponse.json(
        {
          result: "invalid",
          message: "Verification service not configured",
        },
        { status: 503 }
      );
    }

    const body = parsed.data;
    const raw = body.qr ?? body.code ?? body.uuid ?? body.serial ?? "";
    const normalized =
      typeof raw === "string" ? normalizeScanInput(raw) : raw;

    if (!normalized) {
      return NextResponse.json(
        { result: "invalid", message: "QR data required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        qr: normalized,
        source: body.source || "web",
        latitude: body.latitude ?? undefined,
        longitude: body.longitude ?? undefined,
      }),
      signal:
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(12_000)
          : undefined,
    });

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      data = {
        result: "invalid",
        message: "Invalid response from verification service",
      };
    }

    if (!data.result && data.error) {
      data = {
        result: "invalid",
        message: String(data.error),
        safetyMessage: "Verification service error. Please try again.",
      };
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-RateLimit-Remaining": String(rl.remaining),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        result: "invalid",
        message:
          e instanceof Error
            ? e.message
            : "Verification service unavailable. Please try again.",
        safetyMessage: "Could not reach verification service.",
      },
      { status: 200 }
    );
  }
}
