"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
// Session profile + role_permissions must use the real browser Supabase client
// (RLS + auth.uid). crud-compat requires already-resolved permissions and
// breaks the chicken-and-egg of the first auth load.
import { createClient } from "@/lib/supabase/client";
import { enrichPermissions } from "@/lib/auth/permissions";
import type { UserProfile, Role } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export interface AuthUser {
  user: User;
  profile: UserProfile;
  permissions: string[];
  tenantId: string | null;
  /** SecureTrack staff platform admin (is_platform_admin with no tenant). */
  isPlatformAdmin: boolean;
  /** Role slug for RBAC UI (e.g. super_administrator). */
  roleSlug: string | null;
}

export interface UserContextValue {
  auth: AuthUser | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
  reload: () => void;
  companyId: string | null;
  /** SecureTrack staff platform admin flag (mirrors server isPlatformAdmin). */
  isPlatformAdmin: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

/**
 * Single source of truth for the authenticated session on the client.
 *
 * Mounted once in the root layout. Resolves the profile from user_profiles
 * (the server-authoritative identity table), derives permissions from
 * role_permissions (mirroring requireApiAuth), and broadcasts the result to
 * every useUser() consumer - replacing one duplicate fetch per page.
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setAuth(null);
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*, roles!user_profiles_role_id_fkey(slug, name)")
          .eq("id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (!profile) {
          if (!cancelled) setAuth(null);
          return;
        }

        const roleSlug =
          profile.roles &&
          typeof profile.roles === "object" &&
          !Array.isArray(profile.roles)
            ? (profile.roles as { slug?: string }).slug
            : undefined;

        // Permissions resolve from role_permissions -> permissions, mirroring
        // the server-side requireApiAuth path.
        let basePermissions: string[] = [];
        const roleId = (profile as { role_id?: string | null }).role_id;
        if (roleId) {
          const { data: rolePerms } = await supabase
            .from("role_permissions")
            .select("permissions(slug)")
            .eq("role_id", roleId);
          basePermissions =
            rolePerms
              ?.map((rp) => {
                const p = rp.permissions as unknown as { slug?: string } | null;
                return p?.slug;
              })
              .filter((s): s is string => Boolean(s)) ?? [];
        }

        // Staff platform admin = flagged AND tenant-less (mirrors requireApiAuth).
        const isStaffPlatformAdmin =
          Boolean((profile as { is_platform_admin?: boolean }).is_platform_admin) &&
          !(profile as { tenant_id?: string | null }).tenant_id;

        const permissions = enrichPermissions(
          basePermissions,
          roleSlug,
          isStaffPlatformAdmin
        );

        const activeCompanyId =
          (profile.active_company_id as string | undefined) ||
          (profile.company_id as string);

        const tenantId = (profile.tenant_id as string | null) ?? null;

        const normalizedProfile = {
          ...(profile as unknown as UserProfile),
          company_id: activeCompanyId,
          tenant_id: tenantId,
          roles: (profile.roles as unknown as Role) ?? null,
          permissions,
        };

        if (!cancelled) {
          setAuth({
            user,
            profile: normalizedProfile,
            permissions,
            tenantId,
            isPlatformAdmin: isStaffPlatformAdmin,
            roleSlug: roleSlug ?? null,
          });
        }
      } catch {
        if (!cancelled) setAuth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const value = useMemo<UserContextValue>(
    () => ({
      auth,
      loading,
      hasPermission: (permission: string) =>
        auth?.permissions.includes(permission) ?? false,
      hasAnyPermission: (perms: string[]) =>
        perms.some((p) => auth?.permissions.includes(p)),
      reload,
      companyId:
        (auth?.profile as unknown as { active_company_id?: string } | undefined)
          ?.active_company_id ||
        auth?.profile?.company_id ||
        null,
      isPlatformAdmin: auth?.isPlatformAdmin ?? false,
    }),
    [auth, loading, reload]
  );

  return (
    <UserContext.Provider value={value}>{children}</UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a <UserProvider>");
  }
  return ctx;
}
