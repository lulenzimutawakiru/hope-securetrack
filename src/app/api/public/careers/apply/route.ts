import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreCandidateMatch } from "@/lib/ta/service";
import { ingressRateLimit } from "@/lib/security/public-ingress";
import { rateLimitStrict } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  vacancy_code: z.string().min(1).max(80),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(40).optional().nullable(),
  skills: z.string().max(4000).optional().nullable(),
  years_experience: z.number().min(0).max(80).optional().nullable(),
  cover_note: z.string().max(8000).optional().nullable(),
});

/**
 * Public careers application intake (service role).
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("careers-apply", 20, 60 * 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many applications from this network. Try later." },
        { status: 429, headers: rl.response.headers }
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const body = raw as Record<string, unknown>;
    const parsed = bodySchema.safeParse({
      vacancy_code: String(body.vacancy_code || "").trim(),
      first_name: String(body.first_name || "").trim(),
      last_name: String(body.last_name || "").trim(),
      email: String(body.email || "").trim().toLowerCase(),
      phone: body.phone ? String(body.phone) : null,
      skills: body.skills ? String(body.skills) : null,
      years_experience: Number(body.years_experience || 0),
      cover_note: body.cover_note ? String(body.cover_note) : null,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "vacancy_code, first_name, last_name, email required" },
        { status: 400 }
      );
    }

    const emailRl = await rateLimitStrict(
      `careers-email:${parsed.data.email}`,
      5,
      24 * 60 * 60_000
    );
    if (!emailRl.allowed) {
      return NextResponse.json(
        { error: "Too many applications from this email today" },
        { status: 429 }
      );
    }

    const data = parsed.data;
    const sb = createAdminClient();
    const { data: vac, error: vErr } = await sb
      .from("ta_vacancies")
      .select(
        "id,company_id,vacancy_code,title,requirements,status,publish_external"
      )
      .eq("vacancy_code", data.vacancy_code)
      .eq("status", "open")
      .eq("publish_external", true)
      .maybeSingle();
    if (vErr || !vac) {
      return NextResponse.json(
        { error: "Vacancy not found or closed" },
        { status: 404 }
      );
    }

    const companyId = vac.company_id as string;
    const year = new Date().getFullYear();
    const candidateNumber = `CND-${year}-${Date.now().toString(36).toUpperCase()}`;
    const applicationNumber = `APP-${year}-${Date.now().toString(36).toUpperCase()}`;
    const years = Number(data.years_experience || 0);
    const skills = data.skills || "";
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
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
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
      candidate_name: `${data.first_name} ${data.last_name}`,
      email: data.email,
      phone: data.phone || null,
      stage_code: "applied",
      stage_name: "Applied",
      match_score: match.score,
      ai_summary: match.summary,
      source: "careers_portal",
      status: "open",
      notes: data.cover_note || null,
    });
    if (aErr) throw aErr;

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
      { error: e instanceof Error ? e.message : "Application failed" },
      { status: 500 }
    );
  }
}
