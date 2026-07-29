"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Fingerprint } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listPersons,
  createPerson,
  activatePerson,
  suspendPerson,
  PERSON_STATUSES,
} from "@/lib/unified-identity";
import { toast } from "sonner";

export default function UnifiedPersonsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    legal_first_name: "",
    legal_last_name: "",
    primary_email: "",
    primary_phone: "",
    department: "",
    job_title: "",
  });

  const load = async () => {
    try {
      setRows(
        await listPersons({
          search: search || undefined,
          status: status === "all" ? undefined : status,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed — apply migration 00048");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      const p = await createPerson({
        company_id: auth.profile.company_id,
        display_name: form.display_name,
        legal_first_name: form.legal_first_name,
        legal_last_name: form.legal_last_name,
        primary_email: form.primary_email,
        primary_phone: form.primary_phone,
        department: form.department,
        job_title: form.job_title,
        created_by: auth.user.id,
      });
      toast.success(`Created ${p.upid}`);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  if (loading) return <LoadingState message="Loading unified persons…" />;

  return (
    <div>
      <PageHeader
        title="Unified Person Directory"
        description="Universal Person IDs · auth · HR · credentials · module links"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/identity/ecosystem">Ecosystem</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New person</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader>
                    <DialogTitle>Create digital person</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Display name</Label>
                      <Input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>First name</Label>
                        <Input value={form.legal_first_name} onChange={(e) => setForm({ ...form, legal_first_name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Last name</Label>
                        <Input value={form.legal_last_name} onChange={(e) => setForm({ ...form, legal_last_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.primary_email} onChange={(e) => setForm({ ...form, primary_email: e.target.value })} />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={form.primary_phone} onChange={(e) => setForm({ ...form, primary_phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Department</Label>
                        <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                      </div>
                      <div>
                        <Label>Job title</Label>
                        <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create UPID</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, UPID, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PERSON_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>Search</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No unified persons"
          description="Apply migration 00048 to backfill from employees, or create a person."
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UPID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.upid)}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/identity/persons/${r.id}`} className="font-medium text-sm hover:underline">
                      {String(r.display_name)}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{String(r.primary_email || "")}</p>
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-sm">
                    {String(r.department || "—")}
                    {r.job_title ? (
                      <span className="text-[10px] text-muted-foreground block">{String(r.job_title)}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {r.user_profile_id ? <Badge variant="outline" className="text-[9px]">Auth</Badge> : null}
                    {r.employee_id ? <Badge variant="outline" className="text-[9px]">HR</Badge> : null}
                    {r.wid_identity_id ? <Badge variant="outline" className="text-[9px]">Badge</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                        <Link href={`/dashboard/identity/persons/${r.id}`}>Open</Link>
                      </Button>
                      {r.status !== "active" && auth && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            activatePerson(String(r.id), auth.profile.company_id, auth.user.id).then(() => {
                              toast.success("Activated");
                              load();
                            })
                          }
                        >
                          Activate
                        </Button>
                      )}
                      {r.status === "active" && auth && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            suspendPerson(String(r.id), auth.profile.company_id, "Suspended from directory", auth.user.id).then(() => {
                              toast.success("Suspended");
                              load();
                            })
                          }
                        >
                          Suspend
                        </Button>
                      )}
                    </div>
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
