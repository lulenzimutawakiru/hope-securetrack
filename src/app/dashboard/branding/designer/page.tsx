"use client";

import { useEffect, useState } from "react";
import { Layers, Eye, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CANVAS_SIZES, renderTemplatePreview, defaultLayoutJson } from "@/lib/branding";

export default function BrandDesignerPage() {
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [canvas, setCanvas] = useState("A4");
  const [preview, setPreview] = useState<string | null>(null);
  const [layout, setLayout] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("brand_templates")
        .select("id,name,canvas_size,status,layout_json,template_code")
        .is("deleted_at", null)
        .order("name");
      const list = (data as Array<Record<string, unknown>>) || [];
      setTemplates(list);
      if (list[0]) {
        setTemplateId(String(list[0].id));
        setCanvas(String(list[0].canvas_size || "A4"));
        setLayout((list[0].layout_json as Record<string, unknown>) || defaultLayoutJson("A4"));
      }
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => String(x.id) === id);
    if (t) {
      setCanvas(String(t.canvas_size || "A4"));
      setLayout((t.layout_json as Record<string, unknown>) || defaultLayoutJson(String(t.canvas_size || "A4")));
    }
  };

  const render = async () => {
    if (!templateId) return;
    try {
      const html = await renderTemplatePreview(templateId);
      setPreview(html);
      toast.success("Preview rendered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    }
  };

  if (loading) return <LoadingState message="Loading designer…" />;

  const components = (layout?.components as Array<Record<string, unknown>>) || [];
  const blocks =
    components.length > 0
      ? components.map((c) => ({
          type: String(c.type || "block"),
          label: `${String(c.type || "block")} · x${c.x ?? 0} y${c.y ?? 0}`,
        }))
      : [
          { type: "header", label: "Header · logo + company" },
          { type: "title", label: "Document title" },
          { type: "body", label: "Body · tables / content" },
          { type: "qr", label: "QR / barcode zone" },
          { type: "footer", label: "Footer · legal + contacts" },
        ];

  return (
    <div>
      <PageHeader
        title="Visual Designer"
        description="Canvas layout · blocks · A4 · labels · ID cards · social sizes"
        actions={
          <Button size="sm" onClick={render} disabled={!templateId}>
            <Eye className="h-4 w-4 mr-1" /> Render preview
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div>
          <Label>Template</Label>
          <Select value={templateId} onValueChange={onTemplateChange}>
            <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>
                  {String(t.name)} ({String(t.template_code)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Canvas size</Label>
          <Select value={canvas} onValueChange={(v) => {
            setCanvas(v);
            setLayout(defaultLayoutJson(v));
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CANVAS_SIZES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => setLayout(defaultLayoutJson(canvas))}>
            <RefreshCw className="h-4 w-4 mr-1" /> Reset layout
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Layout blocks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {blocks.map((b, i) => (
              <div
                key={i}
                className="rounded border border-dashed p-3 flex items-center justify-between bg-muted/30"
              >
                <span className="text-sm">{String(b.label || b.type)}</span>
                <Badge variant="outline" className="text-[10px]">{String(b.type)}</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Components: text · images · QR · barcodes · tables · signatures · watermarks.
              Full drag-drop editor uses template layout_json + HTML engine.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <iframe
                title="Template preview"
                srcDoc={preview}
                className="w-full h-[520px] rounded border bg-white"
              />
            ) : (
              <div className="h-[520px] rounded border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Select a template and click Render preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
