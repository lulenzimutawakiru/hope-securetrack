"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Ban } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { createApiAccount, revokeApiAccount } from "@/lib/idm";

export default function ApiAccountsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    account_purpose: "integration",
    description: "",
    scopes: "intg.api",
    expires_at: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("idm_api_accounts")
      .select("*")
      .order("created_at", { ascending: false });
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
      const { account, plain_key } = await createApiAccount({
        company_id: companyId,
        name: form.name,
        account_purpose: form.account_purpose,
        description: form.description,
        scopes: form.scopes.split(",").map((s) => s.trim()).filter(Boolean),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        created_by: auth?.user?.id,
      });
      setPlainKey(plain_key);
      toast.success(`API account ${account.account_code} created`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading API accounts…" />;

  const active = rows.filter((r) => r.status === "active").length;

  return (
    <div>
      <PageHeader
        title="API & System Accounts"
        description="Integrations · IoT · payments · printers · keys · tokens · expiry"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>System / API account</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Purpose</Label>
                    <Select value={form.account_purpose} onValueChange={(v) => setForm((f) => ({ ...f, account_purpose: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["integration", "application", "iot", "payment", "printer", "system"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Scopes (comma slugs)</Label>
                    <Input value={form.scopes} onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Expiry (optional)</Label>
                    <Input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create & issue key</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="API accounts" value={String(rows.length)} icon={Key} />
        <StatCard title="Active" value={String(active)} icon={Key} />
      </div>

      {plainKey && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 text-sm space-y-1">
            <p className="font-medium">API key (copy now — shown once)</p>
            <code className="block font-mono text-xs break-all border rounded px-2 py-2 bg-background">{plainKey}</code>
            <Button size="sm" variant="ghost" onClick={() => setPlainKey(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No API accounts" description="Create system accounts for integrations and devices." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.account_code)}</TableCell>
                  <TableCell className="text-sm">{String(r.name)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.account_purpose)}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">
                    {((r.scopes as string[]) || []).join(", ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.expires_at ? formatDate(String(r.expires_at)) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    {r.status === "active" && companyId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await revokeApiAccount(String(r.id), companyId, auth?.user?.id);
                          toast.success("Revoked");
                          await load();
                        }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
