"use client";

import { useEffect, useState } from "react";
import { Printer, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { toast } from "sonner";
import { previewTagHtml, buildTagLabelHtml } from "@/lib/assets";
import { crudList } from "@/lib/api/crud-client";

export default function AssetTagsPage() {
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    async function load() {
      const [aRes, tRes] = await Promise.all([
        crudList<Record<string, unknown>>("ast_assets", {
          page: 1,
          pageSize: 100,
          sort: "asset_tag",
          order: "asc",
        }),
        crudList<Record<string, unknown>>("ast_tag_templates", {
          page: 1,
          pageSize: 50,
          sort: "template_code",
          order: "asc",
        }),
      ]);
      const a = aRes.ok ? aRes.data.data : [];
      const t = tRes.ok ? tRes.data.data : [];
      setAssets(a);
      setTemplates(t);
      if (t[0]) setTemplateId(String(t[0].id));
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const selectAll = () => {
    if (selected.length === assets.length) setSelected([]);
    else setSelected(assets.map((a) => String(a.id)));
  };

  const previewOne = async (id: string) => {
    try {
      const html = await previewTagHtml(id);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const batchPrint = async () => {
    if (selected.length === 0) {
      toast.error("Select assets to print");
      return;
    }
    const parts: string[] = [];
    for (const id of selected) {
      const a = assets.find((x) => String(x.id) === id);
      if (!a) continue;
      parts.push(
        buildTagLabelHtml({
          assetTag: String(a.asset_tag),
          name: String(a.name),
          department: a.department ? String(a.department) : undefined,
          serial: a.serial_number ? String(a.serial_number) : undefined,
        })
      );
    }
    const html = `<!DOCTYPE html><html><head><title>Batch asset tags</title>
      <style>@media print{.page{page-break-after:always}} body{margin:0;font-family:system-ui}</style>
      </head><body>${parts.map((p) => `<div class="page">${p}</div>`).join("")}</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
    toast.success(`Prepared ${selected.length} tag(s)`);
  };

  if (loading) return <LoadingState message="Loading tag designer…" />;

  return (
    <div>
      <PageHeader
        title="Asset Tag Print"
        description="Company logo · QR · barcode · RFID indicator · polyester / metal plates"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>
              {selected.length === assets.length ? "Clear" : "Select all"}
            </Button>
            <Button size="sm" onClick={batchPrint}>
              <Printer className="h-4 w-4 mr-1" /> Print batch ({selected.length})
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Label template</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>
                  {String(t.name)} ({String(t.width_mm)}×{String(t.height_mm)} mm)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Printers: Niimbot · Zebra · Brother · Epson · TSC · HP (via Print Ops queue)
          </p>
          <Button asChild size="sm" variant="outline">
            <a href="/dashboard/print">Open Print Ops</a>
          </Button>
        </CardContent>
      </Card>

      {assets.length === 0 ? (
        <EmptyState title="No assets" description="Register assets first." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={String(a.id)}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(String(a.id))}
                      onChange={() => toggle(String(a.id))}
                      aria-label={`Select ${a.asset_tag}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(a.asset_tag)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(a.name)}</TableCell>
                  <TableCell className="text-xs">{String(a.department || "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(a.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => previewOne(String(a.id))}>
                      <Eye className="h-4 w-4" />
                    </Button>
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
