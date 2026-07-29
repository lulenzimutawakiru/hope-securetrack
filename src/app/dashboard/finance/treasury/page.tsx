"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function TreasuryPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    facility_code: "",
    facility_type: "loan",
    counterparty: "",
    principal: "",
    interest_rate: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("treasury_facilities")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const principal = Number(form.principal);
    const supabase = createClient();
    const { error } = await supabase.from("treasury_facilities").insert({
      company_id: auth.profile.company_id,
      facility_code: form.facility_code,
      facility_type: form.facility_type,
      counterparty: form.counterparty || null,
      principal,
      outstanding: principal,
      interest_rate: Number(form.interest_rate || 0),
      currency: "UGX",
      start_date: new Date().toISOString().slice(0, 10),
      status: "active",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Facility created");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const outstanding = rows
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + Number(r.outstanding || 0), 0);

  return (
    <div>
      <PageHeader
        title="Treasury Management"
        description="Loans · facilities · interest · liquidity · investments"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Facility
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Loan / facility</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.facility_code}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            facility_code: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Input
                        value={form.facility_type}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            facility_type: e.target.value,
                          }))
                        }
                        placeholder="loan | overdraft | facility"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Counterparty</Label>
                    <Input
                      value={form.counterparty}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, counterparty: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Principal</Label>
                      <Input
                        type="number"
                        value={form.principal}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, principal: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Interest %</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form.interest_rate}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            interest_rate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <StatCard title="Active facilities" value={formatNumber(rows.length)} icon={Wallet} />
        <StatCard title="Outstanding debt" value={formatNumber(Math.round(outstanding))} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title="No facilities" description="Record bank loans and facilities" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.facility_code)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(r.facility_type)}
                  </TableCell>
                  <TableCell>{String(r.counterparty ?? "—")}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.principal))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(r.outstanding))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.interest_rate))}
                  </TableCell>
                  <TableCell>
                    {r.start_date ? formatDate(String(r.start_date)) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
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
