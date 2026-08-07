import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ImageBand } from "@/components/marketing/image-band";
import { Hero } from "@/components/marketing/hero";
import {
  StatsSection, ProblemsSection, ExperienceSection, AiDemoSection, IndustriesSection, ModulesSection,
  PlatformSection, MarketplaceSection, IntegrationsSection, AnalyticsSection,
  MobileSection, TestimonialsSection, SecuritySection, PricingSection, FaqSection,
  JourneySection, CtaSection,
} from "@/components/marketing/home-sections";

export const metadata: Metadata = {
  title: "Run Your Entire Enterprise on One Intelligent Platform",
  description:
    "SecureTrack ERP is an AI-powered, cloud-native enterprise resource planning platform that unifies Finance, HR, Manufacturing, Procurement, Supply Chain, CRM, Projects, Payroll, Asset Management, Service Desk, Analytics, and AI in one secure, scalable system.",
  alternates: { canonical: "https://hope-securetrack.vercel.app" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "SecureTrack ERP",
      url: "https://hope-securetrack.vercel.app",
      description:
        "AI-powered, cloud-native Enterprise Business Operating System unifying Finance, HR, Manufacturing, CRM, Payroll, Assets, Service Desk, Analytics, and AI.",
      sameAs: ["https://github.com/hope-securetrack"],
    },
    {
      "@type": "SoftwareApplication",
      name: "SecureTrack ERP",
      operatingSystem: "Web, iOS, Android",
      applicationCategory: "BusinessApplication",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "128" },
    },
  ],
};

export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <ImageBand
          src={"/screenshots/executive-bi.jpg"}
          alt="SecureTrack ERP executive analytics dashboard with live KPIs and AI insights"
          kicker="One platform, every department"
          caption="From the boardroom to the shop floor, every team runs on the same secure, AI-powered source of truth."
        />
        <StatsSection />
        <ProblemsSection />
        <ExperienceSection />
        <AiDemoSection />
        <IndustriesSection />
        <ModulesSection />
        <PlatformSection />
        <MarketplaceSection />
        <IntegrationsSection />
        <AnalyticsSection />
        <MobileSection />
        <TestimonialsSection />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <JourneySection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}