"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WorkspaceTabs } from "@/components/enterprise/workspace-tabs";
import { OfflineBanner } from "@/components/enterprise/offline-banner";
import { ServiceWorkerRegister } from "@/components/enterprise/service-worker-register";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="enterprise-shell flex h-[100dvh] overflow-hidden bg-background">
      <ServiceWorkerRegister />
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <OfflineBanner />
        <WorkspaceTabs />
        <main className="enterprise-main has-mobile-nav md:!pb-6 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
