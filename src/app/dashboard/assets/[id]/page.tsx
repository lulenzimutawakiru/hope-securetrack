"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  QrCode, MapPin, User, Wrench, FileText, Clock, Printer, ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import {
  getAssetTwin,
  assignAsset,
  unassignAsset,
  recordLocation,
  createMaintenanceFromTag,
  previewTagHtml,
  estimateRemainingLife,
  ASSIGNMENT_TYPES,
} from "@/lib/assets";

export default function AssetTwinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [twin, setTwin] = useState<Awaited<ReturnType<typeof getAssetTwin>> | null>(null);
  const [assignee, setAssignee] = useState("");
  const [assignType, setAssignType] = useState("employee");
  const [location, setLocation] = useState("");
  const [mntTitle, setMntTitle] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const t = await getAssetTwin(id);
    setTwin(t);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [id]);

  const asset = twin?.asset as Record<string, unknown> | null;

  const doAssign = async () => {
    if (!companyId || !asset || !assignee.trim()) return;
    try {
      await assignAsset({
        company_id: companyId,
        asset_id: id,
        assignee_name: assignee.trim(),
        assignment_type: assignType,
        created_by: userId,
      });
      toast.success("Assigned");
      setAssignee("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assign failed");
    }
  };

  const doUnassign = async () => {
    if (!companyId) return;
    try {
      await unassignAsset({ company_id: companyId, asset_id: id, actor_id: userId });
      toast.success("Returned");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const doLocation = async () => {
    if (!companyId || !location.trim()) return;
    try {
      await recordLocation({
        company_id: companyId,
        asset_id: id,
        location_label: location.trim(),
        recorded_by: userId,
      });
      toast.success("Location recorded");
      setLocation("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const doMaint = async () => {
    if (!companyId || !mntTitle.trim()) return;
    try {
      await createMaintenanceFromTag({
        company_id: companyId,
        asset_id: id,
        title: mntTitle.trim(),
      });
      toast.success("Maintenance request opened");
      setMntTitle("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const printTag = async () => {
    try {
      const html = await previewTagHtml(id);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        w.print();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print preview failed");
    }
  };

  if (loading) return <LoadingState message="Loading digital twin…" />;
  if (!asset) {
    return (
      <div>
        <PageHeader title="Asset not found" description="Invalid or deleted asset" />
        <Button asChild variant="outline"><Link href="/dashboard/assets/register">Back to register</Link></Button>
      </div>
    );
  }

  const life = estimateRemainingLife(
    asset.purchase_date as string | null,
    60
  );

  return (
    <div>
      <PageHeader
        title={String(asset.name)}
        description={`${asset.asset_tag} · digital twin · multi-ID · lifecycle`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/assets/register"><ArrowLeft className="h-4 w-4 mr-1" /> Register</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={printTag}>
              <Printer className="h-4 w-4 mr-1" /> Print tag
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Tag</span><p className="font-mono font-medium">{String(asset.asset_tag)}</p></div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <p><Badge variant="outline" className="capitalize">{String(asset.status)}</Badge></p>
            </div>
            <div><span className="text-muted-foreground">Manufacturer</span><p>{String(asset.manufacturer || "—")}</p></div>
            <div><span className="text-muted-foreground">Model</span><p>{String(asset.model || "—")}</p></div>
            <div><span className="text-muted-foreground">Serial</span><p className="font-mono text-xs">{String(asset.serial_number || "—")}</p></div>
            <div><span className="text-muted-foreground">Department</span><p>{String(asset.department || "—")}</p></div>
            <div><span className="text-muted-foreground">Purchase cost</span><p>{formatNumber(Number(asset.purchase_cost || 0))}</p></div>
            <div><span className="text-muted-foreground">Current value</span><p>{formatNumber(Number(asset.current_value || 0))}</p></div>
            <div><span className="text-muted-foreground">Warranty end</span><p>{String(asset.warranty_end || "—")}</p></div>
            <div><span className="text-muted-foreground">Location</span><p>{String(asset.warehouse_location || "—")}</p></div>
            <div><span className="text-muted-foreground">RUL (est.)</span><p>{life.remainingMonths} mo · {life.pct}%</p></div>
            <div><span className="text-muted-foreground">Domain / type</span><p className="uppercase">{String(asset.domain)}-{String(asset.type_code)}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" /> Identifiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(twin?.identifiers || []).map((i: Record<string, unknown>) => (
              <div key={String(i.id)} className="rounded border p-2 text-xs">
                <div className="flex justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase">{String(i.id_type)}</Badge>
                  {i.is_primary ? <Badge className="text-[10px]">Primary</Badge> : null}
                </div>
                <p className="font-mono mt-1 break-all">{String(i.id_value)}</p>
                {i.symbology ? <p className="text-muted-foreground">{String(i.symbology)}</p> : null}
              </div>
            ))}
            {(twin?.identifiers || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No identifiers</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(twin?.assignments || []).slice(0, 3).map((a: Record<string, unknown>) => (
              <div key={String(a.id)} className="text-sm border rounded p-2">
                <div className="flex justify-between">
                  <span className="font-medium">{String(a.assignee_name)}</span>
                  <Badge variant="outline" className="text-[10px]">{String(a.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{String(a.assignment_type)} · {String(a.assigned_at || "").slice(0, 10)}</p>
              </div>
            ))}
            <div className="grid gap-2">
              <Select value={assignType} onValueChange={setAssignType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Assignee name" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={doAssign}>Assign</Button>
                <Button size="sm" variant="outline" onClick={doUnassign}>Return</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(twin?.locations || []).slice(0, 5).map((l: Record<string, unknown>) => (
              <div key={String(l.id)} className="text-sm flex justify-between border-b pb-1">
                <span>{String(l.location_label)}</span>
                <span className="text-xs text-muted-foreground">{String(l.recorded_at || "").slice(0, 16)}</span>
              </div>
            ))}
            <Label className="text-xs">Record location</Label>
            <Input placeholder="Building / rack / GPS label" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button size="sm" onClick={doLocation}>Save location</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(twin?.maintenance || []).map((m: Record<string, unknown>) => (
              <div key={String(m.id)} className="text-sm border rounded p-2">
                <div className="flex justify-between">
                  <span className="font-medium">{String(m.title)}</span>
                  <Badge variant="outline" className="text-[10px]">{String(m.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{String(m.work_order_ref)} · {String(m.maintenance_type)}</p>
              </div>
            ))}
            <Input placeholder="Maintenance request title" value={mntTitle} onChange={(e) => setMntTitle(e.target.value)} />
            <Button size="sm" onClick={doMaint}>Open work request</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {(twin?.events || []).map((e: Record<string, unknown>) => (
              <div key={String(e.id)} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                <p className="font-medium">{String(e.title)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(e.event_type)} · {String(e.created_at || "").slice(0, 16)}
                </p>
              </div>
            ))}
            {(twin?.events || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(twin?.documents || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(twin?.documents || []).map((d: Record<string, unknown>) => (
              <p key={String(d.id)} className="text-sm">{String(d.title || d.doc_type)}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
