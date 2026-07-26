"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, Role } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export interface AuthUser {
  user: User;
  profile: UserProfile;
  permissions: string[];
}

export function useUser() {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuth(null);
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("*, roles(*)")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setAuth(null);
          return;
        }

        const { data: rolePerms } = await supabase
          .from("role_permissions")
          .select("permissions(slug)")
          .eq("role_id", profile.role_id);

        let permissions =
          rolePerms
            ?.map((rp) => {
              const p = rp.permissions as unknown as { slug: string } | null;
              return p?.slug;
            })
            .filter((s): s is string => Boolean(s)) ?? [];

        // Super admin / empty role_permissions edge case: show full nav
        const roleSlug = (profile.roles as Role | null)?.slug;
        if (
          roleSlug === "super_administrator" ||
          permissions.includes("settings.manage")
        ) {
          // ensure new modules visible even if seed lag
          const extras = [
            "sales.view",
            "sales.manage",
            "invoices.view",
            "invoices.manage",
            "dispatch.view",
            "dispatch.manage",
            "hr.view",
            "hr.manage",
            "printers.manage",
          ];
          permissions = Array.from(new Set([...permissions, ...extras]));
        }

        setAuth({
          user,
          profile: {
            ...profile,
            roles: profile.roles as Role,
            permissions,
          },
          permissions,
        });
      } catch {
        setAuth(null);
      } finally {
        setLoading(false);
      }
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasPermission = (permission: string) =>
    auth?.permissions.includes(permission) ?? false;

  const hasAnyPermission = (perms: string[]) =>
    perms.some((p) => auth?.permissions.includes(p));

  return { auth, loading, hasPermission, hasAnyPermission };
}
