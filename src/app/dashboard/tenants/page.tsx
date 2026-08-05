"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, RefreshCw, Users, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listTenants,
  createTenant,
  createCompanyUnderTenant,
  listAccessibleCompanies,
  type Tenant,
} from "@/lib/tenant";
import { APP_NAME } from "@/lib/constants";
import { toast } from "sonner";

export default function TenantsAdminPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [companies, setCompanies] = useState<Array<Record<string, unknown>>>([]);
  const [openTenant, setOpenTenant] = useState(false);
  const [openCompany, setOpenCompany] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tenantForm, setTenantForm] = useState({
    slug: "",
    name: "",
    legal_name: "",
    country_code: "UG",
    primary_currency: "UGX",
  });
  const [companyForm, setCompanyForm] = useState({
    tenant_id: "",
    name: "",
    code: "",
    company_type: "operating",
  });

  const load = async () => {
    try {
      const [t, c] = await Promise.all([
        listTenants().catch(() => [] as Tenant[]),
        auth?.user?.id
          ? listAccessibleCompanies(auth.user.id)
          : Promise.resolve([]),
      ]);
      setTenants(t);
      setCompanies(c as Array<Record<string, unknown>>);
      if (t[0] && !companyForm.tenant_id) {
        setCompanyForm((f) => ({ ...f, tenant_id: t[0].id }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth?.user?.id]);

  const saveTenant = async () => {
    if (!tenantForm.slug.trim() || !tenantForm.name.trim()) {
      toast.error("Slug and name are required");
      return;
    }
    setBusy(true);
    try {
      await createTenant(tenantForm);
      toast.success("Tenant created");
      setOpenTenant(false);
      setTenantForm({ slug: "", name: "", legal_name: "", country_code: "UG", primary_currency: "UGX" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveCompany = async () => {
    if (!companyForm.tenant_id || !companyForm.name.trim() || !companyForm.code.trim()) {
      toast.error("Tenant, name and code are required");
      return;
    }
    setBusy(true);
    try {
      await createCompanyUnderTenant(companyForm);
      toast.success("Company created under tenant");
      setOpenCompany(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading multi-tenant platform…" />;

  return (
    <div>
      <PageHeader
        title="Multi-tenant administration"
        description={`${APP_NAME} · tenants · companies · memberships · company switcher. Full estate cPanel: /platform/tenants (staff only).`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/tenants">Platform cPanel</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpenCompany(true)}>
              <Plus className="h-4 w-4 mr-1" /> Company
            </Button>
            <Button size="sm" onClick={() => setOpenTenant(true)}>
              <Plus className="h-4 w-4 mr-1" /> Tenant
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-primary/10 to-transparent p-4 mb-6 text-sm">
        <p className="font-medium">How multi-tenancy works</p>
        <p className="text-muted-foreground text-xs mt-1">
          <strong>Tenant</strong> = customer organization (SaaS isolation).{" "}
          <strong>Company</strong> = legal / operating entity under a tenant (multi-company groups).{" "}
          Users hold <strong>memberships</strong> and switch the active company in the header;
          all ERP modules filter by that company via RLS.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{tenants.length}</p>
              <p className="text-xs text-muted-foreground">Tenants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{companies.length}</p>
              <p className="text-xs text-muted-foreground">Accessible companies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Switch company</p>
              <p className="text-xs text-muted-foreground">Use the header company picker</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                      No tenants visible (run migration 00064 or elevate to platform admin).
                    </TableCell>
                  </TableRow>
                )}
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-xs">{t.plan_code || "enterprise"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{t.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your companies</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-mono text-xs">{String(c.code)}</TableCell>
                    <TableCell className="font-medium">{String(c.name)}</TableCell>
                    <TableCell className="text-xs">
                      {String(c.company_type || "operating")}
                      {c.is_primary ? " · primary" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href="/dashboard/enterprise/companies">Enterprise company master</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openTenant} onOpenChange={setOpenTenant}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug</Label>
              <Input
                placeholder="acme-corp"
                value={tenantForm.slug}
                onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Legal name</Label>
              <Input
                value={tenantForm.legal_name}
                onChange={(e) => setTenantForm({ ...tenantForm, legal_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Country</Label>
                <Input
                  value={tenantForm.country_code}
                  onChange={(e) => setTenantForm({ ...tenantForm, country_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={tenantForm.primary_currency}
                  onChange={(e) => setTenantForm({ ...tenantForm, primary_currency: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTenant(false)}>Cancel</Button>
            <Button onClick={saveTenant} disabled={busy}>Create tenant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCompany} onOpenChange={setOpenCompany}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New company under tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tenant ID</Label>
              <Input
                value={companyForm.tenant_id}
                onChange={(e) => setCompanyForm({ ...companyForm, tenant_id: e.target.value })}
                placeholder="UUID from tenants table"
              />
              {tenants[0] && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tip: {tenants[0].name} → {tenants[0].id}
                </p>
              )}
            </div>
            <div>
              <Label>Code</Label>
              <Input
                value={companyForm.code}
                onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Input
                value={companyForm.company_type}
                onChange={(e) => setCompanyForm({ ...companyForm, company_type: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCompany(false)}>Cancel</Button>
            <Button onClick={saveCompany} disabled={busy}>Create company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
