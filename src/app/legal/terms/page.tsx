import type { Metadata } from "next";
import { LegalPage, LegalBlock } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "SecureTrack ERP terms of service governing the use of the platform and services.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="January 1, 2026">
      <LegalBlock heading="1. Agreement" paragraphs={[
        "These Terms of Service ('Terms') govern your access to and use of the SecureTrack ERP platform, website, and related services. By creating an account or using the platform, you agree to these Terms.",
        "If you are entering into these Terms on behalf of an organization, you represent that you have authority to bind that organization.",
      ]} />
      <LegalBlock heading="2. Accounts and subscriptions" paragraphs={[
        "You must provide accurate information when creating an account. You are responsible for safeguarding credentials and for all activity under your account.",
        "Subscriptions are governed by the plan you select. Plans may include user, storage, API, and AI usage limits. You may upgrade, downgrade, or cancel in accordance with the plan terms.",
      ]} />
      <LegalBlock heading="3. Acceptable use" paragraphs={[
        "You agree not to misuse the platform, attempt to access another tenant's data, probe or circumvent security controls, or use the platform for unlawful purposes.",
        "You are responsible for configuring permissions, maintaining the accuracy of your data, and complying with applicable laws in your jurisdiction.",
      ]} />
      <LegalBlock heading="4. Data ownership" paragraphs={[
        "You retain all rights to your business data. SecureTrack processes your data to provide the services. Upon cancellation, you can export your data during the defined grace period.",
      ]} />
      <LegalBlock heading="5. Payments and billing" paragraphs={[
        "Fees are charged according to your selected plan and billing cycle. Late or failed payments may result in suspension of services. Refunds are handled per our refund policy and applicable law.",
      ]} />
      <LegalBlock heading="6. Service availability" paragraphs={[
        "We target high availability and provide SLAs on applicable plans. The platform may experience scheduled maintenance; we provide advance notice where practical.",
      ]} />
      <LegalBlock heading="7. Limitation of liability" paragraphs={[
        "To the maximum extent permitted by law, SecureTrack is not liable for indirect, incidental, or consequential damages. Our total liability is limited to the amounts you paid in the twelve months preceding the claim.",
      ]} />
      <LegalBlock heading="8. Termination" paragraphs={[
        "You may cancel your subscription at any time. We may suspend or terminate access for violations of these Terms, with notice where feasible. On termination, you may export your data for a defined period.",
      ]} />
      <LegalBlock heading="9. Changes to these Terms" paragraphs={[
        "We may update these Terms from time to time. Material changes will be communicated in advance. Continued use of the platform after changes constitutes acceptance.",
      ]} />
      <LegalBlock heading="10. Contact" paragraphs={[
        "Questions about these Terms? Contact legal@securetrackerp.com.",
      ]} />
    </LegalPage>
  );
}