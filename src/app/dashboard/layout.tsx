import { DashboardShell } from "@/components/layout/dashboard-shell";

/** Dashboard is fully dynamic — avoid static generation of 900+ ERP routes (OOM on 8GB builders). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
