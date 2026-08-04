"use client";

import { useState } from "react";
import { Wand2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import {
  generateInvoiceFromPrompt,
  analyzeInvoiceDraft,
  createInvoice,
  computeInvoiceTotals,
  type AiInvoiceDraft,
} from "@/lib/billing";
import { formatNumber } from "@/lib/utils";
import { useEffect } from "react";

const EXAMPLES = [
  "Create tax invoice for 100 cartons at 85000 UGX security paper",
  "Proforma for government LPO maintenance contract monthly",
  "Export invoice USD software license annual",
  "Credit note for returned reams overpayment",
  "Monthly subscription MTN MoMo customer internet service 150000",
];

export default function BillingAiPage() {
  const { auth } = useUser();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [draft, setDraft] = useState<AiInvoiceDraft | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("customers")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCustomers(data ?? []));
  }, []);

  const generate = () => {
    const d = generateInvoiceFromPrompt(prompt);
    setDraft(d);
    toast.success(`Draft ${d.invoice_type} ready`);
  };

  const save = async () => {
    if (!auth?.profile?.company_id || !draft) return;
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    const check = analyzeInvoiceDraft({
      customer_id: customerId,
      lines: draft.lines,
      payment_terms_days: draft.payment_terms_days,
      invoice_type: draft.invoice_type,
    });
    if (check.errors.length) {
      toast.error(check.errors[0]);
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const inv = await createInvoice(supabase, {
        company_id: auth.profile.company_id,
        customer_id: customerId,
        invoice_type: draft.invoice_type,
        currency: draft.currency,
        payment_terms_days: draft.payment_terms_days,
        payment_terms_label: draft.payment_terms_label,
        notes: draft.notes,
        lines: draft.lines,
        source_type: "ai",
        created_by: auth.profile.id,
        status: "draft",
      });
      const crudRes = await crudCreate("bill_ai_logs", {
        company_id: auth.profile.company_id,
        action: "generate_invoice",
        prompt,
        result_summary: `Created ${inv.invoice_number}`,
        invoice_id: inv.id,
        payload: draft,
        created_by: auth.profile.id,
      });
      toast.success(`Invoice ${inv.invoice_number} created as draft`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const totals = draft ? computeInvoiceTotals(draft.lines) : null;
  const analysis = draft
    ? analyzeInvoiceDraft({
        customer_id: customerId,
        lines: draft.lines,
        payment_terms_days: draft.payment_terms_days,
        invoice_type: draft.invoice_type,
      })
    : null;

  return (
    <div>
      <PageHeader
        title="AI Billing Assistant"
        description="Draft invoices · detect missing data · recommend terms · catch errors"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4" /> Prompt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="text-[11px] px-2 py-1 rounded-full border hover:bg-muted" onClick={() => setPrompt(ex)}>
                  {ex.slice(0, 40)}…
                </button>
              ))}
            </div>
            <Button onClick={generate}><Wand2 className="h-4 w-4 mr-1" /> Generate draft</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Draft result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!draft ? (
              <p className="text-sm text-muted-foreground">Run a prompt to draft an invoice.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  <Badge>{draft.invoice_type}</Badge>
                  <Badge variant="outline">{draft.currency}</Badge>
                  <Badge variant="outline">{draft.payment_terms_label}</Badge>
                </div>
                <div>
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm space-y-1 border rounded p-2">
                  {draft.lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>{l.description}</span>
                      <span>{l.quantity} × {formatNumber(l.unit_price)}</span>
                    </div>
                  ))}
                  {totals && (
                    <div className="pt-2 border-t font-semibold flex justify-between">
                      <span>Total</span>
                      <span>{draft.currency} {formatNumber(totals.total_amount)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium">Recommendations</p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4">
                    {draft.recommendations.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
                {analysis && (
                  <div>
                    <p className="text-xs font-medium">Validation</p>
                    {analysis.errors.map((e) => <p key={e} className="text-xs text-red-600">• {e}</p>)}
                    {analysis.suggestions.map((s) => <p key={s} className="text-xs text-muted-foreground">• {s}</p>)}
                    {!analysis.errors.length && !analysis.suggestions.length && (
                      <p className="text-xs text-teal-700">Looks good</p>
                    )}
                  </div>
                )}
                <Button onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Create draft invoice"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
