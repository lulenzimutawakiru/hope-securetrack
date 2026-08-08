import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  LineChart as LineChartIcon,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { TRUST_TECH } from "@/lib/marketing/data";
import { ScreenshotFrame } from "./screenshot-frame";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-hope-navy text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <Image
          src="/images/sap/sapphire-joule-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#00325B_0%,rgba(0,50,91,0.88)_38%,rgba(0,83,140,0.62)_72%,rgba(0,100,216,0.42)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-hope-navy/90 via-transparent to-transparent" />
        <div className="absolute -top-24 right-[8%] h-72 w-72 rounded-full bg-hope-sky/25 blur-[120px]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:pb-24 lg:pt-36">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-hope-sky" aria-hidden="true" />
            The Autonomous Enterprise ERP · Built for Africa
          </div>
          <h1 className="mt-7 text-balance font-jakarta text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[60px]">
            Run your entire enterprise on one intelligent platform
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">
            SecureTrack ERP unifies finance, HR, manufacturing, procurement, supply
            chain, CRM, projects, payroll, assets, service desk, analytics, and AI
            into one secure, scalable platform - built for organizations of every
            size and industry across Africa and beyond.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-xl bg-white px-8 font-bold text-hope-blue shadow-xl shadow-hope-indigo/25 hover:bg-white/90"
              >
                Start Free Trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-xl border-2 border-white/45 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
              >
                Book a Live Demo
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
            {["ISO 27001 Ready", "99.99% uptime", "Tenant-isolated", "Onboard in minutes"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-hope-sky" aria-hidden="true" />
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
          <div className="absolute -left-6 top-10 hidden animate-float rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-xl backdrop-blur-xl sm:block">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-hope-sky" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-white">+22% efficiency</div>
                <div className="text-[11px] text-white/70">AI-assisted operations</div>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 bottom-16 hidden animate-float-sm rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-xl backdrop-blur-xl sm:block">
            <div className="flex items-center gap-2.5">
              <LineChartIcon className="h-5 w-5 text-hope-sky" aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold text-white">Forecast accuracy</div>
                <div className="text-[11px] text-white/70">92% across modules</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-white/[0.05]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              Trusted technology
            </p>
            <div className="mask-fade-x flex w-full items-center justify-center gap-x-8 gap-y-2 overflow-hidden lg:w-auto">
              {TRUST_TECH.map((t) => (
                <span key={t} className="whitespace-nowrap text-sm font-semibold text-white/45">
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
