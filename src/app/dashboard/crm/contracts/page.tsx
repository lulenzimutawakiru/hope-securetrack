"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
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
import { crudCreate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmContractsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    contract_type: "sales",
    value: "0",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("crm_contracts")
        .select("*, customers(name)")
        .order("created_at", { ascending: false }),
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
    const num = `CTR-${Date.now().toString(36).toUpperCase()}`;
    const res = await crudCreate("crm_contracts", {
      contract_number: num,
      customer_id: form.customer_id,
      title: form.title,
      contract_type: form.contract_type,
      status: "active",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      value: parseFloat(form.value) || 0,
      currency: "UGX",
      owner_id: auth.profile.id,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Contract ${num} created`);
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Customer Contracts"
        description="Sales contracts, SLAs, framework agreements, renewals"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New contract
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create contract</DialogTitle>
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
                    placeholder="Title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                  <Select
                    value={form.contract_type}
                    onValueChange={(v) =>
                      setForm({ ...form, contract_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "sales",
                        "service",
                        "maintenance",
                        "framework",
                        "nda",
                        "sla",
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Value UGX"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Start</Label>
                      <Input
                        type="date"
                        value={form.start_date}
                        onChange={(e) =>
                          setForm({ ...form, start_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>End</Label>
                      <Input
                        type="date"
                        value={form.end_date}
                        onChange={(e) =>
                          setForm({ ...form, end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!form.customer_id}>
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No contracts" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cust = r.customers as { name: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">
                      {String(r.contract_number)}
                    </TableCell>
                    <TableCell className="font-medium">{String(r.title)}</TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell className="uppercase text-xs">
                      {String(r.contract_type)}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(r.value || 0))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.start_date ? formatDate(String(r.start_date)) : "—"}
                      {" → "}
                      {r.end_date ? formatDate(String(r.end_date)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
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
