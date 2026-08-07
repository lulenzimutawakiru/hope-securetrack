import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { INDUSTRIES } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "Industries",
  description: "SecureTrack ERP serves manufacturing, healthcare, education, government, retail, logistics, agriculture, banking, and more with pre-configured industry packs.",
};

export default function IndustriesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Industries"
          title="Deep industry expertise, out of the box"
          subtitle="Each industry pack pre-configures modules, workflows, KPIs, compliance templates, and AI models — so you start with best practices, not a blank system."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "Talk to an industry expert", href: "/contact" }}
        />
        <Section>
          <SectionHeader eyebrow="Industry packs" title="Choose your industry" />
          <div className="space-y-6">
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.slug} delay={0.04}>
                <Card id={ind.slug} className="scroll-mt-24 border-border/60">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <ind.icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-xl font-bold">{ind.name}</h2>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{ind.blurb}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ind.compliance.map((c) => (
                          <Badge key={c} variant="secondary" className="text-[10px] uppercase tracking-wider">{c}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 grid gap-6 lg:grid-cols-3">
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Industry challenges</h3>
                        <ul className="space-y-2">
                          {ind.challenges.map((ch) => (
                            <li key={ch} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                              {ch}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modules</h3>
                        <ul className="space-y-2">
                          {ind.modules.map((m) => (
                            <li key={m} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                              {m}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proven KPIs</h3>
                        <ul className="space-y-2">
                          {ind.kpis.map((k) => (
                            <li key={k} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">{k}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
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