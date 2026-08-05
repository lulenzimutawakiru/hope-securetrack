"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  RefreshCw,
  Search,
  Plus,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { COUNTRY_DEFAULTS } from "@/lib/platform/onboarding";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan_code?: string | null;
  country_code?: string | null;
  primary_contact_email?: string | null;
  company_count?: number;
  user_count?: number;
  subscription_status?: string | null;
  created_at?: string | null;
};

const emptyCreate = {
  organization_name: "",
  admin_email: "",
  admin_name: "Administrator",
  admin_password: "",
  country_code: "UG",
  plan_code: "starter",
  slug: "",
  industry: "Manufacturing",
  language: "en",
  data_region: "eu-west-1",
  timezone: "",
  compliance: [] as string[],
};

export default function PlatformTenantsPage() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyCreate);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "all") qs.set("status", status);
      qs.set("limit", "300");
      const res = await fetch(`/api/platform/tenants?${qs}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load tenants");
      }
      setTenants(json.data?.tenants ?? json.tenants ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const quickStatus = async (id: string, action: "activate" | "suspend") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/platform/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason:
            action === "suspend"
              ? "Suspended from platform cPanel"
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Action failed");
      }
      toast.success(action === "suspend" ? "Tenant suspended" : "Tenant activated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const createTenant = async () => {
    if (!form.organization_name.trim() || !form.admin_email.trim()) {
      toast.error("Organization name and admin email are required");
      return;
    }
    if (!form.admin_password || form.admin_password.length < 10) {
      toast.error("Admin password must be at least 10 characters (with complexity)");
      return;
    }
    setCreating(true);
    try {
      const locale = COUNTRY_DEFAULTS[form.country_code];
      const currency = locale?.currency || "UGX";
      const timezone =
        form.timezone || locale?.timezone || "UTC";
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: form.organization_name.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          admin_name: form.admin_name.trim() || "Administrator",
          admin_password: form.admin_password,
          country_code: form.country_code,
          currency,
          timezone,
          plan_code: form.plan_code,
          slug: form.slug.trim() || undefined,
          industry: form.industry,
          language: form.language,
          data_region: form.data_region,
          compliance_requirements: form.compliance,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Create failed");
      }
      if (json.data?.encryption_secret_once) {
        window.prompt(
          "VAULT THIS TENANT ENCRYPTION KEY NOW (shown once):",
          json.data.encryption_secret_once
        );
      }
      toast.success(
        `Tenant ready${json.data?.domain ? `: ${json.data.domain}` : json.data?.slug ? `: ${json.data.slug}` : ""}`
      );
      setCreateOpen(false);
      setForm(emptyCreate);
      await load();
      if (json.data?.tenantId) {
        window.location.href = `/platform/tenants/${json.data.tenantId}`;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteTenant = async (t: TenantRow) => {
    const ok = window.confirm(
      `Soft-delete tenant "${t.name}" (${t.slug})?\n\nThis cancels access. Hard purge is available on the tenant detail page.`
    );
    if (!ok) return;
    setBusyId(t.id);
    try {
      const res = await fetch(
        `/api/platform/tenants/${t.id}?reason=${encodeURIComponent("Deleted from directory")}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Delete failed");
      }
      toast.success("Tenant deleted (soft)");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && tenants.length === 0) {
    return <LoadingState message="Loading tenant directory…" />;
  }

  return (
    <div>
      <PageHeader
        title="Tenant directory"
        description="Create · view · update · delete every organization on SecureTrack ERP"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create tenant
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, slug, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={load}>
          Apply
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cos</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/platform/tenants/${t.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {t.slug}
                    {t.country_code ? ` · ${t.country_code}` : ""}
                  </p>
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {t.plan_code || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      t.status === "active"
                        ? "secondary"
                        : t.status === "suspended"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-[10px] capitalize"
                  >
                    {t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs">
                  {t.company_count ?? 0}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {t.user_count ?? 0}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[10rem] truncate">
                  {t.primary_contact_email || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 flex-wrap">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/platform/tenants/${t.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {t.status !== "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === t.id}
                        onClick={() => quickStatus(t.id, "activate")}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === t.id}
                        onClick={() => quickStatus(t.id, "suspend")}
                      >
                        Suspend
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === t.id}
                      onClick={() => deleteTenant(t)}
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No tenants match this filter. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Organization name</Label>
              <Input
                value={form.organization_name}
                onChange={(e) =>
                  setForm({ ...form, organization_name: e.target.value })
                }
                placeholder="Acme Manufacturing Ltd"
              />
            </div>
            <div>
              <Label>Slug (optional)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-from-name"
              />
            </div>
            <div>
              <Label>Admin name</Label>
              <Input
                value={form.admin_name}
                onChange={(e) =>
                  setForm({ ...form, admin_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Admin email</Label>
              <Input
                type="email"
                value={form.admin_email}
                onChange={(e) =>
                  setForm({ ...form, admin_email: e.target.value })
                }
                placeholder="admin@acme.com"
              />
            </div>
            <div>
              <Label>Admin password</Label>
              <Input
                type="password"
                minLength={10}
                value={form.admin_password}
                onChange={(e) =>
                  setForm({ ...form, admin_password: e.target.value })
                }
                placeholder="Min 10 chars · upper · number · special"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Select
                value={form.industry}
                onValueChange={(v) => setForm({ ...form, industry: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Manufacturing",
                    "Healthcare",
                    "Government",
                    "Banking",
                    "Telecom",
                    "Education",
                    "Retail",
                    "Logistics",
                    "Other",
                  ].map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Country</Label>
                <Select
                  value={form.country_code}
                  onValueChange={(v) => setForm({ ...form, country_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COUNTRY_DEFAULTS).map(([code, d]) => (
                      <SelectItem key={code} value={code}>
                        {d.countryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select
                  value={form.plan_code}
                  onValueChange={(v) => setForm({ ...form, plan_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm({ ...form, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="sw">Swahili</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data region</Label>
                <Select
                  value={form.data_region}
                  onValueChange={(v) => setForm({ ...form, data_region: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eu-west-1">EU West</SelectItem>
                    <SelectItem value="af-south-1">Africa South</SelectItem>
                    <SelectItem value="us-east-1">US East</SelectItem>
                    <SelectItem value="ap-south-1">Asia South</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Compliance (comma codes)</Label>
              <Input
                placeholder="gdpr, iso27001, soc2"
                value={form.compliance.join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compliance: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Workflow: Tenant → namespace → roles → admin → modules → branding →
              welcome email → ready. Generates tenant ID, domain, encryption key
              (vault once), and isolation controls (tenant/company/branch).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTenant} disabled={creating}>
              {creating ? "Creating…" : "Create tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
