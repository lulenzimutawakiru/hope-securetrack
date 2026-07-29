"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Plus, Search } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { ASSET_TYPES, addBrandAsset } from "@/lib/branding";

export default function BrandAssetsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    asset_type: "image",
    file_url: "",
    file_name: "",
    file_format: "png",
    tags: "",
    expires_on: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_assets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter !== "all") list = list.filter((r) => r.asset_type === typeFilter);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        String(r.title).toLowerCase().includes(s) ||
        String(r.asset_code).toLowerCase().includes(s) ||
        ((r.tags as string[]) || []).some((t) => t.toLowerCase().includes(s))
    );
  }, [rows, q, typeFilter]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await addBrandAsset({
        company_id: companyId,
        title: form.title,
        asset_type: form.asset_type,
        file_url: form.file_url || undefined,
        file_name: form.file_name || form.title,
        file_format: form.file_format,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        expires_on: form.expires_on || null,
        uploaded_by: auth?.user?.id ?? null,
      });
      toast.success("Asset registered (pending approval)");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading DAM…" />;

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="Digital Asset Management"
        description="Images · logos · design files · videos · tags · version · expiry"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register asset</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register asset</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.asset_type} onValueChange={(v) => setForm((f) => ({ ...f, asset_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>File URL</Label>
                    <Input value={form.file_url} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Format</Label>
                      <Input value={form.file_format} onChange={(e) => setForm((f) => ({ ...f, file_format: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Expires</Label>
                      <Input type="date" value={form.expires_on} onChange={(e) => setForm((f) => ({ ...f, expires_on: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Tags (comma)</Label>
                    <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <StatCard title="Assets" value={String(rows.length)} icon={FolderOpen} />
        <StatCard title="Pending approval" value={String(pending)} icon={FolderOpen} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search title, code, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No assets" description="Upload or register brand assets." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Downloads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.asset_code)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {String(r.title)}
                    {r.file_url ? (
                      <a href={String(r.file_url)} target="_blank" rel="noreferrer" className="block text-xs text-primary underline">
                        Open
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.asset_type)}</TableCell>
                  <TableCell className="text-xs uppercase">{String(r.file_format || "—")}</TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate">
                    {((r.tags as string[]) || []).join(", ")}
                  </TableCell>
                  <TableCell className="text-xs">{r.expires_on ? formatDate(String(r.expires_on)) : "—"}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>{String(r.download_count || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
