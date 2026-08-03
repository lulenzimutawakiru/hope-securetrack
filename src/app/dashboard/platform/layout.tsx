import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * SecureTrack platform control plane is restricted to SecureTrack staff.
 *
 * The database enforces this via is_platform_admin() (flagged profile with
 * no tenant) and the API layer via requireApiAuth. This layout is the
 * defense-in-depth page gate: tenant users (including tenant super admins)
 * are redirected before any platform page mounts.
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
    redirect("/login");
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

  return <>{children}</>;
}