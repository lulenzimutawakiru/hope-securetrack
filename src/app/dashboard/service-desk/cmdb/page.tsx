"use client";

import { useEffect, useState } from "react";
import { Database, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { CI_TYPES, createCmdbCi } from "@/lib/service-desk";

export default function CmdbPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [rels, setRels] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ci_type: "server",
    location_name: "",
    asset_tag: "",
    serial_number: "",
    manufacturer: "",
    model: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: r }] = await Promise.all([
      supabase.from("sd_cmdb_cis").select("*").is("deleted_at", null).order("ci_number"),
      supabase.from("sd_cmdb_relations").select("*, parent:parent_ci_id(ci_number,name), child:child_ci_id(ci_number,name)").limit(50),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setRels((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createCmdbCi({ company_id: companyId, ...form });
      toast.success("CI created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading CMDB…" />;

  const byType: Record<string, number> = {};
  for (const r of rows) {
    const t = String(r.ci_type);
    byType[t] = (byType[t] || 0) + 1;
  }

  return (
    <div>
      <PageHeader
        title="Configuration Management (CMDB)"
        description="Devices · servers · apps · databases · relationships · ownership"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add CI</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>New configuration item</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.ci_type} onValueChange={(v) => setForm((f) => ({ ...f, ci_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CI_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Asset tag</Label>
                      <Input value={form.asset_tag} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Serial</Label>
                      <Input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Manufacturer</Label>
                      <Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="CIs" value={String(rows.length)} icon={Database} />
        {Object.entries(byType).slice(0, 3).map(([t, n]) => (
          <StatCard key={t} title={t} value={String(n)} icon={Database} />
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No CIs" description="Register infrastructure configuration items." />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CI #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.ci_number)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.ci_type)}</TableCell>
                  <TableCell className="text-sm">{String(r.location_name || "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.asset_tag || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Relationships</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Relation</TableHead>
                  <TableHead>Child</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rels.map((r) => {
                  const p = r.parent as { ci_number?: string; name?: string } | null;
                  const c = r.child as { ci_number?: string; name?: string } | null;
                  return (
                    <TableRow key={String(r.id)}>
                      <TableCell className="text-sm">{p?.name || p?.ci_number}</TableCell>
                      <TableCell className="text-xs capitalize">{String(r.relation_type).replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm">{c?.name || c?.ci_number}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
