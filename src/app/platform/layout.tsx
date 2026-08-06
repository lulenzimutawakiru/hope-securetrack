import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/platform/platform-shell";
import { resolvePlatformRole } from "@/lib/platform/staff";

/**
 * SecureTrack Enterprise Control Plane (OS administration layer).
 *
 * Completely separated from tenant ERP (/dashboard). Three layers:
 *   1. Platform Administration
 *   2. Tenant Administration
 *   3. Company Administration
 *
 * Restricted to SecureTrack staff (is_platform_admin + no tenant).
 * Granular staff roles (owner/cto/security/devops/compliance) are resolved
 * here and passed to the shell, which enforces the Access Matrix per route
 * and filters navigation. Data endpoints enforce the same matrix server-side.
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
    .select("is_platform_admin, tenant_id, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  const staff = resolvePlatformRole(profile);

  if (!staff) {
    redirect("/dashboard");
  }

  return (
    <PlatformShell
      staffRole={staff.role}
      staffRoleLabel={staff.label}
      isLegacyRole={staff.isLegacy}
    >
      {children}
    </PlatformShell>
  );
}
