"use client";

/**
 * Enforces RBAC on dashboard / platform deep links.
 * Sidebar hides links; this blocks direct URL access without the permission.
 * APIs and CRUD engine remain the server-side authority for data mutations.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import {
  canAccessRoute,
  routeAccessDenial,
} from "@/lib/auth/rbac";

export function DashboardRbacGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/dashboard";
  const { auth, loading, isPlatformAdmin } = useUser();

  if (loading) {
    return <LoadingState message="Checking access…" />;
  }

  // Not signed in — middleware should redirect; fail closed here
  if (!auth) {
    return (
      <AccessDenied
        title="Sign in required"
        description="Your session is missing or expired. Sign in to continue."
        required={[]}
      />
    );
  }

  const allowed = canAccessRoute(auth.permissions, pathname, {
    isPlatformAdmin: isPlatformAdmin || auth.isPlatformAdmin,
    isSuperAdmin: auth.roleSlug === "super_administrator",
  });


  if (allowed) return <>{children}</>;

  const denial = routeAccessDenial(pathname);
  return (
    <AccessDenied
      title={denial.title}
      description={denial.description}
      required={denial.required}
    />
  );
}

function AccessDenied({
  title,
  description,
  required,
}: {
  title: string;
  description: string;
  required: string[];
}) {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-16 text-center"
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {required.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-1.5 text-xs">
          {required.map((p) => (
            <li
              key={p}
              className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono"
            >
              {p}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="default" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/settings/profile">My profile</Link>
        </Button>
      </div>
    </div>
  );
}
