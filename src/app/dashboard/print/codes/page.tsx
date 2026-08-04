"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import {
  BARCODE_SYMBOLOGIES,
  buildQrPayload,
  qrPreviewDataUrl,
  barcodePreviewBars,
  validateEan13,
  sanitizeCode128,
  type QrPurpose,
} from "@/lib/print";

const QR_PURPOSES: { value: QrPurpose; label: string }[] = [
  { value: "product_auth", label: "Product Authentication" },
  { value: "employee_id", label: "Employee ID" },
  { value: "portal", label: "Customer Portal" },
  { value: "asset", label: "Asset Tracking" },
  { value: "inventory", label: "Inventory" },
  { value: "attendance", label: "Attendance" },
  { value: "url", label: "URL" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "vcard", label: "vCard" },
];

export default function PrintCodesPage() {
  const [presets, setPresets] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState<QrPurpose>("product_auth");
  const [payloadField, setPayloadField] = useState("https://hope-securetrack.vercel.app/verify?s=HDG-001");
  const [symbology, setSymbology] = useState("code128");
  const [barcodeValue, setBarcodeValue] = useState("HDG-REAM-000001");

  useEffect(() => {
    async function load() {
      const { data } = await createClient().from("prt_barcode_presets").select("*").eq("is_active", true);
      setPresets((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading code engine…" />;

  const qrData: Record<string, string> = {
    verify_url: payloadField,
    url: payloadField,
    serial: "HDG-001",
    name: "Jane Doe",
    org: "SecureTrack ERP",
    phone: "+256700000000",
    email: "info@hopedesign.ug",
    ssid: "SecureTrackGuest",
    password: "",
    encryption: "WPA",
    code: "AST-001",
    sku: "HDG-PPR-A4",
    location: "A-01-02",
    employee_number: "EMP-001",
    portal_url: payloadField,
  };
  const qrPayload = buildQrPayload(purpose, qrData);
  const qrImg = qrPreviewDataUrl(qrPayload, 160);
  const bcVal = symbology === "code128" ? sanitizeCode128(barcodeValue) : barcodeValue;
  const bcImg = barcodePreviewBars(bcVal, 240, 48);
  const eanOk = symbology === "ean13" ? validateEan13(barcodeValue) : true;

  return (
    <div>
      <PageHeader
        title="QR & Barcode Engine"
        description="QR auth · Code 128 · EAN-13 · Data Matrix · GS1 · vCard · Wi-Fi"
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">QR generator</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as QrPurpose)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QR_PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payload / URL / data</Label>
              <Input value={payloadField} onChange={(e) => setPayloadField(e.target.value)} />
            </div>
            <div className="flex justify-center p-4 bg-white rounded border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImg} alt="QR preview" width={160} height={160} />
            </div>
            <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{qrPayload}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Barcode generator</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Symbology</Label>
              <Select value={symbology} onValueChange={setSymbology}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BARCODE_SYMBOLOGIES.filter((s) => s.value !== "qr").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} />
              {!eanOk && <p className="text-xs text-destructive mt-1">Invalid EAN-13 check digit</p>}
            </div>
            <div className="flex justify-center p-4 bg-white rounded border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bcImg} alt="Barcode preview" />
            </div>
            <p className="text-center text-xs font-mono">{bcVal}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> Presets
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No DB presets — engine still works offline.</p>
          ) : (
            presets.map((p) => (
              <Badge key={String(p.id)} variant="outline" className="text-xs py-1">
                {String(p.name)} · {String(p.symbology)}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
