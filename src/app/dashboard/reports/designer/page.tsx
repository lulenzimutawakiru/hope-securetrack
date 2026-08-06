"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const REPORT_TYPES = [
  "tabular",
  "crosstab",
  "matrix",
  "pivot",
  "financial_statement",
  "drill_down",
  "interactive",
  "pixel",
  "chart",
  "statistical",
];

const CATEGORIES = [
  "operational",
  "financial",
  "analytical",
  "executive",
  "exception",
  "comparative",
  "regulatory",
  "adhoc",
  "ai",
  "statistical",
];

export default function ReportDesignerPage() {
  const { auth } = useUser();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    report_code: "",
    name: "",
    description: "",
    category: "operational",
    module_key: "general",
    report_type: "tabular",
    data_source: "",
    parameters_json: "[]",
    columns_json: '[{"field":"id","label":"ID"}]',
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    let parameters: unknown = [];
    let columns_config: unknown = [];
    try {
      parameters = JSON.parse(form.parameters_json);
      columns_config = JSON.parse(form.columns_json);
    } catch {
      toast.error("Parameters and columns must be valid JSON");
      return;
    }
    setSaving(true);
    const crudRes = await crudCreate("bi_report_definitions", {
      company_id: auth.profile.company_id,
      report_code: form.report_code.toUpperCase(),
      name: form.name,
      description: form.description || null,
      category: form.category,
      module_key: form.module_key,
      report_type: form.report_type,
      data_source: form.data_source || null,
      parameters,
      columns_config,
      layout_config: { type: form.report_type, orientation: "portrait" },
      is_published: true,
      owner_id: auth.profile.id,
    });
    setSaving(false);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Report definition published");
      setForm((f) => ({
        ...f,
        report_code: "",
        name: "",
        description: "",
      }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Report Designer"
        description="Define dynamic, pixel-ready, drill-down, matrix, and pivot report metadata"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports/library">Library</Link>
            </Button>
          </div>
        }
      />

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Definition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Report code</Label>
                <Input
                  value={form.report_code}
                  onChange={(e) => setForm((f) => ({ ...f, report_code: e.target.value }))}
                  placeholder="RPT-OPS-001"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Module</Label>
                <Input
                  value={form.module_key}
                  onChange={(e) => setForm((f) => ({ ...f, module_key: e.target.value }))}
                />
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
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <Label>Report type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.report_type}
                  onChange={(e) => setForm((f) => ({ ...f, report_type: e.target.value }))}
                >
                  {REPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data source key</Label>
              <Input
                value={form.data_source}
                onChange={(e) => setForm((f) => ({ ...f, data_source: e.target.value }))}
                placeholder="production_batches | invoices | custom"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layout & parameters (JSON)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Parameters</Label>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                value={form.parameters_json}
                onChange={(e) => setForm((f) => ({ ...f, parameters_json: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Columns</Label>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                value={form.columns_json}
                onChange={(e) => setForm((f) => ({ ...f, columns_json: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Supports tabular, cross-tab, matrix, pivot, financial statement, interactive,
              and pixel-perfect layout metadata. Execution uses ERP data sources via RLS.
            </p>
            <Button type="submit" disabled={saving}>
              {saving ? "Publishing…" : "Publish report"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
