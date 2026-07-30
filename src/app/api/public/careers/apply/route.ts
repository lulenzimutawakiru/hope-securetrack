import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreCandidateMatch } from "@/lib/ta/service";

export const dynamic = "force-dynamic";

/**
 * Public careers application intake (service role).
 * Body: vacancy_code, first_name, last_name, email, phone?, skills?, years_experience?, cover_note?
 */
export async function POST(req: NextRequest) {
  try {
    const { clientIp, rateLimit } = await import("@/lib/api");
    const ip = clientIp(req);
    const rl = rateLimit(`careers-apply:${ip}`, 20, 60 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many applications from this network. Try later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const vacancyCode = String(body.vacancy_code || "").trim().slice(0, 80);
    const first = String(body.first_name || "").trim().slice(0, 100);
    const last = String(body.last_name || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().slice(0, 255).toLowerCase();
    if (!vacancyCode || !first || !last || !email) {
      return NextResponse.json(
        { error: "vacancy_code, first_name, last_name, email required" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const emailRl = rateLimit(`careers-email:${email}`, 5, 24 * 60 * 60_000);
    if (!emailRl.allowed) {
      return NextResponse.json(
        { error: "Too many applications from this email today" },
        { status: 429 }
      );
    }

    const sb = createAdminClient();
    const { data: vac, error: vErr } = await sb
      .from("ta_vacancies")
      .select("id,company_id,vacancy_code,title,requirements,status,publish_external")
      .eq("vacancy_code", vacancyCode)
      .eq("status", "open")
      .eq("publish_external", true)
      .maybeSingle();
    if (vErr || !vac) {
      return NextResponse.json({ error: "Vacancy not found or closed" }, { status: 404 });
    }

    const companyId = vac.company_id as string;
    const year = new Date().getFullYear();
    const candidateNumber = `CND-${year}-${Date.now().toString(36).toUpperCase()}`;
    const applicationNumber = `APP-${year}-${Date.now().toString(36).toUpperCase()}`;
    const years = Number(body.years_experience || 0);
    const skills = body.skills ? String(body.skills) : "";
    const match = scoreCandidateMatch({
      requirements: vac.requirements as string,
      candidateSkills: skills,
      yearsExperience: years,
    });

    const { data: cand, error: cErr } = await sb
      .from("ta_candidates")
      .insert({
        company_id: companyId,
        candidate_number: candidateNumber,
        first_name: first,
        last_name: last,
        email,
        phone: body.phone ? String(body.phone) : null,
        years_experience: years,
        skills: skills || null,
        source: "careers_portal",
        status: "active",
        consent_privacy: true,
      })
      .select("id,candidate_number")
      .single();
    if (cErr) throw cErr;

    const { error: aErr } = await sb.from("ta_applications").insert({
      company_id: companyId,
      application_number: applicationNumber,
      vacancy_code: vac.vacancy_code,
      vacancy_title: vac.title,
      candidate_id: cand.id,
      candidate_number: cand.candidate_number,
      candidate_name: `${first} ${last}`,
      email,
      phone: body.phone ? String(body.phone) : null,
      stage_code: "applied",
      stage_name: "Applied",
      match_score: match.score,
      ai_summary: match.summary,
      source: "careers_portal",
      status: "open",
      notes: body.cover_note ? String(body.cover_note) : null,
    });
    if (aErr) throw aErr;

    // Bump applications_count
    const { data: vacRow } = await sb
      .from("ta_vacancies")
      .select("applications_count")
      .eq("id", vac.id)
      .maybeSingle();
    await sb
      .from("ta_vacancies")
      .update({
        applications_count: Number(vacRow?.applications_count || 0) + 1,
      })
      .eq("id", vac.id);

    return NextResponse.json({
      ok: true,
      application_number: applicationNumber,
      candidate_number: candidateNumber,
      match_score: match.score,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Apply failed" },
      { status: 500 }
    );
  }
}
