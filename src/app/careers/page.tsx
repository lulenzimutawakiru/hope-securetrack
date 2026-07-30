"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase, MapPin, Building2, Search, Shield, ArrowRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

type Vacancy = {
  id: string;
  vacancy_code: string;
  title: string;
  department: string | null;
  location_name: string | null;
  employment_type: string | null;
  work_mode: string | null;
  positions: number | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string | null;
  is_featured: boolean | null;
  application_deadline: string | null;
};

export default function CareersPortalPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Vacancy[]>([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient();
        // Prefer demo company seed if RLS allows company-scoped rows for anon via policy;
        // otherwise empty until public API — try open vacancies without company filter first.
        const { data, error } = await sb
          .from("ta_vacancies")
          .select(
            "id,vacancy_code,title,department,location_name,employment_type,work_mode,positions,salary_min,salary_max,currency,description,is_featured,application_deadline"
          )
          .eq("status", "open")
          .eq("publish_external", true)
          .is("deleted_at", null)
          .order("is_featured", { ascending: false })
          .limit(50);
        if (error) throw error;
        setRows((data as Vacancy[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department).filter(Boolean) as string[]);
    return ["all", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "all" && r.department !== dept) return false;
      if (!s) return true;
      return (
        r.title.toLowerCase().includes(s) ||
        (r.department || "").toLowerCase().includes(s) ||
        (r.location_name || "").toLowerCase().includes(s) ||
        (r.description || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, dept]);

  return (
    <div className="min-h-screen bg-[#070f1c] text-white">
      <header className="border-b border-white/10 bg-[#070f1c]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#C9A227]" />
            <div>
              <div className="font-semibold">Hope Design Group</div>
              <div className="text-[11px] text-white/45">Careers</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" asChild>
              <Link href="/login">Staff login</Link>
            </Button>
            <Button size="sm" className="bg-[#C9A227] text-[#0B1F3A] hover:bg-[#d4ad35]" asChild>
              <Link href="#jobs">View jobs</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="mb-12 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
            Build with purpose
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Careers at Hope Design Group
          </h1>
          <p className="mt-4 text-lg text-white/60 leading-relaxed">
            Join a security printing, manufacturing, engineering and commercial enterprise
            headquartered in Uganda. Explore open roles across production, quality, sales,
            logistics and corporate functions.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Security printing", "Manufacturing", "Multi-company ERP", "Kampala HQ"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <section id="jobs" className="scroll-mt-20">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Open vacancies</h2>
              <p className="text-sm text-white/50">{filtered.length} roles</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
                <Input
                  className="pl-9 w-[220px] bg-white/5 border-white/15 text-white placeholder:text-white/40"
                  placeholder="Search roles…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d} value={d} className="text-black">
                    {d === "all" ? "All departments" : d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState message="Loading careers…" />
          ) : filtered.length === 0 ? (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-8 text-center text-white/60">
                No open external vacancies right now. Check back soon or contact HR.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((v) => (
                <Card
                  key={v.id}
                  className="border-white/10 bg-white/[0.04] hover:border-[#C9A227]/40 transition-colors"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {v.is_featured ? (
                            <Badge className="bg-[#C9A227]/20 text-[#E8D48B] border-[#C9A227]/30">
                              Featured
                            </Badge>
                          ) : null}
                          <span className="font-mono text-[11px] text-white/40">
                            {v.vacancy_code}
                          </span>
                        </div>
                        <h3 className="mt-1 text-lg font-semibold text-white">{v.title}</h3>
                      </div>
                      <Briefcase className="h-5 w-5 text-[#C9A227] shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-white/55">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {v.department || "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {v.location_name || "—"}
                      </span>
                      <span className="capitalize">{v.employment_type || "—"}</span>
                      <span className="capitalize">{v.work_mode || "—"}</span>
                    </div>
                    {v.description ? (
                      <p className="text-sm text-white/50 line-clamp-3">{v.description}</p>
                    ) : null}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-white/45">
                        {v.salary_min || v.salary_max
                          ? `${formatNumber(v.salary_min || 0)} – ${formatNumber(v.salary_max || 0)} ${v.currency || "UGX"}`
                          : "Competitive"}
                      </span>
                      <Button size="sm" className="bg-[#C9A227] text-[#0B1F3A] hover:bg-[#d4ad35]" asChild>
                        <Link href={`/careers/apply?vacancy=${encodeURIComponent(v.vacancy_code)}`}>
                          Apply <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-[#C9A227]" />
          <h2 className="mt-3 text-xl font-semibold">Already an employee?</h2>
          <p className="mt-2 text-sm text-white/55">
            Internal mobility and requisitions live inside Hope SecureTrack Talent Acquisition.
          </p>
          <Button className="mt-4 bg-[#C9A227] text-[#0B1F3A] hover:bg-[#d4ad35]" asChild>
            <Link href="/login">Staff sign in</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Hope Design Group Ltd · Careers portal
      </footer>
    </div>
  );
}
