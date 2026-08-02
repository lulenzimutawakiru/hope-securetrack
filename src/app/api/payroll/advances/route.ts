import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().max(1000).optional().nullable(),
  request_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "request_date must be YYYY-MM-DD")
    .optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/** Count-based advance number, mirroring the existing payroll nextPayCode pattern. */
function nextAdvanceNumber(count: number): string {
  const y = new Date().getFullYear();
  return `ADV-${y}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Request a payroll advance (money path).
 *
 * The employee must belong to the caller's company; company_id comes from the
 * session, never the body. Permissions follow the pay_advances RLS slugs.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.self", "payroll.approve", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-advances:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id")
      .eq("id", parsed.data.employee_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) return apiError("INTERNAL", empErr.message, 500);
    if (!emp) return apiError("NOT_FOUND", "Employee not found in this company", 404);

    const { count, error: countErr } = await admin
      .from("pay_advances")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if (countErr) return apiError("INTERNAL", countErr.message, 500);

    const { data: advance, error: advErr } = await admin
      .from("pay_advances")
      .insert({
        company_id: companyId,
        advance_number: nextAdvanceNumber(count ?? 0),
        employee_id: parsed.data.employee_id,
        amount: Math.round(parsed.data.amount * 100) / 100,
        reason: parsed.data.reason ?? null,
        status: "pending",
        request_date: parsed.data.request_date ?? new Date().toISOString().slice(0, 10),
        created_by: auth.ctx.user.id,
      })
      .select("*")
      .single();
    if (advErr || !advance) {
      return apiError("INTERNAL", advErr?.message ?? "Failed to create advance", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "payroll.advance_requested",
      module: "payroll",
      entity_type: "pay_advances",
      entity_id: advance.id,
      entity_reference: advance.advance_number,
      after_state: { employee_id: advance.employee_id, amount: advance.amount },
      metadata: { source: "api/payroll/advances" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ advance }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Advance request failed",
      500
    );
  }
}
