"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import {
  listAccessibleCompanies,
  switchActiveCompany,
} from "@/lib/tenant";
import { toast } from "sonner";

type CompanyRow = {
  id: string;
  name: string;
  code: string;
  is_primary?: boolean | null;
  company_type?: string | null;
  base_currency?: string | null;
};

export function TenantSwitcher() {
  const { auth, reload } = useUser();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeId =
    (auth?.profile as { active_company_id?: string | null } | undefined)
      ?.active_company_id ||
    auth?.profile?.company_id ||
    null;

  const load = useCallback(async () => {
    if (!auth?.user?.id) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listAccessibleCompanies(auth.user.id);
      setCompanies(rows as CompanyRow[]);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const active = companies.find((c) => c.id === activeId) || companies[0];

  const onSwitch = async (companyId: string) => {
    if (companyId === activeId || busy) return;
    setBusy(true);
    try {
      await switchActiveCompany(companyId);
      toast.success("Company context switched");
      await reload?.();
      // Full reload so all module queries re-bind to new company RLS context
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch company");
      setBusy(false);
    }
  };

  if (loading || !auth) {
    return (
      <Button variant="outline" size="sm" className="h-8 gap-1.5 max-w-[12rem]" disabled>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline text-xs">Company</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 max-w-[14rem] sm:max-w-[18rem]"
          disabled={busy}
          aria-label="Switch company"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">
            {active?.name || "Select company"}
          </span>
          {companies.length > 1 && (
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Active company</span>
          <Badge variant="secondary" className="text-[10px]">
            Multi-tenant
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No companies available. Contact your tenant administrator.
          </div>
        )}
        {companies.map((c) => {
          const selected = c.id === activeId;
          return (
            <DropdownMenuItem
              key={c.id}
              onClick={() => onSwitch(c.id)}
              className="flex items-start gap-2 cursor-pointer"
            >
              <Check
                className={`h-4 w-4 mt-0.5 shrink-0 ${selected ? "opacity-100 text-primary" : "opacity-0"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {c.code}
                  {c.company_type ? ` · ${c.company_type}` : ""}
                  {c.base_currency ? ` · ${c.base_currency}` : ""}
                  {c.is_primary ? " · primary" : ""}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.href = "/dashboard/enterprise/companies";
          }}
          className="text-xs text-muted-foreground"
        >
          Manage companies…
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            window.location.href = "/dashboard/tenants";
          }}
          className="text-xs text-muted-foreground"
        >
          Tenant administration…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
