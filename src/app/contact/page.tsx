import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY } from "@/lib/marketing/data";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the SecureTrack ERP team — sales, support, partnerships, and press.",
};

const CHANNELS = [
  { icon: Mail, title: "Email", value: COMPANY.email, desc: "We reply within one business day." },
  { icon: Phone, title: "Phone", value: COMPANY.phone, desc: "Sales and support hotline." },
  { icon: MapPin, title: "Offices", value: "Kampala, Uganda · Nairobi, Kenya · Global", desc: "Serving customers in 40+ countries." },
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
                  <h2 className="text-xl font-bold">Send us a message</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required.</p>
                  <form className="mt-6 space-y-5" action="mailto:sales@securetrackerp.com" method="get" encType="text/plain">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full name *</Label>
                        <Input id="name" name="name" required placeholder="Jane Doe" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Work email *</Label>
                        <Input id="email" name="email" type="email" required placeholder="jane@company.com" />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input id="company" name="company" placeholder="Acme Corp" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Input id="industry" name="industry" placeholder="Manufacturing" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">How can we help? *</Label>
                      <Textarea id="message" name="message" required rows={5} placeholder="Tell us about your business and goals..." />
                    </div>
                    <Button type="submit" size="lg" className="w-full">Send message</Button>
                    <p className="text-center text-xs text-muted-foreground">
                      By submitting, you agree to our{" "}
                      <a href="/legal/privacy" className="underline">Privacy Policy</a> and{" "}
                      <a href="/legal/terms" className="underline">Terms</a>.
                    </p>
                  </form>
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