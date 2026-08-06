"use client";

import { useEffect, useState } from "react";
import { Printer, Check, X, RotateCcw, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import {
  buildCardPrintHtml,
  contextFromIdentity,
  printCardHtml,
  type CardDesign,
} from "@/lib/workforce-id";

type PrintJob = {
  id: string;
  job_number: string;
  status: string;
  printer_brand: string | null;
  printer_name: string | null;
  priority: number | null;
  attempts: number | null;
  error_message: string | null;
  created_at: string;
  credential_id: string;
  wid_credentials?: {
    credential_number: string;
    qr_public_id: string | null;
    status: string;
    print_count: number | null;
    wid_identities?: Record<string, unknown> | null;
    wid_card_templates?: { design_json: CardDesign; name: string } | null;
  } | null;
};

const BRANDS = ["browser", "zebra", "evolis", "fargo", "hid", "magicard", "standard"];

export default function PrintQueuePage() {
  const { auth } = useUser();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wid_print_jobs")
      .select(
        "*, wid_credentials(credential_number,qr_public_id,status,print_count,wid_identities(*),wid_card_templates(design_json,name))"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    setJobs((data as PrintJob[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    const crudRes5 = await crudUpdate("wid_print_jobs", id, { status, updated_at: new Date().toISOString(), ...extra });
    if (!crudRes5.ok) throw new Error(crudRes5.error);
    if (auth?.profile?.company_id) {
      await crudCreate("wid_print_history", {
        company_id: auth.profile.company_id,
        print_job_id: id,
        event_type: status,
        message: `Job ${status}`,
        actor_id: auth.profile.id,
      });
    }
  };

  const approve = async (id: string) => {
    try {
      await updateStatus(id, "approved", { approved_by: auth?.profile?.id });
      toast.success("Print approved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const printNow = async (job: PrintJob) => {
    try {
      const cred = job.wid_credentials;
      const identity = cred?.wid_identities;
      if (!cred || !identity) throw new Error("Credential data missing");
      const design = (cred.wid_card_templates?.design_json || { front: [], back: [] }) as CardDesign;
      const html = buildCardPrintHtml({
        design,
        ctx: contextFromIdentity(identity, cred as unknown as Record<string, unknown>),
        qrPublicId: cred.qr_public_id,
        title: cred.credential_number,
      });
      await updateStatus(job.id, "printing", {
        started_at: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
      });
      printCardHtml(html);
      await updateStatus(job.id, "completed", { completed_at: new Date().toISOString() });
      const supabase = createClient();
      await crudUpdate("wid_credentials", job.credential_id, {
          status: cred.status === "active" ? "active" : "printed",
          printed_at: new Date().toISOString(),
          print_count: (cred.print_count || 0) + 1,
        });

      // decrement inventory if available
      const { data: inv } = await supabase
        .from("wid_card_inventory")
        .select("*")
        .eq("status", "available")
        .gt("quantity_available", 0)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (inv) {
        await crudUpdate("wid_card_inventory", inv.id, {
            quantity_available: inv.quantity_available - 1,
            quantity_used: (inv.quantity_used || 0) + 1,
            updated_at: new Date().toISOString(),
          });
      }

      toast.success("Printed");
      await load();
    } catch (e) {
      try {
        await updateStatus(job.id, "failed", {
          error_message: e instanceof Error ? e.message : "Print error",
        });
      } catch {
        /* ignore */
      }
      toast.error(e instanceof Error ? e.message : "Print failed");
      await load();
    }
  };

  const retry = async (job: PrintJob) => {
    try {
      await updateStatus(job.id, "queued", { error_message: null });
      toast.success("Re-queued");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    }
  };

  const cancel = async (id: string) => {
    try {
      await updateStatus(id, "cancelled");
      toast.success("Cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const setBrand = async (id: string, brand: string) => {
    await crudUpdate("wid_print_jobs", id, { printer_brand: brand, printer_name: `${brand} printer`, updated_at: new Date().toISOString() });
    await load();
  };

  if (loading) return <LoadingState message="Loading print queue…" />;

  const pending = jobs.filter((j) => ["pending", "approved", "queued"].includes(j.status)).length;

  return (
    <div>
      <PageHeader
        title="Card Print Management"
        description="Zebra · Evolis · Fargo · HID · Magicard · browser — queue · approve · retry · history"
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Queue" value={String(pending)} icon={Printer} />
        <StatCard title="Completed" value={String(jobs.filter((j) => j.status === "completed").length)} icon={Check} />
        <StatCard title="Failed" value={String(jobs.filter((j) => j.status === "failed").length)} icon={X} />
        <StatCard title="Total jobs" value={String(jobs.length)} icon={Play} />
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="Print queue empty" description="Issue a credential to enqueue a print job." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Credential</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">{j.job_number}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{j.wid_credentials?.credential_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(j.wid_credentials?.wid_identities?.full_name || "")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={j.printer_brand || "browser"}
                      onValueChange={(v) => setBrand(j.id, v)}
                    >
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BRANDS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={j.status} />
                    {j.error_message && (
                      <p className="text-[10px] text-red-600 mt-0.5">{j.error_message}</p>
                    )}
                  </TableCell>
                  <TableCell>{j.attempts ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {j.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => approve(j.id)}>Approve</Button>
                    )}
                    {["pending", "approved", "queued", "failed", "retrying"].includes(j.status) && (
                      <Button size="sm" onClick={() => printNow(j)}>
                        <Printer className="h-3.5 w-3.5 mr-1" /> Print
                      </Button>
                    )}
                    {j.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => retry(j)}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!["completed", "cancelled"].includes(j.status) && (
                      <Button size="sm" variant="ghost" onClick={() => cancel(j.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
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
