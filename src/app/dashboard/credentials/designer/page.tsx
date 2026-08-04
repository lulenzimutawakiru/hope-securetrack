"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Palette, Save, Plus, Trash2, Copy, Lock, Unlock, Eye, Printer, Undo2, Redo2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import {
  DYNAMIC_FIELDS,
  buildCardPrintHtml,
  printCardHtml,
  analyzeDesign,
  type CardDesign,
  type CardElement,
  type CardElementType,
  type WidTemplate,
} from "@/lib/workforce-id";

const PREVIEW_CTX = {
  full_name: "John Doe",
  job_title: "Machine Operator",
  department: "Production",
  identity_number: "HDG-PROD-2026-000245",
  credential_number: "CRD-PROD-2026-000245-001",
  emergency_contact: "Jane Doe · +256700000000",
  blood_group: "O+",
  expiry_date: "2027-12-31",
  security_clearance: "standard",
  operational_role: "Shift A",
  company: "SecureTrack ERP",
};

function newEl(type: CardElementType, partial?: Partial<CardElement>): CardElement {
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    x: 10,
    y: 20,
    w: type === "qr" ? 18 : type === "photo" ? 26 : 40,
    h: type === "qr" ? 18 : type === "photo" ? 40 : 10,
    z: 10,
    color: "#0f172a",
    fontSize: 11,
    text: type === "text" ? "Label" : undefined,
    field: type === "field" ? "full_name" : undefined,
    fill: type === "rect" ? "#0f766e" : undefined,
    ...partial,
  };
}

export default function DesignerPage() {
  const { auth } = useUser();
  const [templates, setTemplates] = useState<WidTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [side, setSide] = useState<"front" | "back">("front");
  const [design, setDesign] = useState<CardDesign>({ front: [], back: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<CardDesign[]>([]);
  const [future, setFuture] = useState<CardDesign[]>([]);
  const [name, setName] = useState("Untitled Template");
  const [code, setCode] = useState("TPL-CUSTOM");
  const [category, setCategory] = useState("employee");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snap, setSnap] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wid_card_templates")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    const list = (data as WidTemplate[]) ?? [];
    setTemplates(list);
    if (list[0] && !templateId) {
      setTemplateId(list[0].id);
      applyTemplate(list[0]);
    }
    setLoading(false);
  };

  const applyTemplate = (t: WidTemplate) => {
    const d = (t.design_json || { front: [], back: [] }) as CardDesign;
    setDesign(d);
    setName(t.name);
    setCode(t.template_code);
    setCategory(t.category);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const elements = design[side] || [];
  const selected = elements.find((e) => e.id === selectedId) || null;

  const pushHistory = useCallback((next: CardDesign) => {
    setHistory((h) => [...h.slice(-40), design]);
    setFuture([]);
    setDesign(next);
  }, [design]);

  const updateSide = (els: CardElement[]) => {
    pushHistory({ ...design, [side]: els });
  };

  const updateSelected = (patch: Partial<CardElement>) => {
    if (!selected) return;
    updateSide(elements.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)));
  };

  const addElement = (type: CardElementType) => {
    updateSide([...elements, newEl(type, { z: elements.length + 1 })]);
  };

  const removeSelected = () => {
    if (!selected) return;
    updateSide(elements.filter((e) => e.id !== selected.id));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `${selected.type}-${Math.random().toString(36).slice(2, 8)}`, x: selected.x + 3, y: selected.y + 3 };
    updateSide([...elements, copy]);
    setSelectedId(copy.id);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setFuture((f) => [design, ...f]);
    setHistory((h) => h.slice(0, -1));
    setDesign(prev);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, design]);
    setFuture((f) => f.slice(1));
    setDesign(next);
  };

  const save = async () => {
    if (!auth?.profile?.company_id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const issues = analyzeDesign(design);
      if (templateId) {
        const current = templates.find((t) => t.id === templateId);
        const nextVersion = (current?.version || 1) + 1;
        const crudRes3 = await crudUpdate("wid_card_templates", templateId, {
            name,
            category,
            design_json: design,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          });
        if (!crudRes3.ok) throw new Error(crudRes3.error);
        const crudRes2 = await crudCreate("wid_template_versions", {
          company_id: auth.profile.company_id,
          template_id: templateId,
          version: nextVersion,
          design_json: design,
          change_note: "Designer save",
          created_by: auth.profile.id,
        });
        toast.success(`Saved v${nextVersion} — ${issues[0]}`);
      } else {
        const crudRes = await crudCreate("wid_card_templates", {
            company_id: auth.profile.company_id,
            template_code: code || `TPL-${Date.now().toString(36).toUpperCase()}`,
            name,
            category,
            design_json: design,
            created_by: auth.profile.id,
          });
        if (!crudRes.ok) throw new Error(crudRes.error);
        const data = crudRes.data as Record<string, unknown>;
        setTemplateId(String(data.id));
        toast.success("Template created");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const previewPrint = () => {
    const html = buildCardPrintHtml({
      design,
      ctx: PREVIEW_CTX,
      qrPublicId: "WID-PREVIEW",
      title: name,
    });
    printCardHtml(html);
  };

  const sorted = useMemo(
    () => [...elements].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [elements]
  );

  const analysis = analyzeDesign(design);

  if (loading) return <LoadingState message="Loading design studio…" />;

  return (
    <div>
      <PageHeader
        title="ID Card Design Studio"
        description="Canvas · layers · snap · multi-side · version history · print preview"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={undo} disabled={!history.length}><Undo2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={redo} disabled={!future.length}><Redo2 className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={previewPrint}><Printer className="h-4 w-4 mr-1" /> Preview print</Button>
            <Button size="sm" onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Palette */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Template & tools</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Load template</Label>
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  const t = templates.find((x) => x.id === v);
                  if (t) applyTemplate(t);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["employee", "executive", "factory", "security", "visitor", "contractor", "intern", "custom"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={side === "front" ? "default" : "outline"} onClick={() => setSide("front")}>Front</Button>
              <Button size="sm" variant={side === "back" ? "default" : "outline"} onClick={() => setSide("back")}>Back</Button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap to 2% grid
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  ["text", "Text"],
                  ["field", "Field"],
                  ["photo", "Photo"],
                  ["qr", "QR"],
                  ["barcode", "Barcode"],
                  ["rect", "Shape"],
                  ["logo", "Logo"],
                  ["hologram", "Hologram"],
                  ["watermark", "Watermark"],
                  ["microtext", "Microtext"],
                  ["signature", "Signature"],
                ] as [CardElementType, string][]
              ).map(([t, label]) => (
                <Button key={t} size="sm" variant="secondary" className="text-xs" onClick={() => addElement(t)}>
                  <Plus className="h-3 w-3 mr-1" />{label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">Layers ({side})</p>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {[...elements].sort((a, b) => (b.z ?? 0) - (a.z ?? 0)).map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => setSelectedId(el.id)}
                    className={`w-full text-left text-xs px-2 py-1 rounded ${selectedId === el.id ? "bg-teal-100 text-teal-900" : "hover:bg-muted"}`}
                  >
                    {el.locked ? "🔒 " : ""}{el.type}{el.field ? ` · ${el.field}` : el.text ? ` · ${el.text.slice(0, 12)}` : ""}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette className="h-4 w-4" /> Canvas · CR80 · {side}
            </CardTitle>
            <Badge variant="outline">85.6 × 53.98 mm</Badge>
          </CardHeader>
          <CardContent>
            <div
              className="relative mx-auto border border-slate-300 shadow-lg rounded-md overflow-hidden bg-white"
              style={{ width: 380, height: 240, backgroundImage: snap ? "linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)" : undefined, backgroundSize: snap ? "7.6px 4.8px" : undefined }}
              onClick={() => setSelectedId(null)}
            >
              {sorted.map((el) => (
                <div
                  key={el.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Delete" || e.key === "Backspace") removeSelected();
                  }}
                  draggable={!el.locked}
                  onDragEnd={(e) => {
                    if (el.locked) return;
                    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    let x = ((e.clientX - rect.left) / rect.width) * 100 - el.w / 2;
                    let y = ((e.clientY - rect.top) / rect.height) * 100 - el.h / 2;
                    x = Math.max(0, Math.min(100 - el.w, x));
                    y = Math.max(0, Math.min(100 - el.h, y));
                    if (snap) {
                      x = Math.round(x / 2) * 2;
                      y = Math.round(y / 2) * 2;
                    }
                    updateSide(elements.map((xel) => (xel.id === el.id ? { ...xel, x, y } : xel)));
                  }}
                  className={`absolute cursor-move ${selectedId === el.id ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                    zIndex: el.z ?? 1,
                    opacity: el.opacity ?? 1,
                    background:
                      el.type === "rect" || el.type === "ellipse"
                        ? el.fill || "#0f766e"
                        : el.type === "photo"
                          ? "#e2e8f0"
                          : el.type === "hologram"
                            ? "linear-gradient(135deg,#f0abfc,#67e8f9,#fde68a)"
                            : "transparent",
                    borderRadius: el.type === "ellipse" ? "50%" : el.type === "photo" ? 2 : 0,
                    fontSize: el.fontSize || 10,
                    color: el.color || "#0f172a",
                    fontWeight: el.bold ? 700 : 500,
                    fontFamily: el.fontFamily || "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: el.align === "center" ? "center" : "flex-start",
                    overflow: "hidden",
                    border: el.type === "photo" || el.type === "qr" ? "1px dashed #94a3b8" : undefined,
                    padding: 1,
                  }}
                >
                  {el.type === "qr" && <span className="text-[8px] w-full text-center">QR</span>}
                  {el.type === "photo" && <span className="text-[8px] w-full text-center text-slate-500">PHOTO</span>}
                  {el.type === "barcode" && <span className="text-[7px] font-mono">||||| {el.field}</span>}
                  {(el.type === "text" || el.type === "field" || el.type === "logo" || el.type === "signature" || el.type === "microtext" || el.type === "watermark") && (
                    <span className="truncate px-0.5">
                      {el.type === "field"
                        ? `{{${el.field}}}`
                        : el.text || el.type}
                    </span>
                  )}
                  {el.type === "hologram" && <span className="text-[7px] font-bold w-full text-center">HOLO</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {analysis.map((a) => (
                <p key={a} className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {a}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Properties */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!selected ? (
              <p className="text-xs text-muted-foreground">Select an element on the canvas</p>
            ) : (
              <>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={duplicateSelected}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => updateSelected({ locked: !selected.locked })}>
                    {selected.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={removeSelected}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{selected.type} · {selected.id}</p>
                {(["x", "y", "w", "h", "z"] as const).map((k) => (
                  <div key={k}>
                    <Label className="text-xs uppercase">{k}</Label>
                    <Input
                      type="number"
                      value={selected[k] ?? 0}
                      onChange={(e) => updateSelected({ [k]: Number(e.target.value) })}
                    />
                  </div>
                ))}
                {(selected.type === "text" || selected.type === "logo" || selected.type === "signature" || selected.type === "watermark" || selected.type === "microtext") && (
                  <div>
                    <Label className="text-xs">Text</Label>
                    <Input value={selected.text || ""} onChange={(e) => updateSelected({ text: e.target.value })} />
                  </div>
                )}
                {selected.type === "field" && (
                  <div>
                    <Label className="text-xs">Dynamic field</Label>
                    <Select value={selected.field || "full_name"} onValueChange={(v) => updateSelected({ field: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DYNAMIC_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(selected.type === "text" || selected.type === "field") && (
                  <>
                    <div>
                      <Label className="text-xs">Font size</Label>
                      <Input type="number" value={selected.fontSize || 10} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Color</Label>
                      <Input type="color" value={selected.color || "#0f172a"} onChange={(e) => updateSelected({ color: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={!!selected.bold} onChange={(e) => updateSelected({ bold: e.target.checked })} /> Bold
                    </label>
                  </>
                )}
                {(selected.type === "rect" || selected.type === "ellipse") && (
                  <div>
                    <Label className="text-xs">Fill</Label>
                    <Input type="color" value={selected.fill || "#0f766e"} onChange={(e) => updateSelected({ fill: e.target.value })} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
