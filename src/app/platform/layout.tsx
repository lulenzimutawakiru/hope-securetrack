import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/platform/platform-shell";

/**
 * SecureTrack Enterprise Control Plane (OS administration layer).
 *
 * Completely separated from tenant ERP (/dashboard). Three layers:
 *   1. Platform Administration
 *   2. Tenant Administration
 *   3. Company Administration
 *
 * Restricted to SecureTrack staff (is_platform_admin + no tenant).
 * Tenant super admins are redirected to the ERP dashboard.
 */
export const dynamic = "force-dynamic";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/platform");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_platform_admin, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const isStaffPlatformAdmin =
    Boolean(profile?.is_platform_admin) && !profile?.tenant_id;

  if (!isStaffPlatformAdmin) {
    redirect("/dashboard");
  }

  return <PlatformShell>{children}</PlatformShell>;
}
