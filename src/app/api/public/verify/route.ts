import { NextResponse } from "next/server";
import { normalizeScanInput } from "@/lib/verification";
import { clientIp, rateLimit } from "@/lib/api";

/**
 * Public product verification proxy (enterprise rate-limited).
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`verify:${ip}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          result: "invalid",
          message: "Too many verification attempts. Try again shortly.",
          safetyMessage: "Rate limit exceeded.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec || 60) },
        }
      );
    }

    const body = await request.json();
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
        latitude: body.latitude,
        longitude: body.longitude,
      }),
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
