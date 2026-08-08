import type { Metadata } from "next";
import { Eye, HeartHandshake, Lightbulb, Target, Rocket } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";

export const metadata: Metadata = {
  title: "Company",
  description: "SecureTrack ERP is on a mission to put enterprise-grade ERP within reach of every organization — from startups to multinationals.",
};

const VALUES = [
  { icon: Target, title: "Customer obsession", desc: "Every feature starts with a real customer problem and a measurable outcome." },
  { icon: Lightbulb, title: "Innovation first", desc: "AI, automation, and metadata-driven design keep the platform ahead of enterprise suites." },
  { icon: HeartHandshake, title: "Trust & security", desc: "Multi-tenant isolation, encryption, and auditability are non-negotiable." },
  { icon: Eye, title: "Radical transparency", desc: "Clear pricing, honest roadmaps, and open communication." },
  { icon: Rocket, title: "Speed with quality", desc: "We ship fast without compromising enterprise reliability." },
];

const TIMELINE = [
  { year: "2023", title: "Founded in Kampala", desc: "SecureTrack started with one goal: enterprise ERP for every organization." },
  { year: "2024", title: "Manufacturing & core ERP", desc: "MES, inventory, procurement, and finance went live for first customers." },
  { year: "2025", title: "AI platform launched", desc: "Tenant-aware AI agents, predictive analytics, and workflow automation shipped." },
  { year: "2026", title: "Global expansion", desc: "Serving 40+ countries with industry packs across every major vertical." },
];

export default function CompanyPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Company"
          title="We exist to make enterprise-grade ERP accessible to every organization"
          subtitle="SecureTrack ERP is a cloud-native, AI-powered business operating system built in Africa for the world — combining the depth of global enterprise suites with the speed and simplicity of modern SaaS."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
        />
        <Section>
          <SectionHeader eyebrow="Our values" title="What we stand for" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.05}>
                <Card className="h-full border-border/60">
                  <CardContent className="p-5">
                    <v.icon className="mb-3 h-5 w-5 text-hope-blue" aria-hidden="true" />
                    <h2 className="text-sm font-bold">{v.title}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section className="bg-hope-mist">
          <SectionHeader eyebrow="Milestones" title="The journey so far" />
          <ol className="mx-auto max-w-3xl space-y-4">
            {TIMELINE.map((t, i) => (
              <Reveal key={t.year} delay={i * 0.05}>
                <li className="relative flex gap-5 rounded-2xl border border-border/60 bg-background/70 p-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-hope-blue/10 text-sm font-extrabold text-hope-blue">
                    {t.year.slice(2)}
                  </span>
                  <div>
                    <h3 className="font-bold">{t.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
