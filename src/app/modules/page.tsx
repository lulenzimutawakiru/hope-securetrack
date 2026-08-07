import type { Metadata } from "next";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { MODULES } from "@/lib/marketing/data";
import { ImageBand } from "@/components/marketing/image-band";
import { IMAGES } from "@/lib/marketing/images";

export const metadata: Metadata = {
  title: "Modules",
  description: "Explore all 31 SecureTrack ERP modules — Finance, HR, Manufacturing, CRM, Inventory, AI, Analytics, and more — integrated on one platform.",
};

export default function ModulesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Modules"
          title="Every business process. One platform."
          subtitle="31 integrated modules share one database, one security model, one workflow engine, and one AI brain. Explore each module below."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "See the live demo", href: "/#experience" }}
        />
        <ImageBand
          src={IMAGES.warehouse}
          alt="Connected ERP modules spanning finance, manufacturing, inventory, and the warehouse"
          kicker="31 integrated modules"
          caption="One database, one security model, one workflow engine, one AI brain — every module stays connected."
        />
        <Section>
          <div className="space-y-6">
            {MODULES.map((mod, i) => (
              <Reveal key={mod.slug} delay={0.03}>
                <Card id={mod.slug} className="scroll-mt-24 border-border/60">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                          <mod.icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div>
                          <h2 className="text-xl font-bold">{mod.name}</h2>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{mod.overview}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{mod.group}</Badge>
                    </div>
                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key features</h3>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {mod.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> AI features
                        </h3>
                        <ul className="space-y-2">
                          {mod.ai.map((a) => (
                            <li key={a} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">{a}</li>
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