"use client";

import { useEffect, useState } from "react";
import { Headphones, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmServicePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    subject: "",
    category: "complaint",
    priority: "medium",
    description: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("id,name"),
    ]);
    setRows(data ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const num = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const res = await crudCreate("support_tickets", {
      ticket_number: num,
      customer_id: form.customer_id || null,
      subject: form.subject,
      description: form.description || null,
      category: form.category,
      priority: form.priority,
      status: "open",
      assigned_to: auth.profile.id,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Ticket ${num} created`);
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const res = await crudUpdate("support_tickets", id, { status });
    if (!res.ok) toast.error(res.error);
    else toast.success("Ticket updated");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Customer Service Desk"
        description="Complaints · warranty · technical support · returns escalation"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Service ticket</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <Select
                    value={form.customer_id}
                    onValueChange={(v) => setForm({ ...form, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    required
                    placeholder="Subject"
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "complaint",
                          "warranty",
                          "technical",
                          "return",
                          "general",
                        ].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["low", "medium", "high", "critical"].map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Headphones} title="No tickets" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cust = r.customers as { name: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">
                      {String(r.ticket_number)}
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {String(r.subject)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.priority)} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(String(r.created_at))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={String(r.status)}
                        onValueChange={(v) => setStatus(String(r.id), v)}
                      >
                        <SelectTrigger className="w-[130px] ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "open",
                            "assigned",
                            "in_progress",
                            "resolved",
                            "closed",
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
