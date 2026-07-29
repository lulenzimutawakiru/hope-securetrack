"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QrCode, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";

function ScanInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { auth } = useUser();
  const [tag, setTag] = useState(sp.get("tag") || "");
  const [loading, setLoading] = useState(false);
  const [asset, setAsset] = useState<Record<string, unknown> | null>(null);
  const [identifiers, setIdentifiers] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  const lookup = async (value?: string) => {
    const raw = (value || tag).trim();
    if (!raw) {
      toast.error("Enter asset tag, serial, RFID, or NFC UID");
      return;
    }
    setLoading(true);
    try {
      let lookupVal = raw;
      if (raw.includes("tag=")) {
        try {
          const u = new URL(raw, window.location.origin);
          lookupVal = u.searchParams.get("tag") || raw;
        } catch {
          /* ignore */
        }
      }
      // Encrypted JSON payload
      if (lookupVal.startsWith("{")) {
        try {
          const j = JSON.parse(lookupVal) as { tag?: string };
          if (j.tag) lookupVal = j.tag;
        } catch {
          /* ignore */
        }
      }

      const sb = createClient();
      let q = sb.from("ast_assets").select("*").is("deleted_at", null);
      if (companyId) q = q.eq("company_id", companyId);

      const upper = lookupVal.toUpperCase();
      let { data: found } = await q
        .or(`asset_tag.eq.${upper},serial_number.eq.${lookupVal}`)
        .maybeSingle();

      if (!found) {
        let idQ = sb.from("ast_identifiers").select("asset_id").eq("id_value", lookupVal);
        if (companyId) idQ = idQ.eq("company_id", companyId);
        const { data: ident } = await idQ.maybeSingle();
        if (ident?.asset_id) {
          const { data: a } = await sb.from("ast_assets").select("*").eq("id", ident.asset_id).maybeSingle();
          found = a;
        }
      }

      if (!found) {
        setAsset(null);
        setIdentifiers([]);
        toast.error("Asset not found");
        return;
      }

      setAsset(found as Record<string, unknown>);
      setTag(String(found.asset_tag));
      const { data: ids } = await sb.from("ast_identifiers").select("*").eq("asset_id", found.id);
      setIdentifiers((ids as Array<Record<string, unknown>>) || []);
      toast.success(`Verified ${found.asset_tag}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = sp.get("tag");
    if (initial) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Scan / Verify Asset"
        description="QR · barcode · RFID · NFC · signed payload · mobile camera"
      />

      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            autoFocus
            placeholder="HDG-IT-LAP-000001 or paste QR payload"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => lookup()} disabled={loading}>
              <Search className="h-4 w-4 mr-1" /> {loading ? "Searching…" : "Verify"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/assets/mobile">Mobile ops</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {asset && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <span className="font-mono">{String(asset.asset_tag)}</span>
              <Badge variant="outline" className="capitalize">{String(asset.status)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium text-lg">{String(asset.name)}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Serial</span><p className="font-mono text-xs">{String(asset.serial_number || "—")}</p></div>
              <div><span className="text-muted-foreground">Department</span><p>{String(asset.department || "—")}</p></div>
              <div><span className="text-muted-foreground">Location</span><p>{String(asset.warehouse_location || "—")}</p></div>
              <div><span className="text-muted-foreground">Value</span><p>{formatNumber(Number(asset.current_value || 0))}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {identifiers.map((i) => (
                <Badge key={String(i.id)} variant="secondary" className="text-[10px] uppercase">
                  {String(i.id_type)}: {String(i.id_value).slice(0, 24)}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/dashboard/assets/${asset.id}`}>Open digital twin</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/assets/maintenance`)}>
                Report fault
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AssetScanPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading scanner…" />}>
      <ScanInner />
    </Suspense>
  );
}
