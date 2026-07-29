import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAuditReport } from "@/lib/audit/reports";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      const { data: defs } = await supabase
        .from("eal_report_defs")
        .select("*")
        .order("name");
      return NextResponse.json({ reports: defs || [] });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return NextResponse.json({ error: "No company" }, { status: 400 });
    }

    const result = await runAuditReport({
      company_id: profile.company_id,
      report_code: code,
      period_start: req.nextUrl.searchParams.get("from") || undefined,
      period_end: req.nextUrl.searchParams.get("to") || undefined,
      run_by: profile.id,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
