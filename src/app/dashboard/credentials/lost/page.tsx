"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import {
  generateIncidentNumber,
  issueCredential,
  suspendCredential,
} from "@/lib/workforce-id";

type Incident = {
  id: string;
  incident_number: string;
  incident_type: string;
  status: string;
  description: string | null;
  reported_at: string;
  replacement_credential_id: string | null;
  credential_id: string;
  identity_id: string | null;
  wid_credentials?: { credential_number: string; status: string } | null;
  wid_identities?: { full_name: string; identity_number: string } | null;
};

const FLOW = [
  "reported",
  "manager_review",
  "security_review",
  "card_disabled",
  "replacement_issued",
  "closed",
];

export default function LostStolenPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Incident[]>([]);
  const [credentials, setCredentials] = useState<
    Array<{ id: string; credential_number: string; identity_id: string; status: string; template_id: string | null; wid_identities?: { full_name: string } | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    credential_id: "",
    incident_type: "lost",
    description: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: creds }] = await Promise.all([
      supabase
        .from("wid_card_incidents")
        .select("*, wid_credentials(credential_number,status), wid_identities(full_name,identity_number)")
        .order("reported_at", { ascending: false }),
      supabase
        .from("wid_credentials")
        .select("id,credential_number,identity_id,status,template_id,wid_identities(full_name)")
        .in("status", ["active", "issued", "printed", "suspended"])
        .is("deleted_at", null)
        .limit(200),
    ]);
    setRows((data as Incident[]) ?? []);
    setCredentials((creds as unknown as typeof credentials) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const report = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.credential_id) return;
    try {
      const supabase = createClient();
      const cred = credentials.find((c) => c.id === form.credential_id);
      if (!cred) throw new Error("Credential not found");
      const { count } = await supabase
        .from("wid_card_incidents")
        .select("*", { count: "exact", head: true })
        .eq("company_id", auth.profile.company_id);
      const crudRes4 = await crudCreate("wid_card_incidents", {
        company_id: auth.profile.company_id,
        credential_id: form.credential_id,
        identity_id: cred.identity_id,
        incident_number: generateIncidentNumber((count ?? 0) + 1),
        incident_type: form.incident_type,
        description: form.description || null,
        reported_by: auth.profile.id,
        status: "reported",
      });
      if (!crudRes4.ok) throw new Error(crudRes4.error);
      toast.success("Incident reported — proceed through approval workflow");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const advance = async (inc: Incident) => {
    if (!auth?.profile?.company_id) return;
    const idx = FLOW.indexOf(inc.status);
    if (idx < 0 || idx >= FLOW.length - 1) return;
    const next = FLOW[idx + 1];
    const supabase = createClient();
    const patch: Record<string, unknown> = {
      status: next,
      updated_at: new Date().toISOString(),
    };

    try {
      if (next === "manager_review") {
        /* waiting */
      }
      if (next === "security_review") {
        patch.manager_approved_by = auth.profile.id;
        patch.manager_approved_at = new Date().toISOString();
      }
      if (next === "card_disabled") {
        patch.security_reviewed_by = auth.profile.id;
        patch.security_reviewed_at = new Date().toISOString();
        await suspendCredential(
          supabase,
          inc.credential_id,
          `${inc.incident_type} — disabled via incident ${inc.incident_number}`
        );
        const crudRes3 = await crudUpdate("wid_credentials", inc.credential_id, {
            status: inc.incident_type === "stolen" ? "stolen" : inc.incident_type === "damaged" ? "damaged" : "lost",
            updated_at: new Date().toISOString(),
          });
      }
      if (next === "replacement_issued") {
        const newCred = await issueCredential(supabase, {
          company_id: auth.profile.company_id,
          identity_id: inc.identity_id!,
          template_id: null,
          with_rfid: true,
          with_nfc: true,
          created_by: auth.profile.id,
          auto_queue_print: true,
        });
        const crudRes2 = await crudUpdate("wid_credentials", newCred.id, { replacement_of: inc.credential_id });
        patch.replacement_credential_id = newCred.id;
      }
      if (next === "closed") {
        patch.closed_at = new Date().toISOString();
      }

      const crudRes = await crudUpdate("wid_card_incidents", inc.id, patch);
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success(`Advanced to ${next.replace(/_/g, " ")}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Advance failed");
    }
  };

  if (loading) return <LoadingState message="Loading incidents…" />;

  return (
    <div>
      <PageHeader
        title="Lost / Stolen Card Management"
        description="Report → manager → security → disable → replace → audit"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Report incident</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Report lost / stolen / damaged</DialogTitle></DialogHeader>
              <form onSubmit={report} className="space-y-3">
                <div>
                  <Label>Credential</Label>
                  <Select value={form.credential_id} onValueChange={(v) => setForm((f) => ({ ...f, credential_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                    <SelectContent>
                      {credentials.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.credential_number} · {c.wid_identities?.full_name} ({c.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.incident_type} onValueChange={(v) => setForm((f) => ({ ...f, incident_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["lost", "stolen", "damaged", "found", "misuse"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <DialogFooter><Button type="submit">Submit report</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 text-xs text-muted-foreground">
        {FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            {i > 0 && "→"} <span className="rounded bg-muted px-1.5 py-0.5">{s.replace(/_/g, " ")}</span>
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No incidents"
          description="Report a lost or stolen card to start the replacement workflow."
          icon={AlertTriangle}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.incident_number}</TableCell>
                  <TableCell className="capitalize">{r.incident_type}</TableCell>
                  <TableCell>
                    <div>{r.wid_identities?.full_name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{r.wid_identities?.identity_number}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.wid_credentials?.credential_number}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs">{new Date(r.reported_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.status !== "closed" && (
                      <Button size="sm" onClick={() => advance(r)}>Advance step</Button>
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
