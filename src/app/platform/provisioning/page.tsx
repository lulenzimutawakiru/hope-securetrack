"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { listProvisioningJobs, type ProvisioningJob } from "@/lib/platform";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ProvisioningPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<ProvisioningJob[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    organization_name: "",
    admin_email: "",
    admin_name: "Administrator",
    admin_password: "",
    plan_code: "enterprise",
    country_code: "UG",
    currency: "UGX",
  });

  const load = async () => {
    setLoading(true);
    try {
      setJobs(await listProvisioningJobs(100));
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const provision = async () => {
    if (!form.organization_name || !form.admin_email) {
      toast.error("Organization and admin email required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/public/platform/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || "Failed");
      toast.success(`Provisioned ${form.organization_name}`);
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Provision failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading provisioning jobs…" />;

  return (
    <div>
      <PageHeader
        title="Tenant provisioning"
        description="Auto-create tenant · company · branch · admin · roles · modules · subscription · wizard"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New tenant
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-mono text-xs">{j.job_code}</TableCell>
                <TableCell className="font-medium">{j.organization_name}</TableCell>
                <TableCell className="text-xs">{j.admin_email}</TableCell>
                <TableCell className="text-xs">{j.plan_code || "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={j.status === "completed" ? "secondary" : j.status === "failed" ? "destructive" : "default"}
                    className="text-[10px]"
                  >
                    {j.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {j.created_at ? new Date(j.created_at).toLocaleString() : ""}
                </TableCell>
              </TableRow>
            ))}
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No jobs yet. Provision a new SaaS tenant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-provision tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Organization</Label>
              <Input
                value={form.organization_name}
                onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Admin email</Label>
              <Input
                type="email"
                value={form.admin_email}
                onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Admin name</Label>
              <Input
                value={form.admin_name}
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Temp password</Label>
              <Input
                type="password"
                value={form.admin_password}
                onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <Label>Plan</Label>
              <Select
                value={form.plan_code}
                onValueChange={(v) => setForm({ ...form, plan_code: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={provision} disabled={busy}>
              {busy ? "Provisioning…" : "Provision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
