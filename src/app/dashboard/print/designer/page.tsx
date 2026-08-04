"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, Plus, Eye, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import {
  DESIGNER_ELEMENTS, LABEL_SIZES,
  defaultCanvas, addElement, layoutFromTemplateJson, renderLabelHtml,
  type CanvasLayout,
} from "@/lib/print";

export default function PrintDesignerPage() {
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [size, setSize] = useState("50x30");
  const [layout, setLayout] = useState<CanvasLayout>(defaultCanvas(50, 30));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("prt_templates")
        .select("id,name,template_code,width_mm,height_mm,layout_json,security_enabled")
        .is("deleted_at", null)
        .order("name");
      const list = (data as Array<Record<string, unknown>>) || [];
      setTemplates(list);
      if (list[0]) {
        setTemplateId(String(list[0].id));
        setLayout(
          layoutFromTemplateJson(
            list[0].layout_json,
            Number(list[0].width_mm || 50),
            Number(list[0].height_mm || 30)
          )
        );
      }
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const onTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => String(x.id) === id);
    if (t) {
      setLayout(
        layoutFromTemplateJson(t.layout_json, Number(t.width_mm || 50), Number(t.height_mm || 30))
      );
    }
  };

  const onSize = (v: string) => {
    setSize(v);
    const s = LABEL_SIZES.find((x) => x.value === v);
    if (s) setLayout(defaultCanvas(s.w, s.h));
  };

  const render = () => {
    const html = renderLabelHtml(layout, {}, {
      companyName: "SecureTrack ERP",
      securityWatermark: "AUTHENTIC · HDG",
    });
    setPreview(html);
    toast.success("Preview rendered");
  };

  if (loading) return <LoadingState message="Loading designer…" />;

  return (
    <div>
      <PageHeader
        title="Label Designer"
        description="Logo · QR · barcode · variables · security marks · print preview"
        actions={
          <Button size="sm" onClick={render}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <div>
          <Label>Template</Label>
          <Select value={templateId} onValueChange={onTemplate}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Canvas size</Label>
          <Select value={size} onValueChange={onSize}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LABEL_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setLayout(defaultCanvas(layout.canvas.w, layout.canvas.h))}>
            <RefreshCw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {DESIGNER_ELEMENTS.map((el) => (
              <Button
                key={el.type}
                size="sm"
                variant="outline"
                onClick={() => setLayout((l) => addElement(l, el.type))}
              >
                <Plus className="h-3 w-3 mr-1" /> {el.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" /> Layers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {layout.elements.map((el) => (
              <div key={el.id} className="flex justify-between rounded border border-dashed p-2 text-sm">
                <span className="capitalize">{el.type}</span>
                <Badge variant="outline" className="text-[10px]">
                  {el.x},{el.y}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Canvas {layout.canvas.w}×{layout.canvas.h} mm · grid snap · variables {`{{serial}} {{batch}}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <iframe title="Label preview" srcDoc={preview} className="w-full h-[360px] rounded border bg-white" />
            ) : (
              <div className="h-[360px] rounded border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                Click Preview
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
