"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
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
// Badge used for reconcile status
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function BankPage() {
  const { auth } = useUser();
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [txns, setTxns] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [form, setForm] = useState({
    account_code: "",
    account_name: "",
    bank_name: "",
    account_type: "current",
    current_balance: "0",
  });
  const [txnForm, setTxnForm] = useState({
    bank_account_id: "",
    txn_type: "deposit",
    amount: "",
    description: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: t }] = await Promise.all([
      supabase
        .from("bank_accounts")
        .select("*")
        .is("deleted_at", null)
        .order("account_code"),
      supabase
        .from("bank_transactions")
        .select("*, bank_accounts(account_name, account_code)")
        .order("txn_date", { ascending: false })
        .limit(50),
    ]);
    setAccounts(data ?? []);
    setTxns(t ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("bank_accounts").insert({
      company_id: auth.profile.company_id,
      account_code: form.account_code,
      account_name: form.account_name,
      bank_name: form.bank_name || null,
      account_type: form.account_type,
      currency: "UGX",
      current_balance: Number(form.current_balance || 0),
      is_active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bank account created");
      setOpen(false);
      load();
    }
  };

  const createTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !txnForm.bank_account_id) return;
    const amount = Number(txnForm.amount);
    const supabase = createClient();
    const { error } = await supabase.from("bank_transactions").insert({
      company_id: auth.profile.company_id,
      bank_account_id: txnForm.bank_account_id,
      txn_date: new Date().toISOString().slice(0, 10),
      txn_type: txnForm.txn_type,
      amount,
      currency: "UGX",
      description: txnForm.description || null,
      is_reconciled: false,
      created_by: auth.profile.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const acc = accounts.find((a) => a.id === txnForm.bank_account_id);
    const bal = Number(acc?.current_balance || 0);
    const delta = ["deposit", "interest"].includes(txnForm.txn_type)
      ? amount
      : -amount;
    await supabase
      .from("bank_accounts")
      .update({ current_balance: bal + delta })
      .eq("id", txnForm.bank_account_id);
    toast.success("Transaction posted");
    setTxnOpen(false);
    load();
  };

  const reconcile = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        is_reconciled: true,
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Reconciled");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const cash = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  return (
    <div>
      <PageHeader
        title="Bank & Cash Management"
        description="Bank accounts · mobile money · petty cash · transactions · reconciliation"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  Post transaction
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createTxn} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Bank transaction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Account</Label>
                    <Select
                      value={txnForm.bank_account_id}
                      onValueChange={(v) =>
                        setTxnForm((f) => ({ ...f, bank_account_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={String(a.id)} value={String(a.id)}>
                            {String(a.account_code)} — {String(a.account_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={txnForm.txn_type}
                        onValueChange={(v) =>
                          setTxnForm((f) => ({ ...f, txn_type: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "deposit",
                            "withdrawal",
                            "transfer",
                            "fee",
                            "interest",
                            "mobile_money",
                            "cheque",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        value={txnForm.amount}
                        onChange={(e) =>
                          setTxnForm((f) => ({ ...f, amount: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input
                      value={txnForm.description}
                      onChange={(e) =>
                        setTxnForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Post</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createAccount} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New bank / cash account</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.account_code}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, account_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={form.account_type}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, account_type: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "current",
                            "savings",
                            "mobile_money",
                            "petty_cash",
                            "cash",
                          ].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.account_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, account_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Bank name</Label>
                    <Input
                      value={form.bank_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bank_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Opening balance</Label>
                    <Input
                      type="number"
                      value={form.current_balance}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          current_balance: e.target.value,
                        }))
                      }
                    />
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

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Cash position" value={formatNumber(Math.round(cash))} icon={Building2} />
        <StatCard title="Accounts" value={formatNumber(accounts.length)} />
        <StatCard title="Recent txns" value={formatNumber(txns.length)} />
      </div>

      <h3 className="font-medium mb-2">Bank accounts</h3>
      {accounts.length === 0 ? (
        <EmptyState icon={Building2} title="No bank accounts" description="Add bank or mobile money" />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={String(a.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(a.account_code)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {String(a.account_name)}
                  </TableCell>
                  <TableCell>{String(a.bank_name ?? "—")}</TableCell>
                  <TableCell className="capitalize">
                    {String(a.account_type).replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(a.current_balance))}
                  </TableCell>
                  <TableCell>
                    {a.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Transactions</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reconciled</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                  No transactions
                </TableCell>
              </TableRow>
            ) : (
              txns.map((t) => {
                const ba = t.bank_accounts as {
                  account_name?: string;
                  account_code?: string;
                } | null;
                return (
                  <TableRow key={String(t.id)}>
                    <TableCell>
                      {t.txn_date ? formatDate(String(t.txn_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ba?.account_code} {ba?.account_name}
                    </TableCell>
                    <TableCell className="capitalize">
                      {String(t.txn_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {String(t.description ?? "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      {t.is_reconciled ? (
                        <Badge className="bg-green-100 text-green-800">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!t.is_reconciled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reconcile(String(t.id))}
                        >
                          Reconcile
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
