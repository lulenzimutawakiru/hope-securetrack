"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw, Cog } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listPostingRules,
  listAutoJournals,
  postAccountingEvent,
  type AccountingEventType,
} from "@/lib/finance/engine";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const EVENTS: AccountingEventType[] = [
  "sales_invoice",
  "customer_payment",
  "purchase_invoice",
  "goods_receipt",
  "production_complete",
  "material_issue",
  "payroll_post",
  "asset_purchase",
  "asset_depreciation",
  "dispatch",
  "expense_claim",
];

export default function AccountingEnginePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [journals, setJournals] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    eventType: "sales_invoice" as AccountingEventType,
    sourceModule: "sales",
    sourceRef: "",
    amount: "100000",
    description: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const [r, j] = await Promise.all([
        listPostingRules(companyId),
        listAutoJournals(companyId, 30),
      ]);
      setRules(r as Array<Record<string, unknown>>);
      setJournals(j as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const run = async () => {
    if (!companyId) return toast.error("No company");
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Enter amount");
    setBusy(true);
    try {
      const row = await postAccountingEvent({
        companyId,
        eventType: form.eventType,
        sourceModule: form.sourceModule,
        sourceRef: form.sourceRef || `MANUAL-${Date.now()}`,
        amount,
        description: form.description || undefined,
        actorId: auth?.user?.id,
      });
      toast.success(`Posted ${row.auto_number} · ${row.status}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Post failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading accounting engine…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Accounting Engine"
        description="Event-driven auto-journals · multi-book · accrual/cash · full ERP traceability"
        actions={
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" /> Post ERP event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Event type</Label>
              <Select
                value={form.eventType}
                onValueChange={(v) => setForm({ ...form, eventType: v as AccountingEventType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Source module</Label>
                <Input
                  value={form.sourceModule}
                  onChange={(e) => setForm({ ...form, sourceModule: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Source ref</Label>
                <Input
                  value={form.sourceRef}
                  onChange={(e) => setForm({ ...form, sourceRef: e.target.value })}
                  placeholder="INV-001"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <Button onClick={run} disabled={busy}>
              <Cog className="h-4 w-4 mr-1" /> {busy ? "Posting…" : "Generate journal"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active posting rules ({rules.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {rules.map((r) => (
              <div key={String(r.id)} className="border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{String(r.rule_code)} · {String(r.name)}</span>
                  <Badge variant="outline">{String(r.event_type)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  DR {String(r.debit_account_code || "—")} / CR {String(r.credit_account_code || "—")}
                  {r.tax_account_code ? ` / Tax ${String(r.tax_account_code)}` : ""}
                  · {String(r.accounting_basis)} · {String(r.ledger_book)}
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground">No rules — apply migration 00057.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent auto journals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {journals.length === 0 && (
            <p className="text-sm text-muted-foreground">No auto journals yet. Post an event above.</p>
          )}
          {journals.map((j) => (
            <div key={String(j.id)} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
              <div>
                <div className="font-medium">
                  {String(j.auto_number)} · {String(j.event_type)} · {String(j.source_ref || "—")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {String(j.source_module)} · {formatNumber(Number(j.amount || 0))} {String(j.currency || "UGX")}
                  {j.error_message ? ` · ${String(j.error_message)}` : ""}
                </div>
              </div>
              <Badge variant={String(j.status) === "failed" ? "destructive" : "outline"}>
                {String(j.status)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
