import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, LineChart as LineChartIcon, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRUST_TECH } from "@/lib/marketing/data";
import { ScreenshotFrame } from "./screenshot-frame";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#060d1a] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-teal-500/20 blur-[130px]" />
        <div className="absolute top-24 right-[8%] h-72 w-72 rounded-full bg-amber-400/10 blur-[110px]" />
        <div className="absolute bottom-0 left-[6%] h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,13,26,0.85)_100%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            AI-powered · Cloud-native · Enterprise ERP
          </div>
          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
            Run your entire enterprise on{" "}
            <span className="bg-gradient-to-r from-teal-300 via-emerald-200 to-amber-300 bg-clip-text text-transparent">
              one intelligent platform
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
            SecureTrack ERP unifies finance, HR, manufacturing, procurement, supply chain, CRM,
            projects, payroll, asset management, service desk, analytics, and AI into a single
            secure, scalable platform — built for organizations of every size and industry.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button size="lg" className="h-12 gap-2 rounded-xl bg-[#C9A227] px-7 font-semibold text-[#0B1F3A] hover:bg-[#d4ad35]">
                Start Free Trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-xl border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                Book Live Demo
              </Button>
            </Link>
            <Link href="/#experience">
              <Button
                size="lg"
                variant="ghost"
                className="h-12 gap-2 rounded-xl px-4 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Product Tour
              </Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/50">
            {["ISO 27001 Ready", "99.99% uptime", "Tenant-isolated", "Onboard in minutes"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-300/80" aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <ScreenshotFrame
            src="/screenshots/executive.jpg"
            alt="SecureTrack ERP executive dashboard showing revenue, orders, and live KPIs"
            title="Executive Dashboard"
            badge="Live"
            priority
            className="animate-float-sm"
          />
          <div className="absolute -left-6 top-10 hidden animate-float rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 shadow-xl backdrop-blur-xl sm:block">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-teal-300" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold">+22% efficiency</div>
                <div className="text-[11px] text-white/50">AI-assisted operations</div>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 bottom-16 hidden animate-float-sm rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 shadow-xl backdrop-blur-xl sm:block">
            <div className="flex items-center gap-2.5">
              <LineChartIcon className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold">Forecast accuracy</div>
                <div className="text-[11px] text-white/50">92% across modules</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">
              Trusted technology
            </p>
            <div className="mask-fade-x flex w-full items-center justify-center gap-x-8 gap-y-2 overflow-hidden lg:w-auto">
              {TRUST_TECH.map((t) => (
                <span key={t} className="whitespace-nowrap text-sm font-semibold text-white/35">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}