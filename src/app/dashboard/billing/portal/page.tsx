"use client";

import { useEffect, useState } from "react";
import { Globe, Plus, Copy } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function PortalAdminPage() {
  const { auth } = useUser();
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [disputes, setDisputes] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", email: "", full_name: "" });

  const load = async () => {
    const supabase = createClient();
    const [{ data: u }, { data: d }, { data: c }] = await Promise.all([
      supabase.from("bill_portal_users").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("bill_portal_disputes").select("*, customers(name), invoices(invoice_number)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,email").eq("is_active", true),
    ]);
    setUsers(u ?? []);
    setDisputes(d ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.customer_id) return;
    try {
      const cust = customers.find((c) => c.id === form.customer_id);
      const res = await fetch("/api/billing/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: form.customer_id,
          email: form.email || cust?.email || null,
          full_name: form.full_name || cust?.name || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || json?.error || "Create failed");
      }
      const token = json.data?.access_token as string | undefined;
      if (token) {
        const url = `${window.location.origin}/portal/${token}`;
        await navigator.clipboard.writeText(url);
        toast.success("Portal user created — secure link copied (shown once)");
      } else {
        toast.success("Portal user created");
      }
      setOpen(false);
      setForm({ customer_id: "", email: "", full_name: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const copyLink = (token: string) => {
    if (!token || token.length < 16) {
      toast.error("Token not available — re-issue portal access");
      return;
    }
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied");
  };

  const resolveDispute = async (id: string, status: string) => {
    await crudUpdate("bill_portal_disputes", id, {
        status,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
        resolution: status === "resolved" ? "Resolved by finance" : "Rejected",
      });
    toast.success(status);
    await load();
  };

  if (loading) return <LoadingState message="Loading customer portal admin…" />;

  return (
    <div>
      <PageHeader
        title="Customer Portal Admin"
        description="Access links · invoices · pay online · disputes · statements"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Portal access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create portal user</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Customer</Label>
                  <Select
                    value={form.customer_id}
                    onValueChange={(v) => {
                      const c = customers.find((x) => x.id === v);
                      setForm((f) => ({
                        ...f,
                        customer_id: v,
                        email: c?.email || f.email,
                        full_name: c?.name || f.full_name,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {users.length === 0 ? (
        <EmptyState title="No portal users" description="Issue a secure access token for a customer." icon={Globe} />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={String(u.id)}>
                  <TableCell>{(u.customers as { name?: string } | null)?.name || String(u.full_name || "—")}</TableCell>
                  <TableCell className="text-xs">{String(u.email)}</TableCell>
                  <TableCell className="font-mono text-[10px]">{String(u.access_token).slice(0, 12)}…</TableCell>
                  <TableCell><StatusBadge status={u.is_active ? "active" : "inactive"} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => copyLink(String(u.access_token))}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2">Disputes</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disputes.map((d) => (
              <TableRow key={String(d.id)}>
                <TableCell className="font-mono text-xs">{String(d.dispute_number)}</TableCell>
                <TableCell>{(d.customers as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs font-mono">
                  {(d.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}
                </TableCell>
                <TableCell className="text-xs">{String(d.subject)}</TableCell>
                <TableCell><StatusBadge status={String(d.status)} /></TableCell>
                <TableCell className="space-x-1">
                  {d.status === "open" && (
                    <>
                      <Button size="sm" onClick={() => resolveDispute(String(d.id), "resolved")}>Resolve</Button>
                      <Button size="sm" variant="outline" onClick={() => resolveDispute(String(d.id), "rejected")}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
