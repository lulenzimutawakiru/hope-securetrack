import type { Metadata } from "next";
import { LegalPage, LegalBlock } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "SecureTrack ERP privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="January 1, 2026">
      <LegalBlock heading="1. Introduction" paragraphs={[
        "SecureTrack ERP ('SecureTrack', 'we', 'us') provides a cloud-native enterprise resource planning platform. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our website, platform, and services.",
        "By accessing or using SecureTrack, you agree to the practices described in this policy. If you do not agree, please do not use the platform.",
      ]} />
      <LegalBlock heading="2. Information we collect" paragraphs={[
        "Account information: organization name, administrator name, work email, phone number, billing details, and authentication credentials.",
        "Usage data: login activity, feature usage, device and browser information, IP addresses, and performance metrics.",
        "Business data: the data you and your users enter into the platform, including financial, HR, inventory, and operational records. This data belongs to you and is processed on your behalf.",
      ]} />
      <LegalBlock heading="3. How we use information" paragraphs={[
        "We use information to provide, maintain, and improve the platform; to authenticate users and enforce security; to process subscriptions and payments; to provide customer support; and to comply with legal obligations.",
        "We use aggregated, de-identified data to improve product performance and reliability. We never train shared AI models on your tenant data.",
      ]} />
      <LegalBlock heading="4. Tenant isolation and data separation" paragraphs={[
        "SecureTrack is a multi-tenant platform. Every business table is protected by row-level security and tenant identifiers. Storage, search, caching, notifications, reporting, and AI context are all tenant-scoped.",
        "No tenant can access another tenant's data, and platform administrators access tenant data only through audited, authorized processes.",
      ]} />
      <LegalBlock heading="5. Data retention and security" paragraphs={[
        "We retain data for as long as your subscription is active and as required by law. You can export or delete your data at any time from the platform.",
        "We implement encryption in transit and at rest, access controls, MFA, audit logging, and automated backups to protect your information.",
      ]} />
      <LegalBlock heading="6. Your rights" paragraphs={[
        "Depending on your jurisdiction, you may have rights to access, correct, export, restrict, or delete your personal data. Contact privacy@securetrackerp.com to exercise these rights.",
        "We respond to verified requests within the timeframes required by applicable law, including GDPR and the Uganda Data Protection and Privacy Act.",
      ]} />
      <LegalBlock heading="7. Contact" paragraphs={[
        "Questions about this policy? Contact us at privacy@securetrackerp.com or write to SecureTrack ERP, Kampala, Uganda.",
      ]} />
    </LegalPage>
  );
}