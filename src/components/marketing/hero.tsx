import Link from "next/link";
import {
  ArrowRight, BarChart3, Bot, CheckCircle2, Play, Sparkles, TrendingUp,
  Wallet, Package2, ShieldCheck, LineChart as LineChartIcon, Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRUST_BADGES, TRUST_TECH } from "@/lib/marketing/data";

function MiniBars() {
  const bars = [38, 52, 44, 64, 58, 72, 66, 82, 76, 90, 84, 96];
  return (
    <div className="flex h-20 items-end gap-1.5" aria-hidden="true">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-full rounded-sm bg-gradient-to-t from-primary/70 to-accent"
          style={{ height: `${h}%`, opacity: 0.45 + (i / bars.length) * 0.55 }}
        />
      ))}
    </div>
  );
}

function Globe() {
  return (
    <div className="relative mx-auto h-56 w-56 sm:h-72 sm:w-72" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(13,115,119,0.55),rgba(13,115,119,0.12)_55%,transparent_72%)]" />
      <div className="absolute inset-4 animate-spin-slower rounded-full border border-white/15 [border-style:dashed]" />
      <div className="absolute inset-9 animate-spin-slower rounded-full border border-white/10 [animation-direction:reverse] [animation-duration:22s]" />
      <div className="absolute inset-14 rounded-full border border-white/10" />
      <div className="absolute inset-20 rounded-full border border-white/5" />
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-teal-300/80 to-cyan-500/60 blur-[1px]" />
      {[
        { x: "18%", y: "30%", s: 6, d: "0s" },
        { x: "72%", y: "22%", s: 5, d: "0.4s" },
        { x: "80%", y: "62%", s: 7, d: "0.8s" },
        { x: "24%", y: "68%", s: 5, d: "1.1s" },
        { x: "52%", y: "12%", s: 4, d: "1.5s" },
      ].map((dot, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/80 animate-pulse-ring"
          style={{ left: dot.x, top: dot.y, width: dot.s, height: dot.s, animationDelay: dot.d }}
        />
      ))}
    </div>
  );
}

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

      <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:pb-24 lg:pt-20">
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
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="perspective-1200">
              <div className="preserve-3d relative rounded-2xl border border-white/12 bg-white/[0.05] p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-xs font-medium text-white/50">Executive Dashboard</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" /> Live
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { icon: Wallet, label: "Revenue", value: "$8.4M", delta: "+12%" },
                    { icon: Package2, label: "Orders", value: "12,480", delta: "+8%" },
                    { icon: Users2, label: "Active users", value: "3,912", delta: "+5%" },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <kpi.icon className="h-4 w-4 text-teal-300/90" aria-hidden="true" />
                      <div className="mt-2 text-sm font-semibold">{kpi.value}</div>
                      <div className="text-[11px] text-white/45">{kpi.label}</div>
                      <div className="mt-1 text-[11px] font-medium text-emerald-300">{kpi.delta}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-white/50">
                    <span>Revenue trend</span>
                    <span className="font-medium text-white/70">Q1 – Q4</span>
                  </div>
                  <MiniBars />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15">
                      <Bot className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-xs font-medium">AI Assistant</div>
                      <div className="text-[11px] text-white/45">Revenue is up 12% vs forecast…</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-teal-400/15 px-2.5 py-1 text-[11px] font-medium text-teal-200">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Tenant-isolated
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -left-8 top-10 hidden animate-float rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 shadow-xl backdrop-blur-xl sm:block">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-5 w-5 text-teal-300" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold">+22% efficiency</div>
                  <div className="text-[11px] text-white/50">AI-assisted operations</div>
                </div>
              </div>
            </div>
            <div className="absolute -right-6 bottom-14 hidden animate-float-sm rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 shadow-xl backdrop-blur-xl sm:block">
              <div className="flex items-center gap-2.5">
                <LineChartIcon className="h-5 w-5 text-amber-300" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold">Forecast accuracy</div>
                  <div className="text-[11px] text-white/50">92% across modules</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 hidden justify-center lg:flex">
            <Globe />
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