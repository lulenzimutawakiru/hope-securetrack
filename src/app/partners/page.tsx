import type { Metadata } from "next";
import { Handshake, Award, Globe2, Rocket, GraduationCap, Users2 } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CtaSection } from "@/components/marketing/home-sections";

export const metadata: Metadata = {
  title: "Partners",
  description: "Grow with the SecureTrack ERP partner program — system integrators, resellers, white-label partners, technology alliances, and academies.",
};

const PROGRAMS = [
  { icon: Handshake, title: "System Integrators", desc: "Implement SecureTrack for clients with certified migration, configuration, and customization services." },
  { icon: Rocket, title: "Resellers & VARs", desc: "Sell and support SecureTrack with attractive margins, deal registration, and joint marketing." },
  { icon: Globe2, title: "White-Label Partners", desc: "Launch SecureTrack under your own brand with dedicated infrastructure and support." },
  { icon: Users2, title: "Technology Alliances", desc: "Build connectors and integrations that extend the platform for shared customers." },
  { icon: GraduationCap, title: "Academies & Trainers", desc: "Deliver certified SecureTrack training to organizations and professionals." },
  { icon: Award, title: "Managed Service Providers", desc: "Operate SecureTrack for multiple clients with centralized governance." },
];

export default function PartnersPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Partners"
          title="Build a business on SecureTrack"
          subtitle="Join a partner ecosystem that serves organizations in 40+ countries with implementation, resale, white-label, training, and technology services."
          primaryCta={{ label: "Become a partner", href: "/contact" }}
        />
        <Section>
          <SectionHeader eyebrow="Partner programs" title="Choose your path" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 0.06}>
                <Card className="h-full border-border/60">
                  <CardContent className="p-6">
                    <p.icon className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
                    <h2 className="text-base font-bold">{p.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section className="bg-muted/40">
          <SectionHeader eyebrow="Partner benefits" title="What you get" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Partner portal & deal registration",
              "Certification and enablement",
              "Co-marketing funds",
              "Dedicated partner success manager",
            ].map((b, i) => (
              <Reveal key={b} delay={i * 0.05}>
                <Card className="border-border/60 bg-background/70 text-center">
                  <CardContent className="p-6">
                    <p className="font-semibold">{b}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg">
              <Link href="/contact">Apply to the partner program</Link>
            </Button>
          </div>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}