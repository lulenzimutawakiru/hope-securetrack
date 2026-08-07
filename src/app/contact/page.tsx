import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { ContactForm } from "@/components/marketing/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { COMPANY } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the SecureTrack ERP team â€” sales, support, partnerships, and press.",
};

const CHANNELS = [
  { icon: Mail, title: "Email", value: COMPANY.email, desc: "We reply within one business day." },
  { icon: Phone, title: "Phone", value: COMPANY.phone, desc: "Sales and support hotline." },
  { icon: MapPin, title: "Offices", value: "Kampala, Uganda Â· Nairobi, Kenya Â· Global", desc: "Serving customers in 40+ countries." },
  { icon: Clock, title: "Support hours", value: "24 / 7 / 365", desc: "Enterprise plans include around-the-clock support." },
];

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Contact"
          title="Let's talk about your enterprise"
          subtitle="Tell us about your organization and our team will respond with a tailored walkthrough, industry pack recommendations, and a live demo."
        />
        <Section>
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              {CHANNELS.map((c, i) => (
                <Reveal key={c.title} delay={i * 0.05}>
                  <Card className="border-border/60">
                    <CardContent className="flex items-start gap-4 p-5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <c.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold">{c.title}</h2>
                        <p className="mt-0.5 text-sm font-medium text-primary">{c.value}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1}>
              <Card className="border-border/60 shadow-xl shadow-primary/5">
                <CardContent className="p-6 sm:p-8">
                  <h2 className="text-xl font-bold">SEND US A MESSAGE</h2>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    Let's discuss how we can help transform your business operations.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Fields marked * are required.
                  </p>
                  <ContactForm />
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}