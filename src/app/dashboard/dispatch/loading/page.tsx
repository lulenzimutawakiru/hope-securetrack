"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { startLoading, scanLoadingItem, completeLoading } from "@/lib/dispatch";

export default function DispatchLoadingPage() {
  const { auth } = useUser();
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [scans, setScans] = useState<Array<Record<string, unknown>>>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [scanVal, setScanVal] = useState("");
  const [expected, setExpected] = useState("10");
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: r }, { data: s }] = await Promise.all([
      sb.from("dsp_requests").select("id, request_number, customer_name, status").in("status", ["pending", "planned", "assigned", "loading", "ready"]).is("deleted_at", null),
      sb.from("dsp_loading_sessions").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    setRequests((r as Array<Record<string, unknown>>) || []);
    setSessions((s as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    createClient()
      .from("dsp_loading_scans")
      .select("*")
      .eq("session_id", sessionId)
      .order("scanned_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setScans((data as Array<Record<string, unknown>>) || []));
  }, [sessionId]);

  const start = async () => {
    if (!companyId || !requestId) return;
    try {
      const s = await startLoading({
        company_id: companyId,
        request_id: requestId,
        expected_items: Number(expected) || 0,
        operator_id: userId,
        loading_bay: "BAY-A1",
      });
      setSessionId(s.id);
      toast.success(`Loading ${s.session_number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const scan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !sessionId || !scanVal.trim()) return;
    try {
      const row = await scanLoadingItem({
        company_id: companyId,
        session_id: sessionId,
        scan_value: scanVal,
        scanned_by: userId,
      });
      toast[row.matched ? "success" : "error"](row.matched ? "Matched" : "Mismatch");
      setScanVal("");
      const { data } = await createClient().from("dsp_loading_scans").select("*").eq("session_id", sessionId).order("scanned_at", { ascending: false });
      setScans((data as Array<Record<string, unknown>>) || []);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    }
  };

  const finish = async () => {
    if (!sessionId) return;
    try {
      await completeLoading(sessionId, false);
      toast.success("Loading verified & sealed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cannot complete");
    }
  };

  if (loading) return <LoadingState message="Loading bay ops…" />;

  const active = sessions.find((s) => s.id === sessionId);

  return (
    <div>
      <PageHeader
        title="Loading Management"
        description="QR/barcode verify · weight · capacity · seal before dispatch"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Start loading</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Request</Label>
              <Select value={requestId} onValueChange={setRequestId}>
                <SelectTrigger><SelectValue placeholder="Select request" /></SelectTrigger>
                <SelectContent>
                  {requests.map((r) => (
                    <SelectItem key={String(r.id)} value={String(r.id)}>
                      {String(r.request_number)} — {String(r.customer_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected scans</Label>
              <Input type="number" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
            <Button onClick={start}>Start session</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              {active ? String(active.session_number) : "No active session"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {active && (
              <>
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline">Scanned {String(active.scanned_items)}/{String(active.expected_items)}</Badge>
                  <Badge variant={Number(active.mismatch_count) > 0 ? "destructive" : "outline"}>
                    Mismatch {String(active.mismatch_count)}
                  </Badge>
                </div>
                <form onSubmit={scan} className="flex gap-2">
                  <Input autoFocus placeholder="Scan QR / barcode / asset tag" value={scanVal} onChange={(e) => setScanVal(e.target.value)} />
                  <Button type="submit">Scan</Button>
                </form>
                <Button variant="outline" onClick={finish}>Verify & seal</Button>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {scans.map((s) => (
                    <div key={String(s.id)} className="text-xs flex justify-between border-b py-1">
                      <span className="font-mono">{String(s.scan_value)}</span>
                      <Badge variant={s.matched ? "default" : "destructive"} className="text-[9px]">
                        {s.matched ? "OK" : "FAIL"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-medium mt-8 mb-2">Recent sessions</h3>
      <div className="space-y-1">
        {sessions.map((s) => (
          <button
            key={String(s.id)}
            type="button"
            className="w-full text-left text-sm border rounded p-2 hover:bg-muted/40"
            onClick={() => setSessionId(String(s.id))}
          >
            <span className="font-mono text-xs mr-2">{String(s.session_number)}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{String(s.status)}</Badge>
            <span className="text-xs text-muted-foreground ml-2">
              {String(s.scanned_items)}/{String(s.expected_items)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
