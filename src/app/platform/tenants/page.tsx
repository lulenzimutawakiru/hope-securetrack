"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  RefreshCw,
  Search,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";

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

export default function PlatformTenantsPage() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (loading && tenants.length === 0) {
    return <LoadingState message="Loading tenant directory…" />;
  }

  return (
    <div>
      <PageHeader
        title="Tenant directory"
        description="cPanel for every organization on SecureTrack ERP — lifecycle, plan, users, modules"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" asChild>
              <Link href="/platform/provisioning">
                <Sparkles className="h-4 w-4 mr-1" /> Provision
              </Link>
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
                  <div className="flex justify-end gap-1">
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
                  No tenants match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
