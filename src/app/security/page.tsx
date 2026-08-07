import type { Metadata } from "next";
import { ShieldCheck, Lock, Eye, Server } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section, SectionHeader } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { CtaSection } from "@/components/marketing/home-sections";
import { SECURITY_FEATURES, TRUST_BADGES } from "@/lib/marketing/data";
import { ImageBand } from "@/components/marketing/image-band";
import { IMAGES } from "@/lib/marketing/images";

export const metadata: Metadata = {
  title: "Security",
  description: "SecureTrack ERP is built with zero-trust architecture, military-grade tenant isolation, encryption, RBAC/ABAC, MFA, SSO, and compliance-ready controls.",
};

const LAYERS = [
  { icon: Lock, title: "Identity & access", desc: "MFA, passkeys, SSO/SAML/OIDC, RBAC + ABAC, just-in-time access, session monitoring, and device trust." },
  { icon: ShieldCheck, title: "Data protection", desc: "Encryption at rest and in transit, key management, RLS on every table, and tenant-scoped storage buckets." },
  { icon: Eye, title: "Audit & observability", desc: "Immutable audit logs, anomaly detection, security incident dashboard, DLP, and full traceability." },
  { icon: Server, title: "Resilience", desc: "Automated backups, point-in-time recovery, geo replication, and 99.99% availability targets." },
];

export default function SecurityPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Security center"
          title="Enterprise-grade security, by default"
          subtitle="Zero-trust architecture and military-grade tenant isolation protect every record, file, query, and AI response. Security is built into the platform — not bolted on."
          primaryCta={{ label: "Start Free Trial", href: "/register" }}
          secondaryCta={{ label: "Talk to security team", href: "/contact" }}
        />
        <ImageBand
          src={IMAGES.serverRoom}
          alt="Enterprise data center powering SecureTrack cloud infrastructure"
          kicker="Zero trust by default"
          caption="Military-grade tenant isolation, encryption, and immutable audit across every layer of the stack."
        />
        <Section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LAYERS.map((l, i) => (
              <Reveal key={l.title} delay={i * 0.06}>
                <Card className="h-full border-border/60 bg-background/70">
                  <CardContent className="p-6">
                    <l.icon className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
                    <h2 className="text-base font-bold">{l.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section className="bg-muted/40">
          <SectionHeader eyebrow="Controls" title="Security controls across every layer" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SECURITY_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.05}>
                <Card className="h-full border-border/60 bg-background/70">
                  <CardContent className="p-5">
                    <f.icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
        <Section>
          <SectionHeader eyebrow="Compliance" title="Compliance-ready from day one" />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {TRUST_BADGES.map((b) => (
              <span key={b} className="rounded-full border border-border/70 bg-muted/40 px-5 py-2.5 text-sm font-semibold">
                {b}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            SecureTrack is architected to support ISO 27001, SOC 2, GDPR, PCI DSS, HIPAA, and regional data-protection frameworks — with configurable retention, consent, and audit policies per tenant.
          </p>
        </Section>
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}