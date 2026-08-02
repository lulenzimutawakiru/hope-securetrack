"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
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
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/client";
import { apiPost } from "@/lib/api-client";
import { crudCreate, crudDelete, crudUpdate } from "@/lib/api/crud-client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";

const JOURNAL_TYPES = [
  "general",
  "sales",
  "purchase",
  "cash",
  "bank",
  "payroll",
  "inventory",
  "manufacturing",
  "depreciation",
  "adjustment",
  "closing",
];

export default function JournalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [accounts, setAccounts] = useState<
    Array<{ id: string; account_code: string; account_name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    journal_type: "general",
    description: "",
    debit_account_id: "",
    credit_account_id: "",
    amount: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: acc }] = await Promise.all([
      supabase
        .from("gl_journals")
        .select("*")
        .is("deleted_at", null)
        .order("journal_date", { ascending: false })
        .limit(100),
      supabase
        .from("chart_of_accounts")
        .select("id,account_code,account_name")
        .eq("is_postable", true)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("account_code"),
    ]);
    setRows(data ?? []);
    setAccounts(acc ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (
      !form.debit_account_id ||
      !form.credit_account_id ||
      form.debit_account_id === form.credit_account_id ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      toast.error("Select two different accounts and a positive amount");
      return;
    }
    const res = await apiPost("/api/finance/journals", {
      journal_type: form.journal_type,
      journal_date: new Date().toISOString().slice(0, 10),
      description: form.description || null,
      lines: [
        {
          account_id: form.debit_account_id,
          description: form.description,
          debit: amount,
          credit: 0,
        },
        {
          account_id: form.credit_account_id,
          description: form.description,
          debit: 0,
          credit: amount,
        },
      ],
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Journal created (draft)");
    setOpen(false);
    load();
  };

  const post = async (id: string) => {
    const res = await crudUpdate("gl_journals", id, {
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_by: auth?.profile.id ?? null,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Journal posted");
      load();
    }
  };

  const reverse = async (id: string, number: string) => {
    if (!confirm(`Reverse journal ${number}?`)) return;
    const res = await crudUpdate("gl_journals", id, { status: "reversed" });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Journal reversed");
      load();
    }
  };

  const softDelete = async (id: string) => {
    if (!confirm("Archive journal?")) return;
    const res = await crudDelete("gl_journals", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Journal archived");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="General Ledger Journals"
        description="Double-entry · draft · approve · post · reverse · print · archive"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Manual journal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Create balanced journal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={form.journal_type}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, journal_type: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOURNAL_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Debit account</Label>
                    <Select
                      value={form.debit_account_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, debit_account_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Credit account</Label>
                    <Select
                      value={form.credit_account_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, credit_account_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Amount (UGX)</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create draft</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No journals" description="Post GL entries" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Journal #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.journal_number)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(r.journal_type)}
                  </TableCell>
                  <TableCell>
                    {r.journal_date ? formatDate(String(r.journal_date)) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {String(r.description ?? "—")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.total_debit))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.total_credit))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      <DocumentActions
                        showLabel={false}
                        size="sm"
                        variant="ghost"
                        doc={async (): Promise<BusinessDocument> => {
                          const supabase = createClient();
                          const { data: lines } = await supabase
                            .from("gl_journal_lines")
                            .select("*, chart_of_accounts(account_code, account_name)")
                            .eq("journal_id", String(r.id));
                          return {
                            title: `Journal ${r.journal_number}`,
                            docType: "Journal Voucher",
                            number: String(r.journal_number),
                            date: r.journal_date
                              ? String(r.journal_date)
                              : undefined,
                            status: String(r.status),
                            currency: String(r.currency || "UGX"),
                            billToLabel: "Description",
                            billToName: String(r.description ?? "Journal"),
                            lines: (lines ?? []).map((l) => {
                              const acc = l.chart_of_accounts as {
                                account_code?: string;
                                account_name?: string;
                              } | null;
                              return {
                                description: `${acc?.account_code ?? ""} ${acc?.account_name ?? l.description ?? ""}`,
                                quantity: 1,
                                unit_price: Number(l.debit || l.credit || 0),
                                amount: Number(l.debit || l.credit || 0),
                              };
                            }),
                            subtotal: Number(r.total_debit),
                            total: Number(r.total_debit),
                            footerNote:
                              "Double-entry journal · Hope Design Group Ltd Finance",
                          };
                        }}
                      />
                      {r.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => post(String(r.id))}
                        >
                          Post
                        </Button>
                      )}
                      {r.status === "posted" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            reverse(String(r.id), String(r.journal_number))
                          }
                        >
                          Reverse
                        </Button>
                      )}
                      {["draft", "void", "reversed"].includes(String(r.status)) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => softDelete(String(r.id))}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
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
