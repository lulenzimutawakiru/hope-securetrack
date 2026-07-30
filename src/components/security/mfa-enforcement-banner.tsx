"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const PRIVILEGED = new Set([
  "super_administrator",
  "managing_director",
  "finance_manager",
  "hr_manager",
  "payroll_officer",
  "auditor",
]);

/**
 * Surfaces MFA enrollment requirement for privileged users.
 * Hard API enforcement is controlled by MFA_ENFORCE_PRIVILEGED env.
 */
export function MfaEnforcementBanner() {
  const { auth } = useUser();
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function check() {
      if (!auth?.user?.id) {
        setShow(false);
        return;
      }
      const slug = auth.profile?.roles?.slug;
      const privileged =
        (slug ? PRIVILEGED.has(slug) : false) ||
        Boolean((auth.profile as { is_platform_admin?: boolean })?.is_platform_admin);
      if (!privileged) {
        setShow(false);
        return;
      }
      try {
        const { data } = await createClient()
          .from("user_profiles")
          .select("mfa_enabled,require_mfa,mfa_enforced")
          .eq("id", auth.user.id)
          .maybeSingle();
        const needs =
          Boolean(data?.require_mfa || data?.mfa_enforced) && !Boolean(data?.mfa_enabled);
        setShow(needs || (privileged && !data?.mfa_enabled));
      } catch {
        setShow(privileged);
      }
    }
    check();
  }, [auth?.user?.id, auth?.profile?.roles?.slug]);

  if (!show) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm sm:px-4">
        <div className="flex items-start gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm">
            <strong>Security:</strong> Multi-factor authentication is required for your privileged
            role. Enable MFA before high-risk actions (payroll, finance, identity) are blocked in
            production.
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 border-amber-600/50" asChild>
          <Link href="/dashboard/identity/self-service">Enable MFA</Link>
        </Button>
      </div>
    </div>
  );
}
