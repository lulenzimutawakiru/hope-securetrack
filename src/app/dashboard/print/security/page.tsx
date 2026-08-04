"use client";

import { useEffect, useState } from "react";
import { Shield, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { securityChecklist, buildSecurityOverlay, hashPayload } from "@/lib/print";

export default function PrintSecurityPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    profile_code: "",
    name: "",
    watermark_text: "AUTHENTIC · SECURETRACK GROUP",
    microtext: "HOPE-SECURE-TRACK-MICRO",
    serial_prefix: "SEC",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("prt_security_profiles")
      .select("*")
      .order("profile_code");
    setRows((data as Array<Record<string, unknown>>) || []);
    if (data?.[0]) setSelected(data[0] as Record<string, unknown>);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("prt_security_profiles", {
        company_id: companyId,
        profile_code: form.profile_code.toUpperCase(),
        name: form.name,
        watermark_text: form.watermark_text,
        microtext: form.microtext,
        serial_prefix: form.serial_prefix,
        tamper_qr: true,
        digital_signature: true,
        hologram_zone: false,
        uv_placeholder: false,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Security profile created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading security profiles…" />;

  const opts = selected
    ? {
        watermark: String(selected.watermark_text || ""),
        microtext: String(selected.microtext || ""),
        tamperQr: Boolean(selected.tamper_qr),
        digitalSignature: Boolean(selected.digital_signature),
        hologramZone: Boolean(selected.hologram_zone),
        uvPlaceholder: Boolean(selected.uv_placeholder),
        serialPrefix: String(selected.serial_prefix || "SEC"),
      }
    : {
        watermark: "AUTHENTIC",
        microtext: "SECURE",
        tamperQr: true,
        digitalSignature: true,
        hologramZone: false,
        uvPlaceholder: false,
        serialPrefix: "SEC",
      };

  const checklist = securityChecklist(opts);
  const overlay = buildSecurityOverlay(opts);
  const sampleHash = hashPayload(`${opts.serialPrefix}-0001-${opts.watermark}`);

  return (
    <div>
      <PageHeader
        title="Security Printing"
        description="Watermarks · microtext · UV · hologram zones · tamper QR · signatures · serials"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New profile</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Security profile</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.profile_code} onChange={(e) => setForm((f) => ({ ...f, profile_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Serial prefix</Label>
                      <Input value={form.serial_prefix} onChange={(e) => setForm((f) => ({ ...f, serial_prefix: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Watermark</Label>
                    <Input value={form.watermark_text} onChange={(e) => setForm((f) => ({ ...f, watermark_text: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Microtext</Label>
                    <Input value={form.microtext} onChange={(e) => setForm((f) => ({ ...f, microtext: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Shield} title="No security profiles" description="Create anti-counterfeit print profiles." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 ${
                  selected?.id === r.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="font-medium text-sm">{String(r.name)}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{String(r.profile_code)}</div>
              </button>
            ))}
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{selected ? String(selected.name) : "Profile"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {checklist.map((c) => (
                  <Badge key={c.item} variant={c.ok ? "default" : "outline"} className="text-[10px]">
                    {c.ok ? "✓" : "○"} {c.item}
                  </Badge>
                ))}
              </div>
              <div
                className="relative h-48 rounded border bg-white overflow-hidden"
                dangerouslySetInnerHTML={{
                  __html: `<style>${overlay.css}</style>${overlay.html.replace("{{hash}}", sampleHash)}`,
                }}
              />
              <p className="text-xs text-muted-foreground font-mono">
                Serial: {overlay.serialHint.replace("{{seq}}", "0001")} · SIG:{sampleHash}
              </p>
              <p className="text-sm text-muted-foreground">
                Apply this profile on authentication labels, certificates, and high-value packaging artwork.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
