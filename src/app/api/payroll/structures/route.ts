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
  structure_code: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  grade: z.string().max(50).optional().nullable(),
  basic_amount: z.number().nonnegative().optional().default(0),
  description: z.string().max(500).optional().nullable(),
});

const DEFAULT_LINES: Array<{
  component_code: string;
  amount: number;
  is_percentage: boolean;
  pct_of_basic: number | null;
  sort_order: number;
}> = [
  { component_code: "BASIC", amount: 0, is_percentage: false, pct_of_basic: null, sort_order: 1 },
  { component_code: "HOUSING", amount: 0, is_percentage: true, pct_of_basic: 15, sort_order: 2 },
  { component_code: "TRANSPORT", amount: 100000, is_percentage: false, pct_of_basic: null, sort_order: 3 },
];

/**
 * Create a salary structure with its default component lines.
 *
 * The structure and its lines are created server-side under the session
 * company; structure_code collisions return a validation error.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.admin", "payroll.costing"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-structures:${auth.ctx.user.id}:${ip}`,
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
  const basic = parsed.data.basic_amount;

  try {
    const { data: structure, error: structErr } = await admin
      .from("pay_salary_structures")
      .insert({
        company_id: companyId,
        structure_code: String(parsed.data.structure_code).toUpperCase(),
        name: parsed.data.name,
        grade: parsed.data.grade ?? null,
        basic_amount: basic,
        description: parsed.data.description ?? null,
        is_active: true,
      })
      .select("id, structure_code")
      .single();
    if (structErr) {
      return apiError(
        structErr.code === "23505" ? "VALIDATION" : "INTERNAL",
        structErr.code === "23505" ? "A structure with this code already exists" : structErr.message,
        structErr.code === "23505" ? 400 : 500
      );
    }

    const lines = DEFAULT_LINES.map((l) => ({
      company_id: companyId,
      structure_id: structure.id,
      component_code: l.component_code,
      amount: l.component_code === "BASIC" ? basic : l.amount,
      is_percentage: l.is_percentage,
      pct_of_basic: l.pct_of_basic,
      sort_order: l.sort_order,
    }));
    const { error: linesErr } = await admin
      .from("pay_structure_lines")
      .insert(lines);
    if (linesErr) {
      // roll back the structure so the UI never shows a half-created package
      await admin.from("pay_salary_structures").delete().eq("id", structure.id);
      return apiError("INTERNAL", linesErr.message, 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "payroll.structure_created",
      module: "payroll",
      entity_type: "pay_salary_structures",
      entity_id: structure.id,
      entity_reference: structure.structure_code ?? undefined,
      after_state: { name: parsed.data.name, basic_amount: basic, lines: lines.length },
      metadata: { source: "api/payroll/structures" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ structure, lines }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Structure creation failed",
      500
    );
  }
}
