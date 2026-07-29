"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { assignAsset, unassignAsset, ASSIGNMENT_TYPES } from "@/lib/assets";

export default function AssetAssignPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    assignee_name: "",
    assignment_type: "employee",
    department: "",
    expected_return: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: assigns }, { data: ast }] = await Promise.all([
      sb.from("ast_assignments").select("*, ast_assets(asset_tag, name)").order("assigned_at", { ascending: false }).limit(200),
      sb.from("ast_assets").select("id, asset_tag, name, status").is("deleted_at", null).order("asset_tag").limit(300),
    ]);
    setRows((assigns as Array<Record<string, unknown>>) || []);
    setAssets((ast as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.asset_id) return;
    try {
      await assignAsset({
        company_id: companyId,
        asset_id: form.asset_id,
        assignee_name: form.assignee_name,
        assignment_type: form.assignment_type,
        department: form.department || undefined,
        expected_return: form.expected_return || undefined,
        created_by: userId,
      });
      toast.success("Asset assigned");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const returnAsset = async (assetId: string) => {
    if (!companyId) return;
    try {
      await unassignAsset({ company_id: companyId, asset_id: assetId, actor_id: userId });
      toast.success("Returned");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading assignments…" />;

  return (
    <div>
      <PageHeader
        title="Asset Assignments"
        description="Employee · department · branch · warehouse · vehicle · project"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserCheck className="h-4 w-4 mr-1" /> Assign</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Assign asset</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Asset</Label>
                    <Select value={form.asset_id} onValueChange={(v) => setForm((f) => ({ ...f, asset_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                      <SelectContent>
                        {assets.map((a) => (
                          <SelectItem key={String(a.id)} value={String(a.id)}>
                            {String(a.asset_tag)} — {String(a.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.assignment_type} onValueChange={(v) => setForm((f) => ({ ...f, assignment_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assignee</Label>
                    <Input required value={form.assignee_name} onChange={(e) => setForm((f) => ({ ...f, assignee_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Department</Label>
                      <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Expected return</Label>
                      <Input type="date" value={form.expected_return} onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Assign</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No assignments" description="Assign assets to custodians from register or here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const a = r.ast_assets as { asset_tag?: string; name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <Link href={`/dashboard/assets/${r.asset_id}`} className="font-mono text-xs text-primary hover:underline">
                        {a?.asset_tag || "—"}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a?.name}</p>
                    </TableCell>
                    <TableCell className="font-medium">{String(r.assignee_name)}</TableCell>
                    <TableCell className="capitalize text-xs">{String(r.assignment_type)}</TableCell>
                    <TableCell className="text-xs">{String(r.assigned_at || "").slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => returnAsset(String(r.asset_id))}>
                          Return
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
