import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CtaSection } from "@/components/marketing/home-sections";
import { DEVELOPER_FEATURES } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "Developers",
  description: "SecureTrack ERP developer platform — REST and GraphQL APIs, SDKs, CLI, webhooks, OAuth, sandbox environments, and marketplace SDK.",
};

const CODE = `// Create a customer via the SecureTrack API
const res = await fetch("https://api.securetrackerp.com/v1/customers", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Acme Manufacturing",
    country: "UG",
    currency: "UGX",
  }),
});
const customer = await res.json();`;

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Developers"
          title="Build on the SecureTrack platform"
          subtitle="API-first by design. REST, GraphQL, webhooks, SDKs, and a marketplace SDK let you extend SecureTrack exactly the way your business needs."
          primaryCta={{ label: "Read the docs", href: "/resources" }}
          secondaryCta={{ label: "Get API access", href: "/register" }}
        >
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#0b1220] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
              <span className="ml-3 text-xs text-white/50">securetrack-api · customers.ts</span>
            </div>
            <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-slate-200"><code>{CODE}</code></pre>
          </div>
        </PageHero>
        <Section>
          <SectionHeader eyebrow="Platform" title="Everything a developer needs" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEVELOPER_FEATURES.map((d, i) => (
              <Reveal key={d.title} delay={(i % 4) * 0.05}>
                <Card className="h-full border-border/60">
                  <CardContent className="p-5">
                    <d.icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{d.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/resources">Explore the learning center <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
            </Button>
          </div>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}