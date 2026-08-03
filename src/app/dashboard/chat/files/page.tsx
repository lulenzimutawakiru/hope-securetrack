"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { registerFile } from "@/lib/hopechat";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default function SecureChatFilesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ file_name: "", file_type: "pdf", file_size_bytes: "0" });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("hc_files")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await registerFile({
        company_id: companyId,
        uploader_id: userId,
        file_name: form.file_name,
        file_type: form.file_type,
        file_size_bytes: Number(form.file_size_bytes) || 0,
      });
      toast.success("File registered (object storage URL ready)");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading shared files…" />;

  return (
    <div>
      <PageHeader
        title="Shared Files"
        description="Documents · images · versions · expiry links · co-authoring hooks"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register file</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create}>
                  <DialogHeader><DialogTitle>Share file metadata</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>File name</Label>
                      <Input required value={form.file_name} onChange={(e) => setForm((f) => ({ ...f, file_name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Input value={form.file_type} onChange={(e) => setForm((f) => ({ ...f, file_type: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Size (bytes)</Label>
                        <Input type="number" value={form.file_size_bytes} onChange={(e) => setForm((f) => ({ ...f, file_size_bytes: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No files" description="Share files from chat or register here." icon={Paperclip} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-medium text-sm">{String(r.file_name)}</TableCell>
                  <TableCell className="text-xs uppercase">{String(r.file_type || "—")}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.file_size_bytes || 0))}</TableCell>
                  <TableCell className="text-xs">v{String(r.version_no || 1)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
