import type { Metadata } from "next";
import { LegalPage, LegalBlock } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "SecureTrack ERP cookie policy — how we use cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="January 1, 2026">
      <LegalBlock heading="1. What are cookies?" paragraphs={[
        "Cookies are small text files stored on your device when you visit a website. They help sites remember your preferences and understand how the site is used.",
      ]} />
      <LegalBlock heading="2. How we use cookies" paragraphs={[
        "Essential cookies: required for authentication, security, and core platform functionality.",
        "Preference cookies: remember your theme, language, and settings.",
        "Analytics cookies: help us understand usage and improve performance. We use privacy-respecting analytics and do not sell your data.",
      ]} />
      <LegalBlock heading="3. Managing cookies" paragraphs={[
        "You can control cookies through your browser settings. Disabling essential cookies may prevent the platform from working correctly.",
      ]} />
      <LegalBlock heading="4. Contact" paragraphs={[
        "Questions about cookies? Contact privacy@securetrackerp.com.",
      ]} />
    </LegalPage>
  );
}