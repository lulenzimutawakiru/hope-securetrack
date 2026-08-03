"use client";

import {
  useUserContext,
  type AuthUser,
} from "@/components/providers/user-provider";

export type { AuthUser };

/**
 * Client auth hook backed by the shared UserProvider mounted in the root
 * layout. The public API is unchanged:
 *   { auth, loading, hasPermission, hasAnyPermission, reload, companyId }
 * A single provider fetches the profile + permissions once per session and
 * broadcasts updates to every consumer, replacing per-page duplicate fetches.
 */
export function useUser() {
  return useUserContext();
}
