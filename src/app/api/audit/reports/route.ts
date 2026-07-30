import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAuditReport } from "@/lib/audit/reports";
import { requireApiAuth } from "@/lib/security/api-auth";
import { sanitizePostgrestFilter } from "@/lib/security/shared";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiAuth({
      permissions: ["eal.view", "audit.view", "eal.export", "reports.view"],
      allowPlatformAdmin: true,
    });
    if ("response" in auth) return auth.response;

    const supabase = await createClient();
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      const { data: defs } = await supabase
        .from("eal_report_defs")
        .select("*")
        .order("name");
      return NextResponse.json({ reports: defs || [] });
    }

    const safeCode = sanitizePostgrestFilter(code, 60);
    if (!safeCode) {
      return NextResponse.json({ error: "Invalid report code" }, { status: 400 });
    }

    const result = await runAuditReport({
      company_id: auth.ctx.companyId,
      report_code: safeCode,
      period_start: req.nextUrl.searchParams.get("from") || undefined,
      period_end: req.nextUrl.searchParams.get("to") || undefined,
      run_by: auth.ctx.profile.id,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
