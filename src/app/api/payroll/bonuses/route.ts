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
  employee_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(150),
  bonus_type: z
    .enum(["performance", "production", "sales", "department", "holiday", "other"])
    .default("performance"),
  amount: z.number().positive(),
  department: z.string().max(100).optional().nullable(),
  period_label: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function nextBonusNumber(count: number): string {
  const y = new Date().getFullYear();
  return `BN-${y}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Create a bonus / incentive (money path).
 *
 * The bonus number is generated server-side; company_id and created_by come
 * from the session, never the body. The employee (when given) must belong to
 * the caller's company.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-bonuses:${auth.ctx.user.id}:${ip}`,
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
    if (parsed.data.employee_id) {
      const { data: emp, error: empErr } = await admin
        .from("employees")
        .select("id")
        .eq("id", parsed.data.employee_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (empErr) return apiError("INTERNAL", empErr.message, 500);
      if (!emp) {
        return apiError("NOT_FOUND", "Employee not found in this company", 404);
      }
    }

    let bonus: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3 && !bonus; attempt++) {
      const { count, error: countErr } = await admin
        .from("pay_bonuses")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data, error } = await admin
        .from("pay_bonuses")
        .insert({
          company_id: companyId,
          bonus_number: nextBonusNumber(count ?? 0),
          employee_id: parsed.data.employee_id ?? null,
          department: parsed.data.department ?? null,
          bonus_type: parsed.data.bonus_type,
          name: parsed.data.name,
          amount: Math.round(parsed.data.amount * 100) / 100,
          period_label: parsed.data.period_label ?? null,
          status: "pending",
          notes: parsed.data.notes ?? null,
          created_by: auth.ctx.user.id,
        })
        .select("*")
        .single();
      if (!error && data) {
        bonus = data;
        break;
      }
      if (error && (error.code === "23505" || String(error.message).includes("duplicate"))) {
        continue; // bonus_number collision — retry with a fresh count
      }
      return apiError("INTERNAL", error?.message ?? "Failed to create bonus", 500);
    }
    if (!bonus) {
      return apiError("INTERNAL", "Failed to create bonus", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "payroll.bonus_created",
      module: "payroll",
      entity_type: "pay_bonuses",
      entity_id: bonus.id as string,
      entity_reference: bonus.bonus_number as string,
      after_state: {
        employee_id: bonus.employee_id,
        bonus_type: bonus.bonus_type,
        amount: bonus.amount,
      },
      metadata: { source: "api/payroll/bonuses" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ bonus }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Bonus creation failed",
      500
    );
  }
}
