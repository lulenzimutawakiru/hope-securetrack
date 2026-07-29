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

/** Super-admin extras so nav stays full even if role_permissions seed lags */
const SUPER_ADMIN_EXTRAS = [
  "dashboard.view",
  "sales.view",
  "sales.manage",
  "invoices.view",
  "invoices.manage",
  "dispatch.view",
  "dispatch.manage",
  "dsp.view",
  "dsp.manage",
  "dsp.operate",
  "dsp.approve",
  "dsp.ai",
  "dsp.track",
  "hr.view",
  "hr.manage",
  "printers.manage",
  "wfm.view",
  "wfm.manage",
  "wfm.approve",
  "wfm.field",
  "wfm.safety",
  "sales.pipeline",
  "sales.quotes",
  "sales.credit",
  "sales.returns",
  "sales.commissions",
  "sales.pricing",
  "sales.contracts",
  "sales.forecast",
  "sales.ai",
  "sales.admin",
  "lbl.view",
  "lbl.manage",
  "lbl.design",
  "lbl.print",
  "lbl.approve",
  "lbl.security",
  "lbl.ai",
  "lbl.admin",
  "printing.create",
  "printing.manage",
  "printing.reprint",
  "crm.view",
  "crm.manage",
  "crm.marketing",
  "crm.service",
  "crm.leads",
  "crm.opportunities",
  "crm.ai",
  "crm.portal",
  "crm.credit",
  "crm.admin",
  "crm.export",
  "iam.view",
  "iam.manage",
  "iam.security",
  "iam.sessions",
  "iam.approvals",
  "finance.view",
  "finance.manage",
  "finance.post",
  "finance.approve",
  "finance.bank",
  "finance.tax",
  "finance.close",
  "finance.ai",
  "finance.cfo",
  "finance.costing",
  "finance.treasury",
  "finance.consolidate",
  "finance.admin",
  "inventory.view",
  "inventory.grn",
  "inventory.qc",
  "inventory.transfer",
  "inventory.adjust",
  "inventory.valuation",
  "procurement.view",
  "procurement.manage",
  "procurement.approve",
  "procurement.suppliers",
  "srm.view",
  "srm.manage",
  "srm.approve",
  "srm.contracts",
  "srm.quality",
  "srm.ai",
  "srm.portal",
  "srm.admin",
  "logistics.view",
  "logistics.manage",
  "scm.view",
  "scm.manage",
  "scm.sop",
  "scm.risk",
  "hr.payroll",
  "hr.recruit",
  "hr.performance",
  "hr.training",
  "hr.self",
  "settings.view",
  "settings.manage",
  "settings.branding",
  "settings.integrations",
  "settings.sequences",
  "settings.workflows",
  "reports.view",
  "reports.export",
  "reports.manage",
  "reports.dashboards",
  "reports.kpis",
  "reports.ai",
  "reports.regulatory",
  "reports.documents",
  "reports.schedule",
  "reports.intelligence",
  "reports.search",
  "reports.assistant",
  "reports.dwh",
  "reports.classify",
  "notifications.view",
  "notifications.manage",
  "notifications.send",
  "profile.view",
  "profile.manage",
  "profile.self",
  "profile.manager",
  "profile.payroll",
  "profile.documents",
  "profile.security",
  "profile.analytics",
  "profile.ai",
  "billing.view",
  "billing.manage",
  "wid.view",
  "wid.manage",
  "intg.view",
  "intg.manage",
  "mes.view",
  "mes.manage",
  "mes.operate",
  "mes.quality",
  "mes.plan",
  "mes.cost",
  "mes.admin",
  "mes.ai",
  "production.view",
  "production.manage",
  "production.create",
  "production.approve",
  "sd.view",
  "sd.manage",
  "sd.agent",
  "sd.admin",
  "sd.knowledge",
  "sd.change",
  "sd.ai",
  "sd.portal",
  "sd.approve",
  "sd.major",
  "sd.field",
  "hc.view",
  "hc.manage",
  "hc.meetings",
  "hc.announce",
  "hc.ai",
  "hc.admin",
  "iam.provision",
  "iam.import",
  "iam.roles",
  "iam.abac",
  "iam.password",
  "iam.mfa",
  "iam.governance",
  "uw.view",
  "uw.manage",
  "uw.merge",
  "uw.admin",
  "di.view",
  "di.manage",
  "di.provision",
  "di.org",
  "di.clearance",
  "di.cards",
  "di.biometrics",
  "di.admin",
  "di.ai",
  "ec.view",
  "ec.manage",
  "ec.structure",
  "ec.governance",
  "ec.documents",
  "ec.risk",
  "ec.admin",
  "ec.ai",
  "comm.view",
  "comm.manage",
  "comm.broadcast",
  "comm.templates",
  "comm.admin",
  "comm.ai",
  "media.view",
  "media.upload",
  "media.manage",
  "fleet.view",
  "fleet.manage",
  "fleet.drivers",
  "fleet.fuel",
  "fleet.maintenance",
  "fleet.dispatch",
  "fleet.track",
  "fleet.approve",
  "fleet.ai",
  "fleet.admin",
  "finance.fpa",
  "finance.tax.manage",
  "finance.multibook",
  "ppm.view",
  "ppm.manage",
  "ppm.plan",
  "ppm.execute",
  "ppm.finance",
  "ppm.approve",
  "ppm.portal",
  "ppm.ai",
  "ppm.admin",
  "att.view",
  "att.manage",
  "att.clock",
  "att.approve",
  "att.devices",
  "att.field",
  "att.ai",
  "att.admin",
  "notifications.view",
  "notifications.manage",
  "notifications.send",
  "users.view",
  "users.manage",
  "brand.view",
  "brand.manage",
  "brand.design",
  "brand.approve",
  "brand.publish",
  "brand.ai",
  "brand.assets",
  "payroll.view",
  "payroll.manage",
  "payroll.process",
  "payroll.approve",
  "payroll.pay",
  "payroll.self",
  "payroll.ai",
  "payroll.tax",
  "print.view",
  "print.manage",
  "print.submit",
  "print.operate",
  "print.design",
  "print.security",
  "print.admin",
  "print.ai",
  "printing.create",
  "printing.manage",
  "printing.reprint",
  "pkg.view",
  "pkg.manage",
  "pkg.operate",
  "pkg.approve",
  "pkg.ai",
  "packing.create",
  "ast.view",
  "ast.manage",
  "ast.assign",
  "ast.audit",
  "ast.print",
  "ast.ai",
  "eal.view",
  "eal.manage",
  "eal.investigate",
  "eal.export",
  "eal.ai",
  "eal.compliance",
  "eal.executive",
  "eal.security",
  "eal.infra",
  "eal.archive",
  "eal.config",
  "audit.view",
  "audit.manage",
  "qr.view",
  "products.view",
  "verification.view",
  "fraud.manage",
  "distributors.view",
];

function enrichPermissions(base: string[], roleSlug: string | undefined | null): string[] {
  let permissions = [...base];
  if (
    roleSlug === "super_administrator" ||
    permissions.includes("settings.manage") ||
    permissions.length === 0
  ) {
    permissions = Array.from(new Set([...permissions, ...SUPER_ADMIN_EXTRAS]));
  }
  // Always ensure dashboard is visible once authenticated with a profile
  if (!permissions.includes("dashboard.view")) {
    permissions = [...permissions, "dashboard.view"];
  }
  return permissions;
}

async function loadProfileAndRole(userId: string) {
  const supabase = createClient();

  // Explicit FK — roles.created_by also references user_profiles, so bare
  // roles(*) is ambiguous (PGRST201) and left auth null → empty sidebar.
  const { data: embedded, error: embedErr } = await supabase
    .from("user_profiles")
    .select("*, roles!user_profiles_role_id_fkey(*)")
    .eq("id", userId)
    .maybeSingle();

  if (!embedErr && embedded) {
    return {
      profile: embedded as Record<string, unknown>,
      role: (embedded.roles as Role | null) ?? null,
    };
  }

  // Fallback: two-step load (works even if FK hint name differs)
  const { data: bare, error: bareErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (bareErr || !bare) {
    return { profile: null, role: null };
  }

  let role: Role | null = null;
  if (bare.role_id) {
    const { data: roleRow } = await supabase
      .from("roles")
      .select("*")
      .eq("id", bare.role_id)
      .maybeSingle();
    role = (roleRow as Role | null) ?? null;
  }

  return {
    profile: { ...bare, roles: role } as Record<string, unknown>,
    role,
  };
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

        const { profile, role } = await loadProfileAndRole(user.id);
        if (!profile) {
          setAuth(null);
          return;
        }

        const roleId = profile.role_id as string | undefined;
        const { data: rolePerms } = roleId
          ? await supabase
              .from("role_permissions")
              .select("permissions(slug)")
              .eq("role_id", roleId)
          : { data: null };

        const base =
          rolePerms
            ?.map((rp) => {
              const p = rp.permissions as unknown as { slug: string } | null;
              return p?.slug;
            })
            .filter((s): s is string => Boolean(s)) ?? [];

        const permissions = enrichPermissions(base, role?.slug);

        setAuth({
          user,
          profile: {
            ...(profile as unknown as UserProfile),
            roles: role as Role,
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
