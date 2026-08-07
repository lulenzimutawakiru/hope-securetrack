import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { AiDemoSection, CtaSection } from "@/components/marketing/home-sections";
import { AI_CAPABILITIES, PLATFORM_CAPABILITIES } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "AI Platform",
  description: "SecureTrack AI delivers tenant-aware agents for finance, operations, HR, service, and analytics — with explainable recommendations and workflow-approved actions.",
};

const AI_PILLARS = [
  { title: "Tenant-aware by design", desc: "AI context is isolated per tenant and respects RBAC/ABAC. Your data never trains shared models." },
  { title: "Explainable recommendations", desc: "Every insight cites the data behind it, so teams can trust and act on AI suggestions." },
  { title: "Approval-gated actions", desc: "AI never modifies data without workflow approval — the same controls your humans follow." },
  { title: "Asynchronous & cached", desc: "Heavy AI jobs run in the background; frequent insights are cached for instant response." },
];

export default function AiPlatformPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="AI Platform"
          title="Specialized AI agents for every function"
          subtitle="Not one chatbot — an enterprise AI workforce. Executive, Finance, Procurement, Inventory, Manufacturing, HR, CRM, Service Desk, Compliance, and Risk agents work alongside your people, permission-aware and fully auditable."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "Try the AI demo", href: "/#ai" }}
        />
        <Section>
          <SectionHeader eyebrow="How it works" title="Enterprise AI with enterprise guardrails" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI_PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06}>
                <Card className="h-full border-border/60 bg-background/70">
                  <CardContent className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">0{i + 1}</p>
                    <h2 className="mt-2 text-base font-bold">{p.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <AiDemoSection />
        <Section className="bg-muted/40">
          <SectionHeader eyebrow="AI capabilities" title="Twenty ways AI runs your enterprise" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI_CAPABILITIES.map((cap, i) => (
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
        <Section>
          <SectionHeader eyebrow="Foundation" title="Built on a modern AI stack" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_CAPABILITIES.filter((c) => ["AI Context", "Automation", "Workflow Engine", "API-first"].includes(c.title)).map((cap, i) => (
              <Reveal key={cap.title} delay={i * 0.06}>
                <Card className="h-full border-border/60">
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