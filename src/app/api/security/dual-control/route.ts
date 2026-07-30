import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  approveDualControlRequest,
  createDualControlRequest,
  listPendingDualControl,
} from "@/lib/security/dual-control";
import { clientIp, rateLimit } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiAuth({
    permissions: ["security.dual_control", "security.admin", "iam.manage", "finance.approve", "payroll.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const rows = await listPendingDualControl(auth.ctx.companyId);
  return NextResponse.json({ ok: true, items: rows });
}

const createSchema = z.object({
  action: z.string().min(3).max(80),
  subject_type: z.string().optional(),
  subject_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});

const approveSchema = z.object({
  request_id: z.string().uuid(),
  approve: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`dual-control:${ip}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await requireApiAuth({
    permissions: ["security.dual_control", "security.admin", "iam.manage", "finance.approve", "payroll.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const op = String((body as { op?: string }).op || "create");

  try {
    if (op === "approve") {
      const parsed = approveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      }
      const row = await approveDualControlRequest({
        request_id: parsed.data.request_id,
        checker_id: auth.ctx.user.id,
        company_id: auth.ctx.companyId,
        approve: parsed.data.approve,
        notes: parsed.data.notes,
      });
      return NextResponse.json({ ok: true, request: row });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    const created = await createDualControlRequest({
      company_id: auth.ctx.companyId,
      action: parsed.data.action,
      maker_id: auth.ctx.user.id,
      subject_type: parsed.data.subject_type,
      subject_id: parsed.data.subject_id,
      payload: parsed.data.payload as Record<string, unknown> | undefined,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dual-control failed" },
      { status: 400 }
    );
  }
}
