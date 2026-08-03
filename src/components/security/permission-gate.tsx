"use client";

import { ShieldAlert } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";

/**
 * Client-side authorization gate.
 *
 * Rendering-level gating only - the server API routes and the CRUD engine
 * remain the source of truth. Use when a section of a page must be hidden
 * (or replaced with a fallback) for roles without the permission.
 */
export function PermissionGate({
  permission,
  anyOf,
  children,
  fallback,
}: {
  /** Require this single permission slug (e.g. "finance.post"). */
  permission?: string;
  /** Require any one of these permission slugs. */
  anyOf?: string[];
  children: React.ReactNode;
  /** Custom fallback when access is denied. */
  fallback?: React.ReactNode;
}) {
  const { loading, hasPermission, hasAnyPermission } = useUser();

  if (loading) {
    return <LoadingState message="Checking permissions..." />;
  }

  const allowed = permission
    ? hasPermission(permission)
    : anyOf
      ? hasAnyPermission(anyOf)
      : true;

  if (allowed) return <>{children}</>;

  return (
    (fallback ?? (
      <EmptyState
        icon={ShieldAlert}
        title="Access restricted"
        description="Your role does not include permission for this area. Contact an administrator if you believe this is a mistake."
      />
    ))
  );
}
