"use client";

import { useEffect, useState } from "react";
import { KeyRound, Unlock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { releaseSecureJob, holdForSecureRelease } from "@/lib/print";

export default function SecureReleasePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [pin, setPin] = useState("");

  const load = async () => {
    const { data } = await createClient()
      .from("prt_queue")
      .select("*, printers(name)")
      .or("status.eq.held,secure_release.eq.true")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const release = async () => {
    if (!selected) return;
    try {
      await releaseSecureJob({
        queue_id: String(selected.id),
        pin,
        released_by: auth?.user?.id,
      });
      toast.success("Job released to printer queue");
      setSelected(null);
      setPin("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Release failed");
    }
  };

  const hold = async (id: string) => {
    try {
      const { release_pin } = await holdForSecureRelease(id);
      toast.success(`Held with PIN ${release_pin}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading secure release…" />;

  return (
    <div>
      <PageHeader
        title="Secure Print Release"
        description="PIN release · confidential documents · remote unlock · mobile friendly"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No held jobs"
          description="Hold confidential jobs from the queue or generate secure PDFs."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.queue_number)}</TableCell>
                    <TableCell className="text-sm font-medium">{String(r.job_title)}</TableCell>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.release_pin ? "••••" : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "held" ? (
                        <Button size="sm" onClick={() => setSelected(r)}>
                          <Unlock className="h-3 w-3 mr-1" /> Release
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => hold(String(r.id))}>
                          Hold
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enter release PIN</DialogTitle></DialogHeader>
          <div className="py-3">
            <Label>PIN for {String(selected?.job_title || "")}</Label>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4-digit PIN"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-2">
              PIN was shown when the job was held. Contact admin if lost.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={release} disabled={pin.length < 4}>Release print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
