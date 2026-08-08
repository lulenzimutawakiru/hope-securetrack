import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { LEARNING_ITEMS, DEVELOPER_FEATURES } from "@/lib/marketing/data";
import { ImageBand } from "@/components/marketing/image-band";
import { IMAGES } from "@/lib/marketing/images";

export const metadata: Metadata = {
  title: "Resources",
  description: "SecureTrack ERP learning center — documentation, knowledge base, academy, certification, tutorials, community, release notes, and API docs.",
};

export default function ResourcesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Resources"
          title="Learn, build, and certify on SecureTrack"
          subtitle="From guided tours to developer documentation, everything you need to master the platform and accelerate adoption."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
        />
        <ImageBand
          src={IMAGES.education}
          alt="SecureTrack Academy, documentation, certifications, and developer resources"
          kicker="Learn, build, certify"
          caption="Guided tours, certification, and developer docs to accelerate adoption and mastery."
        />
        <Section>
          <SectionHeader eyebrow="Learning center" title="Become an expert" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LEARNING_ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={(i % 3) * 0.06}>
                <Link href={item.href} className="group block h-full">
                  <Card className="h-full border-border/60 transition-colors group-hover:border-hope-blue/40">
                    <CardContent className="p-6">
                      <item.icon className="mb-4 h-6 w-6 text-hope-blue" aria-hidden="true" />
                      <h2 className="text-base font-bold">{item.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                      <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-hope-blue">
                        Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section className="bg-hope-mist">
          <SectionHeader eyebrow="For developers" title="Build on the platform" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEVELOPER_FEATURES.map((d, i) => (
              <Reveal key={d.title} delay={(i % 4) * 0.05}>
                <Card className="h-full border-border/60 bg-background/70">
                  <CardContent className="p-5">
                    <d.icon className="mb-3 h-5 w-5 text-hope-blue" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{d.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/developers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-hope-blue hover:underline">
              Visit the developer platform <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
