import Link from "next/link";
import {
  ArrowRight, Sparkles, CheckCircle2, Layers, Boxes, Rocket, ShieldCheck,
  Globe2, Palette, Workflow, Fingerprint, Lock, Database, CloudCog, Cpu,
  Smartphone, QrCode, Bell, Wallet, Zap, Quote, Star, ChartColumn, Bot,
  BarChart3, LineChart, FileText, Plug, MonitorSmartphone, CircleCheck,
  Unplug, FileSpreadsheet, EyeOff, ShieldAlert, Hourglass, Gauge, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Section, SectionHeader } from "./section";
import { Reveal } from "./reveal";
import { Counters } from "./counters";
import { getMarketingStats } from "@/lib/marketing/stats";
import { ErpExperience } from "./erp-experience";
import { AiDemo } from "./ai-demo";
import { AnalyticsShowcase } from "./analytics-showcase";
import {
  COMPANY, TRUST_BADGES, INDUSTRIES, MODULES, AI_CAPABILITIES, PLATFORM_CAPABILITIES,
  SECURITY_FEATURES, MARKETPLACE_ITEMS, INTEGRATION_GROUPS, MOBILE_FEATURES,
  TESTIMONIALS, CASE_STUDIES, PRICING_PLANS, FAQS, JOURNEY_STEPS,
} from "@/lib/marketing/data";

export function IntroSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <h2 className="text-balance font-jakarta text-4xl font-extrabold leading-[1.12] tracking-tight text-hope-indigo sm:text-5xl">
          One intelligent platform for finance, operations, people, and growth
        </h2>
        <div>
          <p className="text-[17px] leading-relaxed text-[#131313]/80">
            SecureTrack ERP replaces disconnected point solutions with one
            AI-powered enterprise operating system. Finance, operations, and
            people teams share a single database, a single security model, and
            one source of truth - so every department runs on the same live data.
          </p>
          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {[
              "31 integrated ERP modules",
              "One shared database",
              "Tenant-isolated security",
              "AI across every workflow",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-[#131313]/85">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hope-blue" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  const services = [
    {
      icon: Wallet,
      kicker: "Finance & Accounting",
      title: "Close the books in days, not weeks",
      desc: "General ledger, budgets, payables, receivables, and multi-currency consolidation on one ledger - with automated approvals and immutable audit trails.",
      points: ["General ledger & budgets", "AR / AP with approvals", "Multi-currency & tax", "Automated month-end close"],
      href: "/modules#finance",
      cta: "Explore Finance",
      theme: "mist" as const,
    },
    {
      icon: Boxes,
      kicker: "Operations & Supply Chain",
      title: "From procurement to production to delivery",
      desc: "Inventory, purchasing, manufacturing, quality, fleet, and logistics run on one real-time engine - no more spreadsheets or stockouts.",
      points: ["Inventory & warehouse", "Procurement & vendors", "Manufacturing MES", "Fleet & logistics"],
      href: "/modules#inventory",
      cta: "Explore Operations",
      theme: "blue" as const,
    },
    {
      icon: Users,
      kicker: "People, HR & Payroll",
      title: "Your workforce, fully connected",
      desc: "HR, payroll, recruitment, attendance, and performance in one tenant-safe system with compliant payroll runs and self-service.",
      points: ["HR & employee records", "Payroll & compliance", "Recruitment & onboarding", "Attendance & leave"],
      href: "/modules#hr",
      cta: "Explore HR",
      theme: "indigo" as const,
    },
  ];

  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pb-28">
        <div className="grid gap-6 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.kicker}
              className={cn(
                "flex min-h-[440px] flex-col justify-between p-6 sm:min-h-[520px] sm:p-10 lg:min-h-[635px] lg:p-[60px]",
                s.theme === "mist" && "bg-hope-mist text-[#131313]",
                s.theme === "blue" && "bg-hope-blue text-white",
                s.theme === "indigo" && "bg-hope-indigo text-white",
              )}
            >
              <div>
                <s.icon className="h-10 w-10" aria-hidden="true" />
                <p
                  className={cn(
                    "mt-10 text-xs font-extrabold uppercase tracking-[0.18em]",
                    s.theme === "mist" ? "text-hope-blue" : "text-hope-sky",
                  )}
                >
                  {s.kicker}
                </p>
                <h3 className="mt-5 text-balance font-jakarta text-3xl font-extrabold tracking-tight">
                  {s.title}
                </h3>
                <p
                  className={cn(
                    "mt-5 text-[15px] leading-relaxed",
                    s.theme === "mist" ? "text-[#131313]/75" : "text-white/80",
                  )}
                >
                  {s.desc}
                </p>
                <ul className="mt-8 space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-sm font-medium">
                      <CheckCircle2
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          s.theme === "mist" ? "text-hope-blue" : "text-hope-sky",
                        )}
                        aria-hidden="true"
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={s.href}
                className={cn(
                  "mt-10 inline-flex h-12 w-fit items-center justify-center gap-2 border-2 px-7 text-xs font-extrabold uppercase tracking-[0.14em] transition",
                  s.theme === "mist"
                    ? "border-hope-indigo text-hope-indigo hover:bg-hope-indigo hover:text-white"
                    : "border-white text-white hover:bg-white hover:text-hope-indigo",
                )}
              >
                {s.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export async function StatsSection() {
  const stats = await getMarketingStats();
  return (
    <Section className="border-y bg-hope-mist">
      <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-hope-blue">Live platform metrics</p>
      <Counters stats={stats} />
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Trust badges">
        {TRUST_BADGES.map((b) => (
          <Badge key={b} variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-hope-blue" aria-hidden="true" />
            {b}
          </Badge>
        ))}
      </div>
    </Section>
  );
}

export function ProblemsSection() {
  const problems = [
    {
      icon: Unplug,
      title: "Disconnected systems",
      problem: "CRM, finance, inventory, and HR live in separate tools that never talk to each other. Nothing reconciles.",
      fix: "One platform. One database. One source of truth.",
    },
    {
      icon: FileSpreadsheet,
      title: "Manual processes",
      problem: "Spreadsheets, emails, and paper forms slow approvals, invoicing, and reporting to a crawl.",
      fix: "Automated approvals, workflows, and document generation.",
    },
    {
      icon: EyeOff,
      title: "Poor visibility",
      problem: "No real-time view of cash, stock, orders, or performance across branches and departments.",
      fix: "Live executive dashboards with drill-down analytics.",
    },
    {
      icon: ShieldAlert,
      title: "Security risks",
      problem: "Data scattered across apps with weak access controls, no audit trail, and no tenant isolation.",
      fix: "Tenant-isolated, RBAC/ABAC, MFA, and immutable audit trails.",
    },
    {
      icon: Hourglass,
      title: "Slow decision making",
      problem: "Reports take days to assemble, so decisions are made on stale or incomplete data.",
      fix: "AI insights and real-time reporting in seconds.",
    },
    {
      icon: Gauge,
      title: "Operational inefficiency",
      problem: "Duplicated data entry and rework across departments inflate costs and delay growth.",
      fix: "One entry point, integrated processes, AI automation.",
    },
  ];

  return (
    <Section id="problems" className="relative overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_85%_10%,rgba(1,106,174,0.05),transparent_65%)]"
        aria-hidden="true"
      />
      <SectionHeader
        eyebrow="The cost of chaos"
        title="Running a business on disconnected tools"
        subtitle="Spreadsheets, siloed apps, and manual handoffs quietly drain revenue every day. Here is what they cost your organization - and how SecureTrack eliminates each one."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {problems.map((p, i) => (
          <Reveal key={p.title} delay={(i % 3) * 0.07}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-hope-blue/40 hover:shadow-xl hover:shadow-hope-blue/10">
              <div
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
              />
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-hope-blue/15 to-hope-indigo/5 text-hope-blue transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <p.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.problem}</p>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-hope-blue/25 bg-hope-blue/5 p-3 opacity-0 transition-all duration-300 group-hover:opacity-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hope-blue" aria-hidden="true" />
                <p className="text-xs font-medium leading-relaxed text-hope-blue dark:text-hope-sky">{p.fix}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
export function ExperienceSection() {
  return (
    <Section id="experience" className="bg-gradient-to-b from-transparent via-muted/30 to-transparent">
      <SectionHeader
        eyebrow="Interactive product experience"
        title="Explore the platform, live"
        subtitle="Click through Executive, Finance, Manufacturing, CRM, Inventory, HR, Payroll, Procurement, Projects, Assets, Fleet, AI, Analytics, and Service Desk. Every preview is a real screenshot from the live SecureTrack ERP platform."
      />
      <ErpExperience />
    </Section>
  );
}

export function AiDemoSection() {
  return (
    <Section id="ai" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(1,106,174,0.14),transparent_70%)]" aria-hidden="true" />
      <SectionHeader
        eyebrow="SecureTrack AI"
        title="Ask your enterprise anything"
        subtitle="A live, interactive preview of the AI assistant. Try the suggestions below — every response is tenant-aware and permission-scoped in the real product."
      />
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {AI_CAPABILITIES.slice(0, 8).map((cap, i) => (
            <Reveal key={cap.title} delay={i * 0.05}>
              <Card className="h-full border-border/60 bg-background/60 backdrop-blur">
                <CardContent className="p-5">
                  <cap.icon className="mb-3 h-5 w-5 text-hope-blue" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{cap.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cap.desc}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1}>
          <AiDemo />
        </Reveal>
      </div>
    </Section>
  );
}export function IndustriesSection() {
  return (
    <Section id="industries" className="bg-hope-mist">
      <SectionHeader
        eyebrow="Industries"
        title="Built for every industry"
        subtitle="Pre-configured industry packs ship with workflows, KPIs, compliance templates, and AI models — from manufacturing floors to government ministries."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((ind, i) => (
          <Reveal key={ind.slug} delay={(i % 3) * 0.06}>
            <Link href={`/industries#${ind.slug}`} className="group block h-full">
              <Card className="h-full border-border/60 transition-colors group-hover:border-hope-blue/40">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hope-blue/10 text-hope-blue">
                      <ind.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-hope-blue" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold">{ind.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{ind.blurb}</p>
                </CardContent>
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild size="lg" variant="outline">
          <Link href="/industries">
            Explore all industries <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

export function ModulesSection() {
  return (
    <Section id="modules">
      <SectionHeader
        eyebrow="Modules"
        title="One platform. Every module."
        subtitle="31 integrated modules share one database, one security model, one workflow engine, and one AI brain — no disconnected point solutions."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.map((mod, i) => (
          <Reveal key={mod.slug} delay={(i % 4) * 0.05}>
            <Link href={`/modules#${mod.slug}`} className="group block h-full">
              <Card className="h-full border-border/60 transition-all hover:-translate-y-0.5 hover:border-hope-blue/40 hover:shadow-lg hover:shadow-hope-blue/10">
                <CardContent className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-hope-blue/15 to-hope-indigo/15 text-hope-blue">
                    <mod.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold">{mod.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{mod.overview}</p>
                </CardContent>
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild size="lg">
          <Link href="/modules">
            View all modules <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

export function PlatformSection() {
  return (
    <Section id="platform" className="bg-white">
      <SectionHeader
        eyebrow="Enterprise platform"
        title="A cloud-native operating system for your business"
        subtitle="Every capability is metadata-driven, workflow-enabled, API-first, and event-driven — configurable by administrators without writing code."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORM_CAPABILITIES.map((cap, i) => (
          <Reveal key={cap.title} delay={(i % 4) * 0.05}>
            <Card className="h-full border-border/60 bg-background/60">
              <CardContent className="p-5">
                <cap.icon className="mb-3 h-5 w-5 text-hope-blue" aria-hidden="true" />
                <h3 className="text-sm font-semibold">{cap.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cap.desc}</p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}export function MarketplaceSection() {
  return (
    <Section id="marketplace">
      <SectionHeader
        eyebrow="Marketplace"
        title="Extend without custom code"
        subtitle="One-click install for extensions, connectors, AI skills, themes, and industry apps — all versioned, licensed, and tenant-isolated."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETPLACE_ITEMS.map((item, i) => (
          <Reveal key={item.title} delay={(i % 4) * 0.05}>
            <Card className="h-full border-border/60">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hope-blue/10 text-hope-blue">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{item.category}</Badge>
                </div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function IntegrationsSection() {
  return (
    <Section id="integrations" className="overflow-hidden">
      <SectionHeader
        eyebrow="Integrations"
        title="Connect your entire stack"
        subtitle="Native integrations with the tools you already run — plus REST, GraphQL, and webhooks for everything else."
      />
      <div className="space-y-4">
        {INTEGRATION_GROUPS.map((group, gi) => (
          <Reveal key={group.title} delay={gi * 0.05}>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Plug className="h-4 w-4 text-hope-blue" aria-hidden="true" />
                {group.title}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item} className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function AnalyticsSection() {
  return (
    <Section id="analytics" className="bg-hope-mist">
      <SectionHeader
        eyebrow="Analytics & BI"
        title="Executive intelligence, on demand"
        subtitle="Interactive dashboards with AI predictions, drill-through, and scheduled reports — exported to PDF, Excel, CSV, or JSON."
      />
      <AnalyticsShowcase />
    </Section>
  );
}

export function MobileSection() {
  return (
    <Section id="mobile">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeader
            align="left"
            eyebrow="Mobile & field"
            title="Your enterprise in every pocket"
            subtitle="Offline-first mobile apps, QR and barcode scanning, RFID, push notifications, and voice commands keep field teams productive anywhere — even without connectivity."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {MOBILE_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <li className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-hope-blue" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal delay={0.1}>
          <div className="relative mx-auto max-w-sm rounded-[2rem] border border-border/70 bg-background p-3 shadow-2xl shadow-primary/10">
            <div className="rounded-[1.6rem] bg-gradient-to-b from-muted to-background p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-bold">SecureTrack Mobile</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                {[
                  { label: "Open service tickets", value: 12, sub: "Field queue" },
                  { label: "Stock counts", value: 98, sub: "Completion %" },
                  { label: "Assets scanned", value: 342, sub: "Today" },
                  { label: "Offline sync", value: "Ready", sub: "12 pending ops" },
                ].map((row) => (
                  <div key={row.label} className="rounded-xl border border-border/60 bg-background p-4">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="mt-1 text-lg font-bold">{row.value}</p>
                    <p className="text-xs text-muted-foreground">{row.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}export function TestimonialsSection() {
  return (
    <Section id="customers" className="bg-hope-mist">
      <SectionHeader
        eyebrow="Customer success"
        title="Trusted by organizations that run on SecureTrack"
        subtitle="From manufacturers to ministries, teams replace fragmented systems with one intelligent platform."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={(i % 2) * 0.08}>
            <Card className="h-full border-border/60 bg-background/70">
              <CardContent className="p-6">
                <Quote className="mb-4 h-6 w-6 text-hope-blue/50" aria-hidden="true" />
                <p className="leading-relaxed text-muted-foreground">"{t.quote}"</p>
                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                  </div>
                  <div className="flex gap-0.5" aria-label="5 star rating">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {CASE_STUDIES.map((cs, i) => (
          <Reveal key={cs.title} delay={i * 0.07}>
            <Card className="h-full border-border/60">
              <CardHeader>
                <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider">{cs.industry}</Badge>
                <CardTitle className="text-base">{cs.title}</CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">{cs.summary}</p>
              </CardHeader>
              <CardFooter className="flex flex-col items-start gap-1.5">
                {cs.results.map((r) => (
                  <span key={r} className="flex items-center gap-1.5 text-sm font-medium">
                    <CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    {r}
                  </span>
                ))}
              </CardFooter>
            </Card>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild size="lg" variant="outline">
          <Link href="/customers">Read customer stories <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
        </Button>
      </div>
    </Section>
  );
}

export function SecuritySection() {
  return (
    <Section id="security" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_80%_10%,rgba(1,106,174,0.12),transparent_70%)]" aria-hidden="true" />
      <SectionHeader
        eyebrow="Security & compliance"
        title="Enterprise-grade security, by default"
        subtitle="Zero-trust architecture, military-grade tenant isolation, and compliance-ready controls across every layer."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SECURITY_FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 4) * 0.05}>
            <Card className="h-full border-border/60 bg-background/60">
              <CardContent className="p-5">
                <f.icon className="mb-3 h-5 w-5 text-hope-blue" aria-hidden="true" />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/security">Explore the security center <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
        </Button>
      </div>
    </Section>
  );
}

export function PricingSection() {
  return (
    <Section id="pricing" className="bg-hope-mist">
      <SectionHeader
        eyebrow="Pricing"
        title="Simple plans. Enterprise power."
        subtitle="Start free, scale to multinational. Every plan includes multi-tenant security, backups, and the mobile app."
      />
      <div className="grid gap-4 lg:grid-cols-4">
        {PRICING_PLANS.map((plan, i) => (
          <Reveal key={plan.name} delay={i * 0.06}>
            <Card className={`flex h-full flex-col border-border/60 ${plan.featured ? "border-hope-blue/50 shadow-xl shadow-hope-blue/10" : ""}`}>
              <CardHeader>
                {plan.featured ? (
                  <Badge className="mb-2 w-fit bg-hope-blue text-white">Most popular</Badge>
                ) : null}
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="mt-2">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {plan.monthly > 0 ? `$${plan.monthly}` : "Custom"}
                  </span>
                  {plan.monthly > 0 ? <span className="text-sm text-muted-foreground"> /mo</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{plan.monthly > 0 ? `Billed annually: $${plan.annual}/mo` : "Tailored to your organization"}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 font-medium"><CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />{plan.users}</li>
                  <li className="flex items-center gap-2 font-medium"><CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />{plan.storage}</li>
                  <li className="flex items-center gap-2 font-medium"><CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />{plan.ai}</li>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground"><CircleCheck className="h-4 w-4 shrink-0 text-emerald-500/70" aria-hidden="true" />{f}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild variant={plan.featured ? "default" : "outline"} className="w-full">
                  <Link href="/register">{plan.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Need something different? <Link href="/contact" className="font-medium text-hope-blue hover:underline">Talk to sales</Link> for dedicated cloud, on-premise, or government deployment.
      </p>
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section id="faq">
      <SectionHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle="Answers to the questions enterprise buyers ask most."
      />
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border/60 bg-background/60">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {faq.q}
              <span className="text-hope-blue transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function JourneySection() {
  return (
    <Section id="implementation" className="bg-white">
      <SectionHeader
        eyebrow="Implementation journey"
        title="From discovery to go-live in weeks, not years"
        subtitle="A proven methodology supported by guided onboarding, data migration tools, and continuous optimization."
      />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY_STEPS.map((step, i) => (
          <Reveal key={step.title} delay={(i % 4) * 0.05}>
            <li className="relative h-full rounded-2xl border border-border/60 bg-background/70 p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-hope-blue/10 text-hope-blue">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

export function CtaSection() {
  return (
    <Section className="pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-hope-indigo px-6 py-16 text-center text-white sm:px-16">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,white_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              Run your entire enterprise on one intelligent platform
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              Join organizations across 40+ countries that replaced disconnected systems with SecureTrack ERP.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="bg-white text-hope-indigo hover:bg-white/90">
                <Link href="/register">
                  <Rocket className="mr-2 h-4 w-4" aria-hidden="true" /> Start Free Trial
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                <Link href="/contact">
                  Book a live demo <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/70">Free 14-day trial · No credit card required · Cancel anytime</p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
