"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const CATEGORIES = ["general", "banking", "payment", "identity", "printer", "messaging", "bi"];

export default function IntegrationsSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    integration_key: "",
    name: "",
    category: "general",
    config_json: "{}",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("integration_configs")
      .select("*")
      .order("category");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    let config: unknown = {};
    try {
      config = JSON.parse(form.config_json);
    } catch {
      toast.error("Config must be valid JSON");
      return;
    }
    const crudRes2 = await crudCreate("integration_configs", {
        company_id: auth.profile.company_id,
        integration_key: form.integration_key,
        name: form.name,
        category: form.category,
        config,
        is_enabled: false,
      });
    if (!crudRes2.ok) {
      toast.error(crudRes2.error);
      return;
    }
    const data = crudRes2.data as Record<string, unknown>;
    toast.success("Integration added");
    setOpen(false);
    load();
  };

  const toggle = async (id: string, is_enabled: boolean) => {
    if (!auth) return;
    const crudRes = await crudUpdate("integration_configs", id, { is_enabled: !is_enabled, updated_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(!is_enabled ? "Integration enabled" : "Integration disabled");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Integrations & API"
        description="Legacy registry — use Integrations hub for full iPaaS"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/integrations">Integration Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Integration
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Register integration</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Key</Label>
                      <Input
                        value={form.integration_key}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, integration_key: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Config JSON (non-secret metadata)</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                      value={form.config_json}
                      onChange={(e) => setForm((f) => ({ ...f, config_json: e.target.value }))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Do not store API secrets here. Use environment variables or vault for credentials.
                  </p>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Plug} title="No integrations" description="Register third-party connectors" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Config</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.integration_key)}</TableCell>
                  <TableCell>{String(r.name)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(r.category)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] max-w-[180px] truncate text-muted-foreground">
                    {JSON.stringify(r.config ?? {})}
                  </TableCell>
                  <TableCell>
                    {r.is_enabled ? (
                      <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggle(String(r.id), Boolean(r.is_enabled))}
                    >
                      {r.is_enabled ? "Disable" : "Enable"}
                    </Button>
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
