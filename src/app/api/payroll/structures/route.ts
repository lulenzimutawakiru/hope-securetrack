import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
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
  {
    component_code: "BASIC",
    amount: 0,
    is_percentage: false,
    pct_of_basic: null,
    sort_order: 1,
  },
  {
    component_code: "HOUSING",
    amount: 0,
    is_percentage: true,
    pct_of_basic: 15,
    sort_order: 2,
  },
  {
    component_code: "TRANSPORT",
    amount: 100000,
    is_percentage: false,
    pct_of_basic: null,
    sort_order: 3,
  },
];

/** Create a salary structure with default component lines. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.admin", "payroll.costing"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const companyId = ctx.companyId;
    const basic = data.basic_amount;

    try {
      const { data: structure, error: structErr } = await admin
        .from("pay_salary_structures")
        .insert({
          company_id: companyId,
          structure_code: String(data.structure_code).toUpperCase(),
          name: data.name,
          grade: data.grade ?? null,
          basic_amount: basic,
          description: data.description ?? null,
          is_active: true,
        })
        .select("id, structure_code")
        .single();
      if (structErr) {
        return apiError(
          structErr.code === "23505" ? "VALIDATION" : "INTERNAL",
          structErr.code === "23505"
            ? "A structure with this code already exists"
            : structErr.message,
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
        await admin
          .from("pay_salary_structures")
          .delete()
          .eq("id", structure.id);
        return apiError("INTERNAL", linesErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "payroll.structure_created",
        module: "payroll",
        entity_type: "pay_salary_structures",
        entity_id: structure.id,
        entity_reference: structure.structure_code ?? undefined,
        after_state: {
          name: data.name,
          basic_amount: basic,
          lines: lines.length,
        },
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
);
