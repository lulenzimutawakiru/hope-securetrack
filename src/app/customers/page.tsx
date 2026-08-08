import type { Metadata } from "next";
import { CircleCheck, Quote, Star } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { TESTIMONIALS, CASE_STUDIES } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "Customers",
  description: "See how organizations across manufacturing, government, healthcare, retail, and more run on SecureTrack ERP.",
};

const METRICS = [
  { value: "40+", label: "Countries" },
  { value: "98%", label: "Customer satisfaction" },
  { value: "3.2x", label: "Average ROI in year one" },
  { value: "9 wks", label: "Average time to go-live" },
];

export default function CustomersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Customers"
          title="Organizations that run on SecureTrack"
          subtitle="Manufacturers, ministries, hospitals, schools, retailers, and service firms replaced disconnected systems with one intelligent platform."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
        />
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <Reveal key={m.label} delay={i * 0.05}>
                <Card className="border-border/60 text-center">
                  <CardContent className="p-8">
                    <p className="text-4xl font-extrabold tracking-tight text-hope-blue">{m.value}</p>
                    <p className="mt-2 text-sm font-medium text-muted-foreground">{m.label}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section className="bg-hope-mist">
          <SectionHeader eyebrow="Testimonials" title="What customers say" />
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
        </Section>
        <Section>
          <SectionHeader eyebrow="Case studies" title="Measurable business results" />
          <div className="grid gap-4 md:grid-cols-3">
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
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
