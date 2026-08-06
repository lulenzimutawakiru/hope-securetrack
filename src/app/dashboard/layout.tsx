import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePlatformRole } from "@/lib/platform/staff";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/** Dashboard is fully dynamic — avoid static generation of 900+ ERP routes (OOM on 8GB builders). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SecureTrack staff operate the Control Plane (/platform), never the
  // tenant ERP. Redirect before the shell renders to avoid NO_TENANT errors.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_platform_admin, tenant_id, platform_role")
      .eq("id", user.id)
      .maybeSingle();
    if (resolvePlatformRole(profile)) {
      redirect("/platform");
    }
  }
  return <DashboardShell>{children}</DashboardShell>;
}
