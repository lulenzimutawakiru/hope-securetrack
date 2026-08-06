"use client";

import { useEffect, useState } from "react";
import { Siren, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { declareMajorIncident } from "@/lib/service-desk";
import { formatDateTime } from "@/lib/utils";

export default function MajorIncidentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    impact_summary: "",
    commander_name: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_major_incidents")
      .select("*")
      .order("started_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const declare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const mi = await declareMajorIncident({
        company_id: companyId,
        title: form.title,
        impact_summary: form.impact_summary,
        commander_name: form.commander_name,
        created_by: userId,
      });
      toast.success(`Declared ${mi.incident_number} · executives notified`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") {
      patch.resolved_at = new Date().toISOString();
    }
    await crudUpdate("sd_major_incidents", id, patch);
    toast.success(`Status → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading major incident war room…" />;

  const active = rows.filter((r) => !["closed", "resolved"].includes(String(r.status)));

  return (
    <div>
      <PageHeader
        title="Major Incident Management"
        description="War room · executive notification · bridge · timeline · P1 war-room"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive">
                <Siren className="h-4 w-4 mr-1" /> Declare MI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={declare}>
                <DialogHeader><DialogTitle>Declare major incident</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Impact summary</Label>
                    <Input value={form.impact_summary} onChange={(e) => setForm((f) => ({ ...f, impact_summary: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Incident commander</Label>
                    <Input value={form.commander_name} onChange={(e) => setForm((f) => ({ ...f, commander_name: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Declare</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {active.length > 0 && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 text-sm">
            <strong className="text-destructive">{active.length} active major incident(s).</strong>{" "}
            Executive notifications are on. Keep bridge link and timeline updated.
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No major incidents" description="Declare a P1 war room when multi-team impact occurs." icon={Siren} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Commander</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.incident_number)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{String(r.title)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{String(r.impact_summary || "")}</p>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.commander_name || "—")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={["declared", "active"].includes(String(r.status)) ? "destructive" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {String(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.started_at))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "declared" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "active")}>Activate</Button>
                    )}
                    {["declared", "active", "mitigating"].includes(String(r.status)) && (
                      <Button size="sm" onClick={() => setStatus(String(r.id), "resolved")}>Resolve</Button>
                    )}
                    {r.status === "resolved" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(String(r.id), "closed")}>Close</Button>
                    )}
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
