import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Shield,
  QrCode,
  Factory,
  Package,
  BarChart3,
  ShoppingCart,
  Tag,
  Landmark,
  Truck,
  Car,
  Clock,
  Users,
  FolderKanban,
  Printer,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Boxes,
  Sparkles,
  Lock,
  Globe2,
  Layers,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CAPABILITIES: Array<{
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
}> = [
  {
    icon: QrCode,
    title: "Secure authentication",
    desc: "Cryptographically signed QR codes, public verification, and counterfeit intelligence.",
    tag: "Trust",
  },
  {
    icon: Factory,
    title: "Manufacturing MES",
    desc: "Batches, BOM, routing, OEE, quality gates, and end-to-end shop-floor control.",
    tag: "Operations",
  },
  {
    icon: Tag,
    title: "Advanced labels",
    desc: "Enterprise templates, GS1, shipping & shelf labels, security features, Niimbot print.",
    tag: "Print",
  },
  {
    icon: ShoppingCart,
    title: "Revenue & sales",
    desc: "Pipeline, quotations, pricing, contracts, forecasts, credit, and commissions.",
    tag: "Commerce",
  },
  {
    icon: Landmark,
    title: "Finance platform",
    desc: "General ledger, treasury, costing, AR/AP, billing, and multi-company close.",
    tag: "Finance",
  },
  {
    icon: Car,
    title: "Fleet & logistics",
    desc: "Vehicles, GPS, fuel, dispatch routes, proof of delivery, and field mobility.",
    tag: "Logistics",
  },
  {
    icon: Clock,
    title: "Workforce attendance",
    desc: "Geofenced clock-in, biometric terminals, shifts, and payroll-ready timesheets.",
    tag: "People",
  },
  {
    icon: BarChart3,
    title: "Intelligence & AI",
    desc: "Executive KPIs, operational boards, regulatory packs, and AI-assisted insights.",
    tag: "Insights",
  },
];

const MODULES: Array<{ title: string; icon: LucideIcon; group: string }> = [
  { title: "Production", icon: Factory, group: "Ops" },
  { title: "Labels", icon: Tag, group: "Ops" },
  { title: "Print", icon: Printer, group: "Ops" },
  { title: "Packaging", icon: Boxes, group: "Ops" },
  { title: "Inventory", icon: Package, group: "Supply" },
  { title: "Dispatch", icon: Truck, group: "Supply" },
  { title: "Fleet", icon: Car, group: "Supply" },
  { title: "Sales", icon: ShoppingCart, group: "Revenue" },
  { title: "Finance", icon: Landmark, group: "Revenue" },
  { title: "Projects", icon: FolderKanban, group: "Delivery" },
  { title: "Attendance", icon: Clock, group: "People" },
  { title: "HR", icon: Users, group: "People" },
  { title: "Identity", icon: Fingerprint, group: "Security" },
  { title: "QR Codes", icon: QrCode, group: "Security" },
  { title: "Security", icon: Shield, group: "Security" },
  { title: "Reports", icon: BarChart3, group: "Insight" },
];

const STATS = [
  { value: "16+", label: "Enterprise modules" },
  { value: "900+", label: "Application routes" },
  { value: "RBAC", label: "Role-based security" },
  { value: "24/7", label: "Verification portal" },
];

const PIPELINE = [
  { step: "01", title: "Produce", desc: "Batch & quality" },
  { step: "02", title: "Authenticate", desc: "QR & labels" },
  { step: "03", title: "Fulfil", desc: "Inventory & fleet" },
  { step: "04", title: "Sell", desc: "Quote to cash" },
  { step: "05", title: "Assure", desc: "Verify & audit" },
];

const TRUST = [
  { icon: Lock, title: "Enterprise access control", desc: "RBAC, sessions, and approval workflows." },
  { icon: Layers, title: "Full auditability", desc: "Soft-delete, recycle bin, and module audit logs." },
  { icon: Globe2, title: "Cloud-native delivery", desc: "Supabase data plane · Vercel edge · PWA ready." },
  { icon: Sparkles, title: "AI-assisted operations", desc: "Insights across sales, labels, finance, and ops." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070f1c] text-white antialiased">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(15,118,110,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_20%,rgba(201,162,39,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_10%_70%,rgba(59,130,246,0.08),transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070f1c]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 min-w-0 group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A227] to-[#a8841a] shadow-[0_0_24px_-4px_rgba(201,162,39,0.55)]">
              <Shield className="h-5 w-5 text-[#0B1F3A]" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold tracking-tight text-white">
                SecureTrack ERP
              </div>
              <div className="truncate text-[11px] font-medium tracking-wide text-white/40">
                Secure · Intelligent · Connected
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/55 md:flex">
            <a href="#capabilities" className="transition-colors hover:text-white">
              Capabilities
            </a>
            <a href="#modules" className="transition-colors hover:text-white">
              Modules
            </a>
            <a href="#trust" className="transition-colors hover:text-white">
              Trust
            </a>
            <Link href="/verify" className="transition-colors hover:text-white">
              Verify
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/verify" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <ScanLine className="mr-1.5 h-4 w-4" />
                Verify
              </Button>
            </Link>
            <Link href="/register" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-white/70 hover:bg-white/5 hover:text-white"
              >
                Register
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="h-9 rounded-lg bg-[#C9A227] px-4 font-semibold text-[#0B1F3A] shadow-[0_8px_24px_-8px_rgba(201,162,39,0.65)] hover:bg-[#d4ad35]"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#E8D48B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A227] shadow-[0_0_8px_#C9A227]" />
                Multi-tenant enterprise ERP
              </div>

              <h1 className="text-balance text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
                One platform for every
                <br className="hidden sm:block" />{" "}
                company in your{" "}
                <span className="bg-gradient-to-r from-[#E8D48B] via-[#C9A227] to-[#8fd4c8] bg-clip-text text-transparent">
                  group
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-white/55 sm:text-lg">
                SecureTrack ERP is a multi-tenant enterprise system — manufacturing,
                labels, sales, finance, payroll, fleet, attendance, and identity —
                with company isolation, shared group structure, and governed workspaces.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-[#C9A227] px-6 text-[15px] font-semibold text-[#0B1F3A] shadow-[0_12px_40px_-12px_rgba(201,162,39,0.7)] hover:bg-[#d4ad35]"
                  >
                    Access dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/verify">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-white/15 bg-white/[0.03] px-6 text-[15px] font-medium text-white hover:bg-white/[0.08] hover:text-white"
                  >
                    Public verification
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {STATS.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 sm:px-4"
                  >
                    <div className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                      {s.value}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium leading-snug text-white/40">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual panel */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-[#C9A227]/20 via-transparent to-teal-500/20 blur-2xl" />
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-1 shadow-2xl shadow-black/40">
                  <div className="rounded-[0.9rem] border border-white/[0.06] bg-[#0c1628]/90 p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                          Command center
                        </p>
                        <p className="text-sm font-semibold text-white">Live operations</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Operational
                      </span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: "Production batches", value: "In progress", tone: "text-sky-300" },
                        { label: "Label print queue", value: "Ready", tone: "text-amber-200" },
                        { label: "Sales pipeline", value: "Active", tone: "text-[#E8D48B]" },
                        { label: "Product verification", value: "Public", tone: "text-teal-200" },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3"
                        >
                          <span className="text-sm text-white/60">{row.label}</span>
                          <span className={`text-xs font-semibold ${row.tone}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-xl border border-[#C9A227]/20 bg-gradient-to-r from-[#C9A227]/10 to-transparent p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C9A227]/15">
                          <QrCode className="h-4 w-4 text-[#C9A227]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Secure product identity</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                            Every unit carries a signed QR — printable labels, field verify, fraud signals.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section className="border-y border-white/[0.06] bg-white/[0.015]">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C9A227]/90">
                  Value chain
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">
                  From factory floor to customer trust
                </h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              {PIPELINE.map((p, i) => (
                <div
                  key={p.step}
                  className="relative rounded-xl border border-white/[0.07] bg-[#0c1524]/80 p-4"
                >
                  <div className="text-[11px] font-mono font-medium text-[#C9A227]/80">{p.step}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{p.title}</div>
                  <div className="mt-0.5 text-xs text-white/40">{p.desc}</div>
                  {i < PIPELINE.length - 1 && (
                    <ArrowRight className="absolute -right-2 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-white/20 sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C9A227]/90">
              Capabilities
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Built for serious enterprise work
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/50">
              A cohesive suite covering identity of goods, production excellence, commercial
              operations, and controlled growth — with security by design.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, desc, tag }) => (
              <article
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#C9A227]/30 hover:shadow-[0_20px_50px_-24px_rgba(201,162,39,0.35)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition group-hover:border-[#C9A227]/35 group-hover:bg-[#C9A227]/10">
                    <Icon className="h-5 w-5 text-white/75 transition group-hover:text-[#C9A227]" />
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/35">
                    {tag}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/45">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.015] p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C9A227]/90">
                  Module catalogue
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  One sign-in. Complete workspace.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/45">
                  Staff access modules by role. Public product verification remains open without an account.
                </p>
              </div>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="rounded-xl border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white"
                >
                  Sign in to explore
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
              {MODULES.map(({ title, icon: Icon, group }) => (
                <Link
                  key={title}
                  href="/login"
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[#070f1c]/40 px-2 py-5 text-center transition duration-200 hover:border-[#C9A227]/35 hover:bg-[#C9A227]/[0.07]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition group-hover:border-[#C9A227]/30 group-hover:bg-[#C9A227]/10">
                    <Icon className="h-4 w-4 text-white/65 transition group-hover:text-[#C9A227]" />
                  </div>
                  <span className="text-[12px] font-medium text-white/80 transition group-hover:text-white">
                    {title}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">
                    {group}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6">
          <div className="mb-8 max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C9A227]/90">
              Governance
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Professional grade by default
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
              >
                <Icon className="h-5 w-5 text-[#C9A227]" />
                <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/45">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-[#C9A227]/25 bg-gradient-to-br from-[#1a2d4a] via-[#0f1f35] to-[#0a3d3a] px-6 py-12 text-center sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,39,0.18),transparent_55%)]" />
            <div className="relative mx-auto max-w-2xl">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C9A227]/15 ring-1 ring-[#C9A227]/30">
                <Shield className="h-6 w-6 text-[#C9A227]" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Ready for your next shift
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">
                Sign in to the command center, or open the public portal to authenticate a product
                in seconds.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-[#C9A227] px-7 font-semibold text-[#0B1F3A] hover:bg-[#d4ad35]"
                  >
                    Staff sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/verify">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
                  >
                    Verify a product
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/35">
                {["Multi-tenant", "Multi-company", "Audit ready", "Role-based"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A227]/70" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A227]/15">
              <Shield className="h-4 w-4 text-[#C9A227]" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-white/70">SecureTrack ERP</div>
              <div className="text-xs text-white/35">
                © {new Date().getFullYear()} Multi-tenant enterprise platform
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <Link href="/verify" className="transition hover:text-white">
              Verification
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Staff login
            </Link>
            <Link href="/api/health" className="transition hover:text-white">
              System status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
