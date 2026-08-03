import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { runAuditReport } from "@/lib/audit/reports";
import { sanitizePostgrestFilter } from "@/lib/security/shared";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["eal.view", "audit.view", "eal.export", "reports.view"],
    allowPlatformAdmin: true,
    module: "audit",
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      const { data: defs } = await supabase
        .from("eal_report_defs")
        .select("*")
        .order("name");
      return apiOk({ reports: defs || [] });
    }

    const safeCode = sanitizePostgrestFilter(code, 60);
    if (!safeCode) {
      return apiError("VALIDATION", "Invalid report code");
    }

    const result = await runAuditReport({
      company_id: ctx.companyId,
      report_code: safeCode,
      period_start: req.nextUrl.searchParams.get("from") || undefined,
      period_end: req.nextUrl.searchParams.get("to") || undefined,
      run_by: ctx.profile.id,
    });

    return apiOk(result);
  }
);
