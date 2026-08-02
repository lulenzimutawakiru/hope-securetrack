"use client";

import { useState } from "react";
import { Wand2, Save, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import {
  generateCardDesign,
  analyzeDesign,
  buildCardPrintHtml,
  printCardHtml,
  type AiDesignResult,
} from "@/lib/workforce-id";

const EXAMPLES = [
  "Create a security badge for factory employees",
  "Premium executive card for directors with hologram",
  "Visitor badge with host and same-day expiry",
  "Contractor RFID card for warehouse operators",
  "Intern card green theme supervised access",
];

export default function AiDesignerPage() {
  const { auth } = useUser();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<AiDesignResult | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const generate = () => {
    const r = generateCardDesign({ prompt });
    setResult(r);
    setName(r.name);
    toast.success(`Generated ${r.category} layout`);
  };

  const saveTemplate = async () => {
    if (!auth?.profile?.company_id || !result) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const code = `TPL-AI-${Date.now().toString(36).toUpperCase()}`;
      const crudRes2 = await crudCreate("wid_card_templates", {
          company_id: auth.profile.company_id,
          template_code: code,
          name: name || result.name,
          description: result.description,
          category: result.category,
          design_json: result.design_json,
          security_features: result.security_features,
          default_access_profile_code: result.default_access_profile_code,
          created_by: auth.profile.id,
        });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      const data = crudRes2.data as Record<string, unknown>;
      const crudRes = await crudCreate("wid_ai_design_logs", {
        company_id: auth.profile.company_id,
        prompt,
        result_summary: result.description,
        design_json: result.design_json,
        template_id: data.id,
        created_by: auth.profile.id,
      });
      toast.success("Saved as template — open Design Studio to refine");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    if (!result) return;
    const html = buildCardPrintHtml({
      design: result.design_json,
      ctx: {
        full_name: "Sample Employee",
        job_title: "Role Title",
        department: "Department",
        identity_number: "HDG-EMP-2026-000001",
        credential_number: "CRD-EMP-001",
        expiry_date: "2027-01-01",
        emergency_contact: "Emergency contact",
        blood_group: "A+",
      },
      qrPublicId: "WID-AI-PREVIEW",
      title: name || result.name,
    });
    printCardHtml(html);
  };

  return (
    <div>
      <PageHeader
        title="AI Card Designer"
        description="Generate professional layouts, security features, and access profiles from natural language"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Prompt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Create a security badge for factory employees"'
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="text-[11px] px-2 py-1 rounded-full border hover:bg-muted"
                  onClick={() => setPrompt(ex)}
                >
                  {ex.slice(0, 42)}…
                </button>
              ))}
            </div>
            <Button onClick={generate}>
              <Wand2 className="h-4 w-4 mr-1" /> Generate layout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!result ? (
              <p className="text-sm text-muted-foreground">Run a prompt to generate a card design.</p>
            ) : (
              <>
                <div>
                  <Label>Template name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <p className="text-sm">{result.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge>{result.category}</Badge>
                  <Badge variant="outline">Access: {result.default_access_profile_code}</Badge>
                  <Badge variant="outline">
                    {result.design_json.front.length} front / {result.design_json.back.length} back
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.security_features.map((f) => (
                    <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Recommendations</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {result.recommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Print QA</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {analyzeDesign(result.design_json).map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={preview}>
                    <Printer className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  <Button onClick={saveTemplate} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save template"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
