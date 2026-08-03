"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { scoreCandidateMatch } from "@/lib/ta/service";
import { toast } from "sonner";

function ApplyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const vacancyCode = params.get("vacancy") || "";
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    years_experience: "0",
    skills: "",
    cover_note: "",
  });

  const year = useMemo(() => new Date().getFullYear(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      // Resolve vacancy (public readable)
      const { data: vac } = await sb
        .from("ta_vacancies")
        .select("id,company_id,vacancy_code,title,requirements")
        .eq("vacancy_code", vacancyCode)
        .eq("status", "open")
        .maybeSingle();

      if (!vac?.company_id) {
        toast.error("Vacancy not found or closed");
        setBusy(false);
        return;
      }

      const companyId = vac.company_id as string;
      const candidateNumber = `CND-${year}-${Date.now().toString(36).toUpperCase()}`;
      const applicationNumber = `APP-${year}-${Date.now().toString(36).toUpperCase()}`;
      const match = scoreCandidateMatch({
        requirements: vac.requirements as string,
        candidateSkills: form.skills,
        yearsExperience: Number(form.years_experience) || 0,
      });

      // Use RPC-less path: insert may fail under RLS for anon.
      // Prefer public API if available; try insert for authenticated/sessionless.
      const { data: cand, error: cErr } = await sb
        .from("ta_candidates")
        .insert({
          company_id: companyId,
          candidate_number: candidateNumber,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone || null,
          years_experience: Number(form.years_experience) || 0,
          skills: form.skills || null,
          source: "careers_portal",
          status: "active",
          consent_privacy: true,
        })
        .select("id,candidate_number")
        .maybeSingle();

      if (cErr) {
        // Fallback: call public apply API
        const res = await fetch("/api/public/careers/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vacancy_code: vacancyCode,
            ...form,
            years_experience: Number(form.years_experience) || 0,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Application failed");
        toast.success(`Application ${json.application_number} submitted`);
        router.push(`/careers?applied=${json.application_number}`);
        return;
      }

      const { error: aErr } = await sb.from("ta_applications").insert({
        company_id: companyId,
        application_number: applicationNumber,
        vacancy_code: vac.vacancy_code,
        vacancy_title: vac.title,
        candidate_id: cand?.id || null,
        candidate_number: cand?.candidate_number || candidateNumber,
        candidate_name: `${form.first_name} ${form.last_name}`,
        email: form.email,
        phone: form.phone || null,
        stage_code: "applied",
        stage_name: "Applied",
        match_score: match.score,
        ai_summary: match.summary,
        source: "careers_portal",
        status: "open",
        notes: form.cover_note || null,
      });
      if (aErr) throw aErr;

      toast.success(`Application ${applicationNumber} submitted`);
      router.push(`/careers?applied=${applicationNumber}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070f1c] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <Link href="/careers" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#C9A227]" />
            <span className="font-semibold">SecureTrack ERP</span>
          </Link>
          <Link href="/careers" className="text-sm text-white/60 hover:text-white">
            Back to jobs
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-10">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader>
            <CardTitle className="text-white">
              Apply{vacancyCode ? ` — ${vacancyCode}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70">First name</Label>
                  <Input
                    className="bg-white/5 border-white/15 text-white"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-white/70">Last name</Label>
                  <Input
                    className="bg-white/5 border-white/15 text-white"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/70">Email</Label>
                <Input
                  type="email"
                  className="bg-white/5 border-white/15 text-white"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-white/70">Phone</Label>
                <Input
                  className="bg-white/5 border-white/15 text-white"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-white/70">Years of experience</Label>
                <Input
                  type="number"
                  className="bg-white/5 border-white/15 text-white"
                  value={form.years_experience}
                  onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-white/70">Skills (comma-separated)</Label>
                <Textarea
                  className="bg-white/5 border-white/15 text-white"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-white/70">Cover note</Label>
                <Textarea
                  className="bg-white/5 border-white/15 text-white"
                  value={form.cover_note}
                  onChange={(e) => setForm({ ...form, cover_note: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-[#C9A227] text-[#0B1F3A] hover:bg-[#d4ad35]"
              >
                <Send className="h-4 w-4 mr-2" />
                {busy ? "Submitting…" : "Submit application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CareersApplyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-white">Loading…</div>}>
      <ApplyForm />
    </Suspense>
  );
}
