import type { Metadata } from "next";
import Image from "next/image";
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
import { ImageBand } from "@/components/marketing/image-band";
import { IMAGES, INDUSTRY_IMAGES } from "@/lib/marketing/images";

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
        <ImageBand
          src={IMAGES.logistics}
          alt="Global operations across manufacturing, healthcare, education, retail, and logistics powered by SecureTrack ERP"
          kicker="19 industry packs"
          caption="Pre-configured modules, workflows, KPIs, compliance templates, and AI models for every sector."
        />
        <Section>
          <SectionHeader eyebrow="Industry packs" title="Choose your industry" />
          <div className="space-y-6">
            {INDUSTRIES.map((ind, i) => (
              <Reveal key={ind.slug} delay={0.04}>
                <Card id={ind.slug} className="scroll-mt-24 overflow-hidden border-border/60">
                  <div className="relative h-44 w-full sm:h-52">
                    <Image
                      src={INDUSTRY_IMAGES[ind.slug] ?? IMAGES.collaboration}
                      alt={`${ind.name} industry pack`}
                      fill
                      sizes="(min-width: 1024px) 1216px, 100vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" aria-hidden="true" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                          <ind.icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h2 className="text-xl font-bold text-white">{ind.name}</h2>
                      </div>
                      <div className="hidden flex-wrap gap-1.5 sm:flex">
                        {ind.compliance.map((c) => (
                          <Badge key={c} variant="secondary" className="bg-white/15 text-[10px] uppercase tracking-wider text-white backdrop-blur">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{ind.blurb}</p>
                      <div className="flex flex-wrap gap-1.5 sm:hidden">
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
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-hope-blue/60" aria-hidden="true" />
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
                            <li key={k} className="rounded-lg border border-border/60 bg-hope-mist px-3 py-2 text-sm font-medium">{k}</li>
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
