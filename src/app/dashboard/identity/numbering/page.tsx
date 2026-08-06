"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  EMPLOYEE_NUMBER_TOKENS,
  formatEmployeeNumber,
  listNumberingRules,
  nextEmployeeId,
  type EmployeeNumberingRule,
} from "@/lib/idm";

interface RuleForm {
  rule_code: string;
  name: string;
  format: string;
  prefix: string;
  padding: string;
  per_year: boolean;
  is_active: boolean;
}

const EMPTY_FORM: RuleForm = {
  rule_code: "",
  name: "",
  format: "EMP-{YEAR}-{SEQ}",
  prefix: "EMP",
  padding: "5",
  per_year: true,
  is_active: true,
};

export default function IdentityNumberingPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<EmployeeNumberingRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const companyId = (auth?.profile as { company_id?: string } | undefined)
    ?.company_id;

  const load = async () => {
    if (!companyId) return;
    const list = await listNumberingRules(companyId);
    setRules(list);
    const def = list.find((r) => r.is_default) ?? list[0];
    if (def) {
      setEditingId(def.id);
      setForm({
        rule_code: def.rule_code,
        name: def.name,
        format: def.format,
        prefix: def.prefix ?? "",
        padding: String(def.padding ?? 5),
        per_year: def.per_year !== false,
        is_active: def.is_active,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const preview = () => {
    const def = rules.find((r) => r.id === editingId);
    return formatEmployeeNumber(form.format, {
      prefix: form.prefix || form.rule_code,
      sequence: (def?.next_sequence ?? 0) + 1,
      padding: parseInt(form.padding, 10) || 5,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !editingId) {
      toast.error("Select a rule to edit first");
      return;
    }
    setSaving(true);
    const sb = createClient();
    const payload = {
      rule_code: form.rule_code.trim() || "emp-default",
      name: form.name.trim() || "Employee Numbering",
      format: form.format.trim() || "EMP-{YEAR}-{SEQ}",
      prefix: form.prefix.trim() || null,
      padding: Math.max(1, parseInt(form.padding, 10) || 5),
      per_year: form.per_year,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb
      .from("idm_employee_numbering_rules")
      .update(payload)
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save rule");
      return;
    }
    toast.success("Numbering rule saved");
    await load();
  };

  const addRule = async () => {
    if (!companyId) return;
    setSaving(true);
    const sb = createClient();
    const { error } = await sb.from("idm_employee_numbering_rules").insert({
      company_id: companyId,
      rule_code: `emp-${Date.now().toString(36)}`,
      name: "New numbering rule",
      format: "EMP-{YEAR}-{SEQ}",
      prefix: "EMP",
      padding: 5,
      per_year: true,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to create rule");
      return;
    }
    toast.success("Rule created");
    await load();
  };

  const removeRule = async (id: string) => {
    if (!window.confirm("Delete this numbering rule?")) return;
    const sb = createClient();
    const { error } = await sb
      .from("idm_employee_numbering_rules")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message || "Failed to delete rule");
      return;
    }
    toast.success("Rule deleted");
    setEditingId(null);
    await load();
  };

  const issueNext = async () => {
    if (!companyId) return;
    setIssuing(true);
    setIssued(null);
    try {
      const number = await nextEmployeeId({ companyId });
      setIssued(number);
      toast.success(`Issued ${number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setIssuing(false);
    }
  };

  if (loading) return <LoadingState message="Loading numbering rules..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Numbering"
        description="Configure how employee IDs are generated for this organization."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Default rule</CardTitle>
            <CardDescription>
              New users and provision requests receive their next employee ID
              from this rule automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rule_name">Rule name</Label>
                  <Input
                    id="rule_name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule_code">Rule code</Label>
                  <Input
                    id="rule_code"
                    value={form.rule_code}
                    onChange={(e) => setForm({ ...form, rule_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="format">Format</Label>
                  <Input
                    id="format"
                    value={form.format}
                    onChange={(e) => setForm({ ...form, format: e.target.value })}
                    placeholder="EMP-{YEAR}-{SEQ}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Preview: <span className="font-mono">{preview()}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input
                    id="prefix"
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                    placeholder="EMP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padding">Sequence padding</Label>
                  <Input
                    id="padding"
                    type="number"
                    min={1}
                    max={12}
                    value={form.padding}
                    onChange={(e) => setForm({ ...form, padding: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.per_year}
                    onChange={(e) =>
                      setForm({ ...form, per_year: e.target.checked })
                    }
                  />
                  Reset sequence each year
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : (
                    <>
                      <Save className="mr-2 h-4 w-4" aria-hidden /> Save rule
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={issuing}
                  onClick={issueNext}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  {issuing ? "Issuing..." : "Issue next ID"}
                </Button>
                {issued && (
                  <Badge variant="secondary" className="font-mono">
                    {issued}
                  </Badge>
                )}
                <Button type="button" variant="ghost" onClick={addRule} disabled={saving}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden /> Add rule
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Format tokens</CardTitle>
            <CardDescription>Tokens are replaced when a number is issued.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {EMPLOYEE_NUMBER_TOKENS.map((t) => (
              <div
                key={t.token}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{t.token}</span>
                <span className="text-xs text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <EmptyState title="No numbering rules" description="Create a rule to start generating employee IDs." />
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {r.name}
                      {r.is_default && (
                        <Badge variant="secondary">default</Badge>
                      )}
                      {!r.is_active && <Badge variant="outline">inactive</Badge>}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{r.format}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(r.id);
                        setForm({
                          rule_code: r.rule_code,
                          name: r.name,
                          format: r.format,
                          prefix: r.prefix ?? "",
                          padding: String(r.padding ?? 5),
                          per_year: r.per_year !== false,
                          is_active: r.is_active,
                        });
                      }}
                    >
                      Edit
                    </Button>
                    {!r.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRule(r.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
