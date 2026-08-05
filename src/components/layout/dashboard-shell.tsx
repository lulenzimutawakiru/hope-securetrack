"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WorkspaceTabs } from "@/components/enterprise/workspace-tabs";
import { OfflineBanner } from "@/components/enterprise/offline-banner";
import { ServiceWorkerRegister } from "@/components/enterprise/service-worker-register";
import { MfaEnforcementBanner } from "@/components/security/mfa-enforcement-banner";
import { DashboardRbacGuard } from "@/components/security/dashboard-rbac-guard";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { OnboardingBanner } from "@/components/platform/onboarding-banner";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="enterprise-shell flex h-[100dvh] overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <ServiceWorkerRegister />
      <div className="hidden md:flex" aria-label="Primary navigation">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <MfaEnforcementBanner />
        <OnboardingBanner />
        <OfflineBanner />
        <WorkspaceTabs />
        <main
          id="main-content"
          tabIndex={-1}
          className="enterprise-main has-mobile-nav md:!pb-6 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8 outline-none"
        >
          <div className="mx-auto w-full max-w-content">
            <Breadcrumbs className="mb-3" />
            <DashboardRbacGuard>{children}</DashboardRbacGuard>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
