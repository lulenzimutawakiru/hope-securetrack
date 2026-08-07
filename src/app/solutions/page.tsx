import type { Metadata } from "next";
import { Landmark, Factory, Users2, ShoppingCart, BrainCircuit } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { PLATFORM_CAPABILITIES } from "@/lib/marketing/data";
import { ImageBand } from "@/components/marketing/image-band";

export const metadata: Metadata = {
  title: "Solutions",
  description: "SecureTrack ERP unifies finance, operations, people, commerce, and intelligence in one AI-powered enterprise platform.",
};

const PILLARS = [
  { icon: Landmark, name: "Financial Management", desc: "Multi-company GL, AR/AP, treasury, budgeting, tax, and audit-ready close. AI flags anomalies and forecasts cash flow." },
  { icon: Factory, name: "Operations & Supply Chain", desc: "Procurement, inventory, manufacturing MES, quality, warehouse, and fleet — with full traceability from order to delivery." },
  { icon: Users2, name: "People & HCM", desc: "HR, payroll, recruitment, learning, performance, attendance, and identity — one workforce record, zero duplicate entry." },
  { icon: ShoppingCart, name: "Commerce & CRM", desc: "Pipeline, POS, e-commerce, pricing, contracts, and customer portal with AI-assisted selling and forecasting." },
  { icon: BrainCircuit, name: "Intelligence & AI", desc: "Tenant-aware AI agents, executive narratives, predictive analytics, workflow automation, and natural-language reporting." },
];

export default function SolutionsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Solutions"
          title="One platform for your entire enterprise"
          subtitle="Replace disconnected point solutions with a unified business operating system. Every process — finance, operations, people, commerce, and intelligence — runs on one secure, AI-powered platform."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "Book a demo", href: "/contact" }}
        />
        <ImageBand
          src={"/screenshots/executive.jpg"}
          alt="SecureTrack ERP executive dashboard uniting finance, operations, people, commerce, and intelligence"
          kicker="One platform, every department"
          caption="Finance, supply chain, manufacturing, HR, CRM, and AI working from a single source of truth."
        />
        <Section>
          <SectionHeader eyebrow="Core pillars" title="Five pillars. Zero silos." />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <Reveal key={p.name} delay={(i % 3) * 0.06}>
                <Card className="h-full border-border/60">
                  <CardContent className="p-6">
                    <p.icon className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
                    <h2 className="text-lg font-bold">{p.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
            <Reveal delay={0.12}>
              <Card className="flex h-full flex-col justify-center border-primary/30 bg-primary/5 p-6">
                <h2 className="text-lg font-bold">Everything is connected</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  A purchase order approval updates inventory, finance, suppliers, dashboards, search, and AI — automatically.
                </p>
              </Card>
            </Reveal>
          </div>
        </Section>
        <Section className="bg-muted/40">
          <SectionHeader eyebrow="Platform" title="Enterprise capabilities built in" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.title} delay={(i % 4) * 0.05}>
                <Card className="h-full border-border/60 bg-background/70">
                  <CardContent className="p-5">
                    <cap.icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{cap.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cap.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}