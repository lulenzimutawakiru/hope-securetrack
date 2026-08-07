import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CtaSection } from "@/components/marketing/home-sections";
import { PRICING_PLANS } from "@/lib/marketing/data";
import { ImageBand } from "@/components/marketing/image-band";
import { IMAGES } from "@/lib/marketing/images";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent SecureTrack ERP pricing — Starter, Professional, Business, and Enterprise plans with free trial, annual billing, and enterprise options.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Pricing"
          title="Start free. Scale to enterprise."
          subtitle="Every plan includes multi-tenant security, automated backups, the mobile app, and guided onboarding. Upgrade, downgrade, or add modules anytime."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "Talk to sales", href: "/contact" }}
        />
        <ImageBand
          src={IMAGES.banking}
          alt="Simple, transparent pricing for organizations at every stage of growth"
          kicker="Plans for every stage"
          caption="Start free, scale to enterprise — upgrade, downgrade, or add modules and seats anytime."
        />
        <Section>
          <div className="grid gap-4 lg:grid-cols-4">
            {PRICING_PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.06}>
                <Card className={`flex h-full flex-col border-border/60 ${plan.featured ? "border-primary/50 shadow-xl shadow-primary/10" : ""}`}>
                  <CardHeader>
                    {plan.featured ? <Badge className="mb-2 w-fit bg-primary text-primary-foreground">Most popular</Badge> : null}
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                    <p className="mt-2">
                      <span className="text-3xl font-extrabold tracking-tight">{plan.monthly > 0 ? `$${plan.monthly}` : "Custom"}</span>
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
            All plans include a 14-day free trial. Volume discounts, annual contracts, and government pricing available.{" "}
            <Link href="/contact" className="font-medium text-primary hover:underline">Contact sales</Link>.
          </p>
        </Section>
        <Section className="bg-muted/40">
          <SectionHeader eyebrow="FAQ" title="Pricing questions, answered" />
          <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border/60 bg-background/60">
            {[
              { q: "Is there a free trial?", a: "Yes — 14 days on any plan with full module access, no credit card required." },
              { q: "Can we add modules later?", a: "Yes. Modules, users, storage, and AI credits can be added anytime from the subscription center." },
              { q: "Do you offer non-profit or government pricing?", a: "Yes. NGOs, education, and government organizations qualify for discounted pricing." },
              { q: "What about data residency and on-premise?", a: "Enterprise plans support private cloud, dedicated cloud, and on-premise deployment with custom SLAs." },
            ].map((f) => (
              <details key={f.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-primary transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}