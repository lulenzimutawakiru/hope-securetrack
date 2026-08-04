"use client";

import { useEffect, useState } from "react";
import { Link2, ShieldCheck, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { verifyIntegrityChain } from "@/lib/audit";

export default function AuditIntegrityPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [checkpoints, setCheckpoints] = useState<Array<Record<string, unknown>>>([]);
  const [lastResult, setLastResult] = useState<{
    valid: boolean;
    message: string;
    events_checked: number;
    root_hash?: string | null;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_integrity_checkpoints")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setCheckpoints((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const runVerify = async () => {
    if (!companyId) {
      toast.error("No company context");
      return;
    }
    setVerifying(true);
    try {
      const res = await verifyIntegrityChain(companyId, 500);
      setLastResult(res);
      toast[res.valid ? "success" : "error"](res.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <LoadingState message="Loading integrity chain…" />;

  return (
    <div>
      <PageHeader
        title="Integrity & Hash Chain"
        description="Append-only · prev/hash · digital signature · chain-of-custody checkpoints"
        actions={
          <Button size="sm" onClick={runVerify} disabled={verifying}>
            <Link2 className="h-4 w-4 mr-1" />
            {verifying ? "Verifying…" : "Verify chain"}
          </Button>
        }
      />

      {lastResult && (
        <Card className="mb-6">
          <CardContent className="pt-4 flex items-start gap-3">
            {lastResult.valid ? (
              <ShieldCheck className="h-8 w-8 text-green-600 shrink-0" />
            ) : (
              <ShieldX className="h-8 w-8 text-destructive shrink-0" />
            )}
            <div>
              <p className="font-medium">{lastResult.valid ? "Chain valid" : "Chain integrity issue"}</p>
              <p className="text-sm text-muted-foreground">{lastResult.message}</p>
              <p className="text-xs mt-1">
                Events checked: {lastResult.events_checked}
                {lastResult.root_hash ? (
                  <> · Root: <code className="font-mono">{String(lastResult.root_hash).slice(0, 24)}…</code></>
                ) : null}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {checkpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Run verification to create the first checkpoint.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Root hash</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkpoints.map((c) => (
                    <TableRow key={String(c.id)}>
                      <TableCell className="font-mono text-xs">{String(c.checkpoint_number)}</TableCell>
                      <TableCell className="text-xs">
                        {String(c.from_chain_index)} → {String(c.to_chain_index)}
                      </TableCell>
                      <TableCell>{String(c.events_count)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "valid" ? "default" : "destructive"}
                          className="text-[10px] capitalize"
                        >
                          {String(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[140px] truncate">
                        {String(c.root_hash)}
                      </TableCell>
                      <TableCell className="text-xs">{formatDateTime(String(c.created_at))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
